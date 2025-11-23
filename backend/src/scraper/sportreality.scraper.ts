import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service';
import { createId } from '../common/hashing';
import { normalizeGender, normalizeAge, normalizeColor, normalizeSubcategory } from '../utils/normalize_data';

const STORE = 'Sport Reality MK';
const PDP_RE = /\/mk\/(obuvki|tekstil|oprema)\/\d+-[a-z0-9-]+$/;

@Injectable()
export class SportRealityScraper {
    private readonly log = new Logger(SportRealityScraper.name);
    private readonly limit = pLimit(4);

    constructor(private readonly db: PostgresService) {}

    async scrapeCategory(baseUrl: string, topCategory: string) {
        for (let page = 1; page <= 30; page++) {
            const url = page === 1 ? baseUrl : `${baseUrl}/page-${page}`;
            const html = await this.fetch(url);
            if (!html) break;

            const $ = cheerio.load(html);
            const pdps = new Set<string>();
            $('a[href]').each((_, a) => {
                const href = $(a).attr('href')!;
                if (PDP_RE.test(href)) pdps.add(new URL(href, baseUrl).toString());
            });

            if (pdps.size === 0) {
                this.log.log(`No products on page ${page}, stopping.`);
                break;
            }

            this.log.log(`Page ${page}: ${pdps.size} products`);
            await Promise.all(
                [...pdps].map((href) =>
                    this.limit(() => this.scrapePdp(href, topCategory)),
                ),
            );
        }
    }

    private async scrapePdp(productUrl: string, topCategory: string) {
        const html = await this.fetch(productUrl);
        if (!html) return;

        const $ = cheerio.load(html);
        const name = ($('h1').first().text() || '').trim();
        let image: string | null = null;
        $('img').each((_, img) => {
            const src =
                $(img).attr('data-src') ||
                $(img).attr('src');

            if (
                src &&
                !image &&
                src.includes('/files/thumbs/') &&
                !src.endsWith('.svg') &&
                !src.includes('icon-')
            ) {
                if (src.startsWith('http')) {
                    image = src;
                } else if (src.startsWith('/files/')) {
                    image = `https://www.sportreality.mk${src}`;
                } else {
                    image = new URL(src, productUrl).toString();
                }
            }
        });
        const specs: Record<string, string> = {};
        $('table tr').each((_, row) => {
            const key = $(row).find('td').eq(0).text().trim();
            const val = $(row).find('td').eq(1).text().trim();
            if (key && val) specs[key] = val;
        });

        const subcategory = normalizeSubcategory(specs['Категорија'] || topCategory);
        const gender = normalizeGender(specs['Пол'] || 'Unknown');
        const age = normalizeAge(specs['Возраст'] || 'Unknown');
        const brand = specs['Бренд'] || guessBrandFromPage($);
        const color = normalizeColor(specs['Боја'] || 'Unknown');
        const priceMKD = extractPrice($);
        const uniqueKey = `${name.toLowerCase()}::${brand.toLowerCase()}::${subcategory.toLowerCase()}::${gender.toLowerCase()}::${age.toLowerCase()}::${color.toLowerCase()}`;
        const id = createId(uniqueKey);

        const now = dayjs();

        const doc = {
            id,
            name,
            brand,
            category: topCategory,
            subcategory,
            gender,
            age,
            color,
            image: image || null,
            priceMap: { [STORE]: priceMKD ?? null },
            storeLinks: { [STORE]: productUrl },
            productUrl,
            currency: 'MKD',
            createdAt: now.toDate(),
            updatedAt: now.toDate(),
        };
        await this.db.upsertProduct(doc, STORE, priceMKD, now.toDate());
    }

    private async fetch(url: string): Promise<string | null> {
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)',
                    'Accept-Language': 'mk,en;q=0.8',
                },
                timeout: 25000,
            });
            return res.data as string;
        } catch (e) {
            this.log.warn(`Fetch failed: ${url} -> ${(e as Error).message}`);
            return null;
        }
    }
}

function extractPrice($: cheerio.CheerioAPI): number | null {
    let priceText =
        $('.current').first().text() ||
        $('.product-price .price').first().text() ||
        $('.price-current').first().text();

    if (!priceText) {
        priceText =
            $('.product-price').first().text() ||
            $('span.price').first().text();
    }

    if (!priceText) return null;

    const m = priceText.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)/);
    if (!m) return null;

    const normalized = m[1].replace(/[.\s]/g, '');
    return parseInt(normalized, 10);
}

function guessBrandFromPage($: cheerio.CheerioAPI): string {
    const t = $('body').text();
    const m = t.match(/Бренд\s+([\p{L}A-Za-z0-9&\-\s]+)/u);
    if (m) return m[1].trim();
    const h1 = ($('h1').first().text() || '').trim();
    const first = h1.split(/\s+/)[0];
    return first.length > 1 ? first : 'Unknown';
}
