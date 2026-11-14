import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Offer, RawLabels } from '../../database/entities/offer.entity';
import { CategoryMapping, MappingKind } from '../../database/entities/category-mapping.entity';
import { GeminiService, GeminiSchema } from '../ai/gemini.service';
import { MlClient, MlField } from '../ai/ml.client';
import {
    AGES, AGE_KEYWORDS, CATEGORIES, CATEGORY_KEYWORDS, COLORS, COLOR_NAMES, GENDERS, GENDER_KEYWORDS,
    OTHER_SUBCATEGORY, SUBCATEGORIES, SUBCATEGORY_NAMES,
} from './taxonomy';
import { containsPhrase, normalizeText } from './text';

type Field = 'category' | 'subcategory' | 'gender' | 'age' | 'color';
type Classification = Record<Field, string | null>;
type Source = 'rules' | 'mapping' | 'ml' | 'gemini' | 'default';

interface Result {
    offer: Offer;
    values: Classification;
    sources: Partial<Record<Field, Source>>;
    /** Gemini already looked at this offer; don't re-queue it even if defaults were applied. */
    aiTried?: boolean;
}

/** [normalized phrase, canonical value], longest phrase first so specific matches win. */
type PhraseTable = Array<[string, string]>;

function buildTable(dict: Record<string, string[]>): PhraseTable {
    const rows: PhraseTable = [];
    for (const [value, phrases] of Object.entries(dict)) {
        rows.push([normalizeText(value), value]);
        for (const p of phrases) rows.push([normalizeText(p), value]);
    }
    return rows.filter(([p]) => p).sort((a, b) => b[0].length - a[0].length);
}

const TABLES: Record<Field, PhraseTable> = {
    subcategory: buildTable(
        Object.fromEntries(
            Object.entries(SUBCATEGORIES)
                .filter(([name]) => name !== OTHER_SUBCATEGORY)
                .map(([name, def]) => [name, def.keywords]),
        ),
    ),
    category: buildTable(CATEGORY_KEYWORDS),
    gender: buildTable(GENDER_KEYWORDS),
    // Kids markers first: "момчиња" must win over the adult "машки" family.
    age: [...buildTable({ 'За деца': AGE_KEYWORDS['За деца'] }), ...buildTable({ 'За возрасни': AGE_KEYWORDS['За возрасни'] })],
    color: buildTable(COLORS),
};

const ALLOWED: Record<Field, readonly string[]> = {
    category: CATEGORIES,
    subcategory: SUBCATEGORY_NAMES,
    gender: GENDERS,
    age: AGES,
    color: COLOR_NAMES,
};

const NONE = 'NONE';
const FIELDS: Field[] = ['subcategory', 'category', 'gender', 'age', 'color'];
/** Fields worth an LLM call when rules can't resolve them (color is optional). */
const AI_FIELDS: Field[] = ['subcategory', 'gender', 'age'];
const ML_FIELDS: MlField[] = ['subcategory', 'gender', 'age', 'color'];

/**
 * Maps raw store labels to the canonical taxonomy.
 *
 * Resolution order per field:
 *   1. explicit store labels -> learned mappings (manual overrides, earlier Gemini answers) or keyword rules
 *   2. ML model (ml-service: TF-IDF + logistic regression trained on this catalog), if confident
 *   3. keywords in the product name
 *   4. Gemini: unknown raw labels are learned once and cached; then product-level classification
 *   5. safe defaults
 *
 * Every label from steps 1/4 becomes training data for step 2, so the model keeps improving
 * and Gemini is needed less over time.
 */
@Injectable()
export class ClassifierService {
    private readonly log = new Logger(ClassifierService.name);
    private mappings = new Map<string, string | null>();

    constructor(
        @InjectRepository(Offer) private readonly offers: Repository<Offer>,
        @InjectRepository(CategoryMapping) private readonly mappingRepo: Repository<CategoryMapping>,
        private readonly gemini: GeminiService,
        private readonly ml: MlClient,
        private readonly dataSource: DataSource,
    ) {}

