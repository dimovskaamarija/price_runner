import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../../database/postgres.service';
import { createId } from '../../../common/hashing';
import { normalizeGender, normalizeAge, normalizeColor, normalizeSubcategory, capitalizeFirstLetter } from '../utils/normalize_data';

const STORE = 'Buzz Sneakers MK';

@Injectable()
export class BuzzScraper {
    private readonly log = new Logger(BuzzScraper.name);
    private readonly limit = pLimit(4);

    constructor(private readonly db: PostgresService) {}

    async scrapeCategory(baseUrl: string, topCategory: string) {
        for (let page = 1; page <= 21; page++) {
            const url = page === 1 ? baseUrl : `${baseUrl}/page-${page}`;
            const html = await this.fetch(url);
            if (!html) break;

            const $ = cheerio.load(html);
            const pdps = new Set<string>();

            $('a[href]').each((_, a) => {
                const href = $(a).attr('href')!;
                if (href.includes('/mk/') && href.match(/\/\d{6,}-[a-z0-9-]+$/i)) {
                    const absoluteUrl = new URL(href, baseUrl).toString();
                    pdps.add(absoluteUrl);
                }
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
        var name = ($('h1').first().text() || '').trim();
        const breadcrumbItems = $('.block.breadcrumbs a');
        const category = breadcrumbItems.eq(2).text().trim();
        const subcategory = normalizeSubcategory(breadcrumbItems.eq(3).text().trim());
        const code = $('.code span').first().text().trim();
        let image: string | null = null;
        $('img').each((_, img) => {
            const src =
                $(img).attr('data-src') ||
                $(img).attr('src');

            if (
                src &&
                !image &&
                src.includes('/slike-proizvoda/') &&
                src.includes('/thumbs_900/')
            ) {
                image = src.startsWith('http') ? src : new URL(src, productUrl).toString();
            }
        });
        const specs: Record<string, string> = {};
        $('table tr').each((_, row) => {
            const key = $(row).find('td').eq(0).text().trim();
            const val = $(row).find('td').eq(1).text().trim();
            if (key && val) specs[key] = val;
        });

        const gender = normalizeGender(specs['Пол'] || 'Unknown');
        const age = normalizeAge(specs['Возраст'] || 'Unknown');
        const rawBrand = specs['Бренд'] || guessBrandFromPage($);
        const brand = capitalizeFirstLetter(rawBrand);
        const rawColor = normalizeColor(specs['Боја'] || 'Unknown');
        const color = capitalizeFirstLetter(rawColor);
        const priceMKD = extractPrice($);

        const uniqueKey = `${code.toLowerCase()}::${brand.toLowerCase()}::${subcategory.toLowerCase()}::${gender.toLowerCase()}::${age.toLowerCase()}::${color.toLowerCase()}`;
        const id = createId(uniqueKey);
        const now = dayjs();
        const latinOnlyName = name
            .replace(/[^\x00-\x7F]+/g, ' ') 
            .replace(/\s+/g, ' ')         
            .trim();

        name = latinOnlyName;

        const product = {
            id,
            name,
            brand,
            category,
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

        await this.db.upsertProduct(product);
        await this.db.addPriceHistory(id, STORE, priceMKD, now.toDate());
    }

    private async fetch(url: string): Promise<string | null> {
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)',
                    'Accept-Language': 'mk,en;q=0.8',
                },
                timeout: 20000,
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
