import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Offer } from '../../database/entities/offer.entity';
import { GeminiService } from '../ai/gemini.service';
import { brandKey, cosine, createId, jaccard, nameTokens } from './text';

interface Candidate {
    id: string;
    name: string;
    brand: string | null;
    gender: string | null;
    color: string | null;
    modelCode: string | null;
    embedding: number[] | null;
    stores: string[];
    tokens?: Set<string>;
}

const EMBED_THRESHOLD = parseFloat(process.env.CLUSTER_EMBED_THRESHOLD || '0.93');
const JACCARD_THRESHOLD = parseFloat(process.env.CLUSTER_NAME_THRESHOLD || '0.8');

/**
 * Groups store offers into canonical products ("same shoe at 3 stores" -> 1 product).
 *
 *   1. Exact match on normalized manufacturer model code (+ compatible brand).
 *      This covers the vast majority: stores publish the brand's style code (e.g. IB6651-300).
 *   2. Fuzzy match inside the same brand + category + gender + color block, only when
 *      one side has no model code (codes that differ are never merged):
 *        - Gemini embeddings (cosine >= CLUSTER_EMBED_THRESHOLD) when a key is configured
 *        - otherwise name-token Jaccard (>= CLUSTER_NAME_THRESHOLD)
 *   3. Otherwise a new product is created.
 */
@Injectable()
export class ClusteringService {
    private readonly log = new Logger(ClusteringService.name);

    constructor(
        @InjectRepository(Offer) private readonly offers: Repository<Offer>,
        private readonly gemini: GeminiService,
        private readonly dataSource: DataSource,
    ) {}

    async clusterPending(batchSize = 500): Promise<{ assigned: number; created: number; fuzzy: number }> {
        const stats = { assigned: 0, created: 0, fuzzy: 0 };
        const blockCache = new Map<string, Candidate[]>();
        let lastId = 0;

        for (;;) {
            const batch = await this.offers
                .createQueryBuilder('o')
                .where('o.productId IS NULL AND o.classifiedAt IS NOT NULL AND o.id > :lastId', { lastId })
                .orderBy('o.id', 'ASC')
                .take(batchSize)
                .getMany();
            if (!batch.length) break;
            lastId = batch[batch.length - 1].id;

            const byCode = await this.loadProductsByCode(batch.map((o) => o.modelCode).filter(Boolean) as string[]);
            const assignments: Array<[number, string]> = [];
            const newProducts = new Map<string, Offer>();

            for (const offer of batch) {
                // 1. model code
                const codeHit = offer.modelCode
                    ? (byCode.get(offer.modelCode) || []).find((p) => brandsCompatible(p.brand, offer.brand))
                    : undefined;
                if (codeHit) {
                    assignments.push([offer.id, codeHit.id]);
                    stats.assigned++;
                    continue;
                }

                // 2. fuzzy within block
                const fuzzy = await this.findFuzzyMatch(offer, blockCache);
                if (fuzzy) {
                    assignments.push([offer.id, fuzzy]);
                    stats.assigned++;
                    stats.fuzzy++;
                    continue;
                }

                // 3. new product
                const id = createId(
                    offer.modelCode ? `${brandKey(offer.brand)}::${offer.modelCode}` : `${offer.store}::${offer.externalKey}`,
                );
                if (!newProducts.has(id)) newProducts.set(id, offer);
                assignments.push([offer.id, id]);
                stats.created++;

                const candidate: Candidate = {
                    id, name: offer.name, brand: offer.brand || null, gender: offer.gender || null,
                    color: offer.color || null, modelCode: offer.modelCode || null, embedding: null, stores: [offer.store],
                };
                if (offer.modelCode) {
                    byCode.set(offer.modelCode, [...(byCode.get(offer.modelCode) || []), candidate]);
                }
                blockCache.get(this.blockKey(offer))?.push(candidate);
            }

            await this.insertProducts([...newProducts.entries()]);
            await this.assign(assignments);
        }

        if (stats.assigned || stats.created) {
            this.log.log(`Clustering: ${stats.assigned} offers joined existing products (${stats.fuzzy} fuzzy), ${stats.created} new`);
        }
        return stats;
    }

    // ------------------------------------------------------------------ matching

    private async loadProductsByCode(codes: string[]): Promise<Map<string, Candidate[]>> {
        const map = new Map<string, Candidate[]>();
        if (!codes.length) return map;
        const rows: Candidate[] = await this.dataSource.query(
            `SELECT id, name, brand, gender, color, "modelCode" FROM products WHERE "modelCode" = ANY($1)
             UNION
             SELECT p.id, p.name, p.brand, p.gender, p.color, o."modelCode"
             FROM offers o JOIN products p ON p.id = o."productId"
             WHERE o."modelCode" = ANY($1)`,
            [[...new Set(codes)]],
        );
        for (const r of rows) {
            if (!r.modelCode) continue;
            const list = map.get(r.modelCode) || [];
            if (!list.some((c) => c.id === r.id)) list.push(r);
            map.set(r.modelCode, list);
        }
        return map;
    }

    private blockKey(o: Offer) {
        return `${brandKey(o.brand)}|${o.category || ''}`;
    }

