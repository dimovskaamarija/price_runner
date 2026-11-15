import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import pLimit from 'p-limit';
import { ClassifierService } from '../catalog/classifier.service';
import { ClusteringService } from '../catalog/clustering.service';
import { CatalogMaintenanceService } from '../catalog/maintenance.service';
import { CatalogReadService } from '../catalog/catalog-read.service';
import { GeminiService } from '../ai/gemini.service';
import { MlClient } from '../ai/ml.client';
import { CrawlStats, SiteScraper } from './core/site-scraper';
import { IngestService } from './ingest.service';
import { SITES } from './sites/sites.config';

export interface RunSummary {
    startedAt: string;
    finishedAt?: string;
    durationSec?: number;
    sites: Array<CrawlStats & { priceChanges: number; error?: string }>;
    processing?: Record<string, unknown>;
    error?: string;
}

/**
 * Pipeline:  crawl all sites (in parallel, per-site concurrency)  ->  offers
 *            classify new/changed offers  ->  cluster into products
 *            sync product fields, merge duplicates, recompute prices, cleanup
 */
@Injectable()
export class ScraperService {
    private readonly log = new Logger(ScraperService.name);
    private running: Promise<RunSummary> | null = null;
    /** Catalog processing is serialized: interim (during a run) and final passes never overlap. */
    private processingChain: Promise<unknown> = Promise.resolve();
    private interimQueued = false;
    lastRun: RunSummary | null = null;

    constructor(
        private readonly ingest: IngestService,
        private readonly classifier: ClassifierService,
        private readonly clustering: ClusteringService,
        private readonly maintenance: CatalogMaintenanceService,
        private readonly read: CatalogReadService,
        private readonly gemini: GeminiService,
        private readonly ml: MlClient,
    ) {}

    get isRunning() {
        return !!this.running;
    }

    @Cron('0 3 * * *')
    async scheduled() {
        if (process.env.ENABLE_SCRAPER_CRON === 'false') {
            this.log.log('Cron disabled via ENABLE_SCRAPER_CRON=false');
            return;
        }
        await this.run();
    }

    /** Runs the full pipeline; concurrent calls share the in-flight run. */
    run(stores?: string[]): Promise<RunSummary> {
        if (!this.running) {
            this.running = this.execute(stores).finally(() => (this.running = null));
        }
        return this.running;
    }

    private async execute(stores?: string[]): Promise<RunSummary> {
        const started = Date.now();
        const summary: RunSummary = { startedAt: new Date(started).toISOString(), sites: [] };
        this.lastRun = summary;
        this.gemini.resetBudget();
        this.log.log('=== Scrape run started ===');

        // Make products visible while the crawl is still running (a full first run takes ~1h).
        const intervalMs = parseInt(process.env.SCRAPER_PROCESS_INTERVAL_MIN || '10', 10) * 60_000;
        const timer = setInterval(() => this.processInterim(), intervalMs);

        const sites = SITES.filter((s) => s.enabled !== false && (!stores?.length || stores.includes(s.store)));
        const siteLimit = pLimit(parseInt(process.env.SCRAPER_SITE_CONCURRENCY || '3', 10));

        await Promise.all(
            sites.map((site) =>
                siteLimit(async () => {
                    let priceChanges = 0;
                    try {
                        const stats = await new SiteScraper(site).crawl(async (batch) => {
                            const res = await this.ingest.saveBatch(site.store, batch);
                            priceChanges += res.priceChanges;
                        });
                        summary.sites.push({ ...stats, priceChanges });
                        this.processInterim();
                    } catch (e) {
                        this.log.error(`${site.store} failed: ${(e as Error).message}`, (e as Error).stack);
                        summary.sites.push({ store: site.store, pages: 0, products: 0, failed: 0, durationSec: 0, priceChanges, error: (e as Error).message });
                    }
                }),
            ),
        );

        clearInterval(timer);
        try {
            summary.processing = await this.processCatalog();
        } catch (e) {
            summary.error = (e as Error).message;
            this.log.error(`Catalog processing failed: ${summary.error}`, (e as Error).stack);
        }

        summary.finishedAt = new Date().toISOString();
        summary.durationSec = Math.round((Date.now() - started) / 1000);
        this.log.log(`=== Scrape run finished in ${summary.durationSec}s ===`);
        return summary;
    }