    /** Classify every offer with classifiedAt = NULL (new offers or offers whose labels changed). */
    async classifyPending(batchSize = 500): Promise<{ classified: number; ml: number; aiLabels: number; aiProducts: number }> {
        await this.loadMappings();

        if (this.gemini.enabled || this.ml.enabled) {
            // ML/Gemini became available after offers got defaults: give them another chance.
            await this.dataSource.query(
                `UPDATE offers SET "classifiedAt" = NULL
                 WHERE id IN (SELECT id FROM offers WHERE "classificationSource" = 'default' LIMIT 3000)`,
            );
        }

        const stats = { classified: 0, ml: 0, aiLabels: 0, aiProducts: 0 };
        let lastId = 0;
        for (;;) {
            const batch = await this.offers
                .createQueryBuilder('o')
                .where('o.classifiedAt IS NULL AND o.id > :lastId', { lastId })
                .orderBy('o.id', 'ASC')
                .take(batchSize)
                .getMany();
            if (!batch.length) break;
            lastId = batch[batch.length - 1].id;

            let results = batch.map((o) => this.classifyLabels(o));
            stats.ml += await this.applyMl(results);
            for (const r of results) this.applyNameRules(r);

            if (this.gemini.enabled) {
                const learned = await this.learnUnknownLabels(results);
                stats.aiLabels += learned;
                if (learned) {
                    // Re-run with the new mappings, keeping what ML / name rules already found.
                    results = results.map((prev) => mergeResults(this.classifyLabels(prev.offer), prev));
                }
                stats.aiProducts += await this.classifyProductsWithGemini(results);
            }

            for (const r of results) this.applyDefaults(r);
            await this.save(results);
            stats.classified += results.length;
        }
        if (stats.classified) {
            this.log.log(`Classified ${stats.classified} offers (ML: ${stats.ml}, Gemini: ${stats.aiLabels} labels, ${stats.aiProducts} products)`);
        }
        return stats;
    }

    /** Re-classify everything (e.g. after editing taxonomy.ts or adding manual mappings). */
    async resetAll(): Promise<number> {
        const [, affected] = await this.dataSource.query(`UPDATE offers SET "classifiedAt" = NULL`);
        return affected || 0;
    }

    // ------------------------------------------------------------------ rules

    /** Rules only (labels + name keywords). Used by the scraper preview endpoint. */
    classifyWithRules(offer: Offer): Result {
        const r = this.classifyLabels(offer);
        this.applyNameRules(r);
        return r;
    }

    /** Step 1: explicit store labels, breadcrumbs and crawl hints only (high precision). */
    classifyLabels(offer: Offer): Result {
        const labels: RawLabels = offer.rawLabels || {};
        const hints: RawLabels = offer.hints || {};
        const crumbs = [...(labels.breadcrumbs || [])].reverse(); // most specific first
        const values: Classification = { category: null, subcategory: null, gender: null, age: null, color: null };
        const sources: Result['sources'] = {};

        const resolve = (field: Field, labelSources: Array<string | undefined>) => {
            for (const raw of labelSources) {
                const hit = this.lookup(field, raw);
                if (hit) {
                    values[field] = hit.value;
                    sources[field] = hit.source;
                    return;
                }
            }
        };

        resolve('subcategory', [labels.subcategory, ...crumbs, hints.subcategory]);
        resolve('gender', [labels.gender, hints.gender, ...crumbs]);
        resolve('age', [labels.age, hints.age, labels.gender, ...crumbs]);
        resolve('color', [labels.color]);
        if (!values.subcategory || values.subcategory === OTHER_SUBCATEGORY) {
            resolve('category', [labels.category, hints.category, ...crumbs]);
        }
        const r = { offer, values, sources };
        deriveCategory(r);
        return r;
    }

    /** Step 2: ML model for fields the labels didn't resolve; accepted only above ML_MIN_CONFIDENCE. */
    private async applyMl(results: Result[]): Promise<number> {
        if (!this.ml.enabled) return 0;
        const pending = results.filter((r) => ML_FIELDS.some((f) => !r.values[f]));
        if (!pending.length) return 0;
        const preds = await this.ml.predict(
            pending.map(({ offer }) => ({
                id: offer.id,
                name: offer.name,
                brand: offer.brand,
                url: offer.url,
                store: offer.store,
                rawLabels: offer.rawLabels as Record<string, unknown>,
                hints: offer.hints as Record<string, unknown>,
            })),
        );
        if (!preds) return 0;
        const byId = new Map(pending.map((r) => [r.offer.id, r]));
        let filled = 0;
        for (const p of preds) {
            const r = byId.get(p.id);
            if (!r) continue;
            for (const f of ML_FIELDS) {
                const pred = p.predictions[f];
                if (!r.values[f] && pred && pred.confidence >= this.ml.minConfidence && ALLOWED[f].includes(pred.value)) {
                    r.values[f] = pred.value;
                    r.sources[f] = 'ml';
                    filled++;
                }
            }
            deriveCategory(r);
        }
        return filled;
    }

    /** Step 3: keyword rules on the product name for anything still unresolved. */
    applyNameRules(r: Result) {
        const name = r.offer.name || '';
        for (const f of ['subcategory', 'gender', 'age', 'color'] as Field[]) {
            if (r.values[f]) continue;
            const v = this.matchRules(f, name);
            if (v) {
                r.values[f] = v;
                r.sources[f] = 'rules';
            }
        }
        deriveCategory(r);
    }

