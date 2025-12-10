import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../../database/postgres.service';
import { createId } from '../../../common/hashing';
import { normalizeGender, normalizeAge, normalizeColor, normalizeSubcategory, capitalizeFirstLetter } from '../utils/normalize_data';

const STORE = 'Sizeer MK';

@Injectable()
export class SizeerScraper {
    private readonly log = new Logger(SizeerScraper.name);
    private readonly limit = pLimit(4);

    constructor(private readonly db: PostgresService) {}

    async scrapeCategory(baseUrl: string, topCategory: string) {
        for (let page = 1; page <= 12; page++) {
            const url = `${baseUrl}&PageNumber=${page}`;
            const html = await this.fetch(url);
            if (!html) break;

            const $ = cheerio.load(html);
            const pdps = new Set<string>();
            $('a[href*="/ProductDetails?ProductID="]').each((_, a) => {
                const href = $(a).attr('href');
                if (href && href.includes('ProductID=')) {
                    pdps.add(new URL(href, baseUrl).toString());
                }
            });

            if (pdps.size === 0) {
                this.log.log(`No products on page ${page}, stopping.`);
                break;
            }

            this.log.log(`Page ${page}: ${pdps.size} products`);
            await Promise.all([...pdps].map((href) =>
                this.limit(() => this.scrapePdp(href, topCategory)),
            ));
        }
    }

    private async scrapePdp(productUrl: string, topCategory: string) {
        const html = await this.fetch(productUrl);
        if (!html) return;

        const $ = cheerio.load(html);
        const name = $('h2.details_description').first().text().trim();

        const productIdMatch = productUrl.match(/ProductID=([^&]+)/);
        const productId = productIdMatch?.[1] || '';

        const image = `https://www.sizeer.com.mk/ProductImages/${productId}.jpg`;
        const features: string[] = [];
        $('#ow-feature-name ul li').each((_, li) => {
            const text = $(li).text().trim();
            if (text) features.push(text);
        });

        const age = normalizeAge(features[0] || 'Unknown');
        const code =
            $('.ow-colors-text')
                .text()
                .replace('Шифра на производ:', '')
                .trim() ||
            productId ||
            'Unknown';
        const gender = normalizeGender(features[1] || 'Unknown');
        const rawColor = normalizeColor(features[2] || 'Unknown');
        const color = capitalizeFirstLetter(rawColor);
        const subcategory = normalizeSubcategory(features[4] || topCategory);
        const rawBrand = features[6] || guessBrandFromPage($);
        const brand = capitalizeFirstLetter(rawBrand);
        const priceMKD = extractPrice($);
        const uniqueKey = `${code.toLowerCase()}::${brand.toLowerCase()}::${subcategory.toLowerCase()}::${gender.toLowerCase()}::${age.toLowerCase()}::${color.toLowerCase()}`;
        const id = createId(uniqueKey);
        const now = dayjs();

        const product = {
            id,
            name,
            brand,
            category: topCategory,
            subcategory,
            gender,
            age,
            color,
            image,
            priceMap: { [STORE]: priceMKD ?? null },
            storeLinks: { [STORE]: productUrl },
            productUrl,
            currency: 'MKD',
            createdAt: now.toDate(),
            updatedAt: now.toDate(),
        };

        await this.db.upsertProduct(product, STORE, priceMKD, now.toDate());
    }

    private async fetch(url: string): Promise<string | null> {
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)',
                    'Accept-Language': 'mk,en;q=0.8',
                },
                timeout: 55000,
            });
            return res.data as string;
        } catch (e) {
            this.log.warn(`Product list fetch failed: ${url} -> ${(e as Error).message}`);
            return null;
        }
    }
}

function extractPrice($: cheerio.CheerioAPI): number | null {
    let priceText =
        $('.price-withdiscount-product-details').first().text().trim() ||
        $('.normal-price').first().text().trim();

    if (!priceText) return null;

    const m = priceText.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)/);
    if (!m) return null;

    const normalized = m[1].replace(/[.\s]/g, '');
    return parseInt(normalized, 10);
}

function guessBrandFromPage($: cheerio.CheerioAPI): string {
    const h2 = $('h2.details_description').first().text().trim();
    const first = h2.split(/\s+/)[0];
    return first.length > 1 ? first : 'Unknown';
}