    /** Queue a processing pass during a run (at most one waiting at a time). */
    private processInterim() {
        if (this.interimQueued) return;
        this.interimQueued = true;
        this.processCatalog()
            .then((r) => this.log.log(`Interim processing: ${JSON.stringify(r.classification)}`))
            .catch((e) => this.log.error(`Interim processing failed: ${(e as Error).message}`))
            .finally(() => (this.interimQueued = false));
    }

    /** Classification + clustering + maintenance. Also callable on its own (e.g. after adding a Gemini key). */
    processCatalog(opts: { reclassify?: boolean } = {}) {
        const next = this.processingChain.then(() => this.processCatalogNow(opts));
        this.processingChain = next.catch(() => undefined);
        return next;
    }

    private async processCatalogNow(opts: { reclassify?: boolean }) {
        if (opts.reclassify) await this.classifier.resetAll();
        const classification = await this.classifier.classifyPending();
        const clustering = await this.clustering.clusterPending();
        const maintenance = await this.maintenance.runAll();
        this.read.invalidateCache();
        // Retrain on the newly labelled data (runs in the ML service's background; next run uses it).
        const mlTraining = this.ml.enabled ? ((await this.ml.train())?.status ?? 'unavailable') : 'disabled';
        return { classification, clustering, maintenance, gemini: this.gemini.stats, mlTraining };
    }

    /**
     * Data-driven category discovery: LSA + K-Means clusters from the ML service.
     * Clusters dominated by "Останато" are suggested new categories; Gemini names them if configured.
     */
    async clusterReport(k?: number) {
        const report = await this.ml.clusters(k);
        if (!report) return null;
        const suggested = report.clusters.filter((c) => report.suggested_new_categories.includes(c.id));
        if (suggested.length && this.gemini.enabled) {
            const res = await this.gemini.generateJson<{ names: { id: number; name: string }[] }>(
                'Give a short Macedonian product-category name (1-3 words, like "Патики" or "Опрема за пливање") ' +
                    'for each cluster of sports products, based on its top terms and examples.\n' +
                    JSON.stringify(suggested.map((c) => ({ id: c.id, top_terms: c.top_terms, examples: c.examples }))),
                {
                    type: 'OBJECT',
                    properties: {
                        names: {
                            type: 'ARRAY',
                            items: { type: 'OBJECT', properties: { id: { type: 'INTEGER' }, name: { type: 'STRING' } }, required: ['id', 'name'] },
                        },
                    },
                    required: ['names'],
                },
            );
            for (const n of res?.names || []) {
                const c = report.clusters.find((x) => x.id === n.id);
                if (c) c.suggested_name = n.name;
            }
        }
        return report;
    }

    mlMetrics() {
        return this.ml.metrics();
    }

    /** Scrape a few products of one site without saving — for developing a new site config. */
    async preview(store: string, limit = 5) {
        const site = SITES.find((s) => s.store === store);
        if (!site) throw new Error(`Unknown store "${store}". Known: ${SITES.map((s) => s.store).join(', ')}`);
        const items: unknown[] = [];
        const stats = await new SiteScraper({ ...site, startPages: site.startPages.slice(0, 1), maxPages: 1 }).crawl(
            async (batch) => {
                for (const l of batch) {
                    const fake = { id: 0, name: l.name, brand: l.brand, rawLabels: l.labels, hints: l.hints || {}, url: l.url } as any;
                    items.push({ ...l, classification: this.classifier.classifyWithRules(fake).values });
                }
            },
            { limit },
        );
        return { stats, items };
    }
}
