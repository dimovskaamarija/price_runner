import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { Logger } from '@nestjs/common';
import { absoluteUrl, cleanText, compact, labelsFromSpecs, latinOnly, parsePrice, readBreadcrumbs, readSpecs, readStructuredData } from './extract';
import { fetchHtml } from './http';
import type { ScrapedListing, SiteConfig, StartPage } from './types';

export interface CrawlStats {
    store: string;
    pages: number;
    products: number;
    failed: number;
    durationSec: number;
}

/**
 * Generic, config-driven crawler: listing pages -> product links -> product pages.
 * Calls `onBatch` once per listing page so results are persisted incrementally
 * (bounded memory, partial progress survives crashes).
 */
export class SiteScraper {
    private readonly log: Logger;

    constructor(private readonly site: SiteConfig) {
        this.log = new Logger(`Scraper:${site.store}`);
    }

    async crawl(onBatch: (listings: ScrapedListing[]) => Promise<void>, opts: { limit?: number } = {}): Promise<CrawlStats> {
        const started = Date.now();
        const stats: CrawlStats = { store: this.site.store, pages: 0, products: 0, failed: 0, durationSec: 0 };
        const limit = pLimit(this.site.concurrency ?? 4);
        const seen = new Set<string>();
        const maxPages = this.site.maxPages ?? parseInt(process.env.SCRAPER_MAX_PAGES || '100', 10);

        outer: for (const start of this.site.startPages) {
            for (let page = 1; page <= maxPages; page++) {
                const listUrl = this.site.pageUrl(start.url, page);
                const html = await fetchHtml(listUrl, this.site.timeoutMs);
                if (!html) break;
                stats.pages++;

                const links = this.extractLinks(html, listUrl).filter((l) => !seen.has(l));
                // No *new* products means we've run past the last page (some shops repeat it).
                if (!links.length) break;
                links.forEach((l) => seen.add(l));

                const batch = opts.limit ? links.slice(0, Math.max(0, opts.limit - stats.products - stats.failed)) : links;
                const results = await Promise.all(batch.map((link) => limit(() => this.scrapeProduct(link, start))));
                const ok = results.filter((r): r is ScrapedListing => !!r);
                stats.products += ok.length;
                stats.failed += results.length - ok.length;
                if (ok.length) await onBatch(ok);

                this.log.log(`${start.url} p${page}: ${ok.length}/${links.length} products`);
                if (opts.limit && stats.products + stats.failed >= opts.limit) break outer;
            }
        }

        stats.durationSec = Math.round((Date.now() - started) / 1000);
        this.log.log(`Done: ${stats.products} products, ${stats.failed} failed, ${stats.pages} pages in ${stats.durationSec}s`);
        return stats;
    }

    private extractLinks(html: string, baseUrl: string): string[] {
        const $ = cheerio.load(html);
        const { selector = 'a[href]', pattern } = this.site.productLinks;
        const links = new Set<string>();
        $(selector).each((_, a) => {
            const href = absoluteUrl($(a).attr('href'), baseUrl);
            if (!href) return;
            const clean = href.replace(/#.*$/, '');
            if (!pattern || pattern.test(new URL(clean).pathname)) links.add(clean);
        });
        return [...links];
    }

    async scrapeProduct(url: string, start: StartPage = { url }): Promise<ScrapedListing | null> {
        try {
            const html = await fetchHtml(url, this.site.timeoutMs);
            if (!html) return null;
            const $ = cheerio.load(html);
            const structured = readStructuredData($, url);
            const specs = readSpecs($);
            const generic = labelsFromSpecs(specs);
            const sel = this.site.selectors || {};

            const specific = compact(this.site.extractor?.({ $, url, site: this.site, structured, specs }) || {});

            let name = specific.name || cleanText(sel.name ? $(sel.name).first().text() : '') || structured.name || cleanText($('h1').first().text());
            const brand = specific.brand || (sel.brand && cleanText($(sel.brand).first().text())) || generic.brand || structured.brand;
            if (this.site.latinNames) name = latinOnly(name) || name;
            name = dedupeLeadingBrand(name, brand);
            if (!name) return null;

            const selectorPrice = sel.price ? parsePrice($(sel.price).first().text()) : null;
            return {
                url,
                name,
                brand,
                code: specific.code || (sel.code && cleanText($(sel.code).first().text())) || generic.code || structured.sku,
                price: specific.price ?? selectorPrice ?? structured.price ?? null,
                image: specific.image || (sel.image && absoluteUrl($(sel.image).first().attr('src'), url)) || structured.image || null,
                labels: compact({
                    ...generic.labels,
                    color: generic.labels.color || structured.color,
                    breadcrumbs: sel.breadcrumbs ? readBreadcrumbs($, sel.breadcrumbs) : undefined,
                    ...(specific.labels ? compact(specific.labels) : {}),
                }),
                hints: start.hints,
            };
        } catch (e) {
            this.log.warn(`Failed ${url}: ${(e as Error).message}`);
            return null;
        }
    }
}

/** "Nike NIKE AIR MAX 95" -> "Nike AIR MAX 95" */
function dedupeLeadingBrand(name: string, brand?: string): string {
    if (!brand) return name;
    const b = brand.toLowerCase();
    const words = name.split(' ');
    if (words.length > 2 && words[0].toLowerCase() === b && words[1].toLowerCase() === b) words.shift();
    return words.join(' ');
}