    private lookup(field: Field, raw?: string): { value: string; source: Source } | null {
        const key = normalizeText(raw);
        if (!key) return null;
        const mapKey = `${field}|${key}`;
        if (this.mappings.has(mapKey)) {
            const v = this.mappings.get(mapKey);
            return v ? { value: v, source: 'mapping' } : null;
        }
        const v = this.matchRules(field, key);
        return v ? { value: v, source: 'rules' } : null;
    }

    private matchRules(field: Field, text?: string): string | null {
        const t = normalizeText(text);
        if (!t) return null;
        for (const [phrase, value] of TABLES[field]) {
            if (containsPhrase(t, phrase)) return value;
        }
        return null;
    }

    private applyDefaults(r: Result) {
        const v = r.values;
        const def = (f: Field, value: string | null) => {
            if (!v[f] && value) {
                v[f] = value;
                r.sources[f] = r.sources[f] || 'default';
            }
        };
        def('subcategory', OTHER_SUBCATEGORY);
        if (!v.category) {
            const fromSub = v.subcategory && v.subcategory !== OTHER_SUBCATEGORY ? SUBCATEGORIES[v.subcategory].category : null;
            def('category', fromSub || 'Опрема');
        }
        // A subcategory from Опрема under an "Обувки" hint etc. — trust the subcategory.
        if (v.subcategory && v.subcategory !== OTHER_SUBCATEGORY) v.category = SUBCATEGORIES[v.subcategory].category;
        def('gender', 'Унисекс');
        def('age', 'За возрасни');
    }

    // ------------------------------------------------------------------ Gemini

    /** Send every distinct unresolved raw label to Gemini once and persist the answers. */
    private async learnUnknownLabels(results: Result[]): Promise<number> {
        const unknown: Record<Field, Set<string>> = {
            category: new Set(), subcategory: new Set(), gender: new Set(), age: new Set(), color: new Set(),
        };
        for (const { offer, values } of results) {
            const l = offer.rawLabels || {};
            const add = (f: Field, raw?: string) => {
                const key = normalizeText(raw);
                if (key && !values[f] && !this.mappings.has(`${f}|${key}`)) unknown[f].add(key);
            };
            add('subcategory', l.subcategory);
            add('gender', l.gender);
            add('age', l.age);
            add('color', l.color);
            add('category', l.category);
        }

        let learned = 0;
        for (const field of FIELDS) {
            const labels = [...unknown[field]];
            for (let i = 0; i < labels.length; i += 100) {
                const chunk = labels.slice(i, i + 100);
                const schema: GeminiSchema = {
                    type: 'OBJECT',
                    properties: {
                        results: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    i: { type: 'INTEGER' },
                                    value: { type: 'STRING', enum: [...ALLOWED[field], NONE] },
                                },
                                required: ['i', 'value'],
                            },
                        },
                    },
                    required: ['results'],
                };
                const prompt =
                    `Map each raw "${field}" label from Macedonian sports-retail websites to exactly one allowed value.\n` +
                    `Answer "${NONE}" if the label does not determine the ${field}.\n\n` +
                    `Allowed values: ${ALLOWED[field].join(' | ')}\n\nLabels:\n` +
                    chunk.map((l, idx) => `${idx}: ${l}`).join('\n');
                const res = await this.gemini.generateJson<{ results: { i: number; value: string }[] }>(prompt, schema, SYSTEM_PROMPT);
                if (!res?.results) continue;