    private async loadBlock(o: Offer, cache: Map<string, Candidate[]>): Promise<Candidate[]> {
        const key = this.blockKey(o);
        let block = cache.get(key);
        if (block) return block;
        block = await this.dataSource.query(
            `SELECT p.id, p.name, p.brand, p.gender, p.color, p."modelCode", p.embedding,
                    COALESCE(array_agg(DISTINCT o.store) FILTER (WHERE o.store IS NOT NULL), '{}') AS stores
             FROM products p LEFT JOIN offers o ON o."productId" = p.id
             WHERE regexp_replace(lower(coalesce(p.brand, '')), '[^[:alnum:]]', '', 'g') = $1 AND p.category IS NOT DISTINCT FROM $2
             GROUP BY p.id`,
            [brandKey(o.brand), o.category || null],
        );
        cache.set(key, block);
        return block;
    }

    private async findFuzzyMatch(offer: Offer, cache: Map<string, Candidate[]>): Promise<string | null> {
        if (!offer.brand) return null;
        const block = await this.loadBlock(offer, cache);
        const candidates = block.filter(
            (c) =>
                !c.stores.includes(offer.store) && // one store lists a product once
                !(c.modelCode && offer.modelCode && c.modelCode !== offer.modelCode) &&
                same(c.gender, offer.gender) &&
                same(c.color, offer.color),
        );
        if (!candidates.length) return null;

        if (this.gemini.enabled) {
            const vec = (await this.gemini.embed([embedText(offer.brand, offer.name, offer.color)]))?.[0];
            if (vec) {
                await this.ensureEmbeddings(candidates);
                let best: { id: string; score: number } | null = null;
                for (const c of candidates) {
                    if (!c.embedding) continue;
                    const score = cosine(vec, c.embedding);
                    if (score >= EMBED_THRESHOLD && (!best || score > best.score)) best = { id: c.id, score };
                }
                if (best) {
                    candidates.find((c) => c.id === best!.id)!.stores.push(offer.store);
                    return best.id;
                }
                return null;
            }
        }

        const tokens = nameTokens(offer.name, offer.brand);
        if (tokens.size < 2) return null;
        let best: { c: Candidate; score: number } | null = null;
        for (const c of candidates) {
            c.tokens = c.tokens || nameTokens(c.name, c.brand);
            const score = jaccard(tokens, c.tokens);
            if (score >= JACCARD_THRESHOLD && (!best || score > best.score)) best = { c, score };
        }
        if (best) {
            best.c.stores.push(offer.store);
            return best.c.id;
        }
        return null;
    }

    private async ensureEmbeddings(candidates: Candidate[]) {
        const missing = candidates.filter((c) => !c.embedding);
        if (!missing.length) return;
        const vectors = await this.gemini.embed(missing.map((c) => embedText(c.brand, c.name, c.color)));
        if (!vectors) return;
        const params: unknown[] = [];
        const tuples = missing.map((c, i) => {
            c.embedding = vectors[i];
            params.push(c.id, vectors[i]);
            return `($${params.length - 1}, $${params.length}::real[])`;
        });
        await this.dataSource.query(
            `UPDATE products p SET embedding = v.e FROM (VALUES ${tuples.join(',')}) AS v(id, e) WHERE p.id = v.id`,
            params,
        );
    }

    // ------------------------------------------------------------------ writes

    private async insertProducts(entries: Array<[string, Offer]>) {
        if (!entries.length) return;
        for (let i = 0; i < entries.length; i += 500) {
            const params: unknown[] = [];
            const tuples = entries.slice(i, i + 500).map(([id, o]) => {
                params.push(id, o.name, o.brand, o.category, o.subcategory, o.gender, o.age, o.color, o.image, o.modelCode);
                const n = params.length;
                return `(${Array.from({ length: 10 }, (_, k) => `$${n - 9 + k}`).join(', ')})`;
            });
            await this.dataSource.query(
                `INSERT INTO products (id, name, brand, category, subcategory, gender, age, color, image, "modelCode")
                 VALUES ${tuples.join(',')}
                 ON CONFLICT (id) DO NOTHING`,
                params,
            );
        }
    }

    private async assign(pairs: Array<[number, string]>) {
        for (let i = 0; i < pairs.length; i += 1000) {
            const chunk = pairs.slice(i, i + 1000);
            await this.dataSource.query(
                `UPDATE offers o SET "productId" = v.pid
                 FROM unnest($1::int[], $2::varchar[]) AS v(id, pid)
                 WHERE o.id = v.id`,
                [chunk.map((p) => p[0]), chunk.map((p) => p[1])],
            );
        }
    }
}

function same(a?: string | null, b?: string | null) {
    return !a || !b || a === b;
}

function brandsCompatible(a?: string | null, b?: string | null) {
    const ka = brandKey(a);
    const kb = brandKey(b);
    return !ka || !kb || ka === kb || ka.startsWith(kb) || kb.startsWith(ka);
}

function embedText(brand: string | null | undefined, name: string, color: string | null | undefined) {
    return [brand, name, color].filter(Boolean).join(' | ');
}