                const rows: Partial<CategoryMapping>[] = [];
                for (const { i: idx, value } of res.results) {
                    const raw = chunk[idx];
                    if (raw === undefined) continue;
                    const v = value === NONE || !ALLOWED[field].includes(value) ? null : value;
                    this.mappings.set(`${field}|${raw}`, v);
                    rows.push({ kind: field as MappingKind, raw, value: v, source: 'gemini' });
                }
                if (rows.length) {
                    await this.mappingRepo
                        .createQueryBuilder()
                        .insert()
                        .into(CategoryMapping)
                        .values(rows)
                        .orIgnore()
                        .execute();
                    learned += rows.length;
                }
            }
        }
        return learned;
    }

    /** Classify products whose subcategory/gender/age are still unknown from name + labels. */
    private async classifyProductsWithGemini(results: Result[]): Promise<number> {
        const pending = results.filter((r) => AI_FIELDS.some((f) => !r.values[f]));
        let done = 0;
        for (let i = 0; i < pending.length; i += 40) {
            const chunk = pending.slice(i, i + 40);
            const enumOrNone = (f: Field): GeminiSchema => ({ type: 'STRING', enum: [...ALLOWED[f], NONE] });
            const schema: GeminiSchema = {
                type: 'OBJECT',
                properties: {
                    results: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                i: { type: 'INTEGER' },
                                subcategory: enumOrNone('subcategory'),
                                gender: enumOrNone('gender'),
                                age: enumOrNone('age'),
                                color: enumOrNone('color'),
                            },
                            required: ['i', 'subcategory', 'gender', 'age', 'color'],
                        },
                    },
                },
                required: ['results'],
            };
            const items = chunk.map(({ offer }, idx) => {
                const l = offer.rawLabels || {};
                let path = '';
                try {
                    path = decodeURIComponent(new URL(offer.url).pathname);
                } catch { /* ignore */ }
                return {
                    i: idx,
                    name: offer.name,
                    brand: offer.brand,
                    url_path: path,
                    labels: { ...l, ...Object.fromEntries(Object.entries(offer.hints || {}).map(([k, v]) => [`hint_${k}`, v])) },
                };
            });
            const prompt =
                `Classify each product into the taxonomy. Use "${NONE}" only when it truly cannot be inferred.\n` +
                `subcategory: ${SUBCATEGORY_NAMES.join(' | ')}\n` +
                `gender: ${GENDERS.join(' | ')}   (unisex/kids-unisex -> Унисекс)\n` +
                `age: ${AGES.join(' | ')}   (GS/PS/TD/junior/kids sizes -> За деца)\n` +
                `color: ${COLOR_NAMES.join(' | ')}\n\nProducts (JSON):\n${JSON.stringify(items)}`;
            const res = await this.gemini.generateJson<{ results: Array<{ i: number } & Record<Field, string>> }>(prompt, schema, SYSTEM_PROMPT);
            if (!res?.results) continue;

            for (const row of res.results) {
                const r = chunk[row.i];
                if (!r) continue;
                r.aiTried = true;
                for (const f of ['subcategory', 'gender', 'age', 'color'] as Field[]) {
                    const v = row[f];
                    if (!r.values[f] && v && v !== NONE && ALLOWED[f].includes(v)) {
                        r.values[f] = v;
                        r.sources[f] = 'gemini';
                    }
                }
                if (r.values.subcategory && r.values.subcategory !== OTHER_SUBCATEGORY) {
                    r.values.category = SUBCATEGORIES[r.values.subcategory].category;
                }
                done++;
            }
        }
        return done;
    }

    // ------------------------------------------------------------------ persistence

    private async loadMappings() {
        const rows = await this.mappingRepo.find();
        this.mappings = new Map(rows.map((r) => [`${r.kind}|${normalizeText(r.raw)}`, r.value]));
    }

    private async save(results: Result[]) {
        if (!results.length) return;
        const params: unknown[] = [];
        const tuples = results.map((r) => {
            const srcs = Object.values(r.sources);
            const source: Source = srcs.includes('default') && !r.aiTried
                ? 'default'
                : srcs.includes('gemini') || r.aiTried
                  ? 'gemini'
                  : srcs.includes('ml')
                    ? 'ml'
                    : srcs.includes('mapping')
                    ? 'mapping'
                    : 'rules';
            const v = r.values;
            params.push(r.offer.id, v.category, v.subcategory, v.gender, v.age, v.color, source, JSON.stringify(r.sources));
            const n = params.length;
            return `($${n - 7}::int, $${n - 6}, $${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n}::jsonb)`;
        });
        await this.dataSource.query(
            `UPDATE offers o SET category = v.category, subcategory = v.subcategory, gender = v.gender,
                    age = v.age, color = v.color, "classificationSource" = v.source, "fieldSources" = v.fs,
                    "classifiedAt" = now()
             FROM (VALUES ${tuples.join(',')}) AS v(id, category, subcategory, gender, age, color, source, fs)
             WHERE o.id = v.id`,
            params,
        );
    }
}

const SYSTEM_PROMPT =
    'You are a product-catalog classifier for a price-comparison site of North Macedonian sports retailers ' +
    '(labels are mostly Macedonian Cyrillic, product names mostly English). ' +
    'Return only values from the allowed enums. Be conservative: prefer NONE over a guess.';

/** Category always follows a concrete subcategory; otherwise keep the label-derived category. */
function deriveCategory(r: Result) {
    const sub = r.values.subcategory;
    if (sub && sub !== OTHER_SUBCATEGORY && SUBCATEGORIES[sub]) {
        r.values.category = SUBCATEGORIES[sub].category;
        r.sources.category = r.sources.subcategory;
    }
}

/** Fill fields missing in `fresh` (label stage) from `prev` (later stages). */
function mergeResults(fresh: Result, prev: Result): Result {
    for (const f of FIELDS) {
        if (!fresh.values[f] && prev.values[f]) {
            fresh.values[f] = prev.values[f];
            fresh.sources[f] = prev.sources[f];
        }
    }
    deriveCategory(fresh);
    return fresh;
}
