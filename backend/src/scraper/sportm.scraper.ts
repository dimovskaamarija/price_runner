import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service';
import { createId } from '../common/hashing';
import { normalizeGender, normalizeAge, normalizeColor, normalizeSubcategory } from '../utils/normalize_data';

const STORE = 'Sport M';

@Injectable()
export class SportMScraper {
    private readonly log = new Logger(SportMScraper.name);
    private readonly limit = pLimit(4);

    constructor(private readonly db: PostgresService) {}

    private readonly CATEGORIES = [
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=03&Grupa=01', category: 'Обувки', gender: 'Машки' },
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=04&Grupa=01', category: 'Обувки', gender: 'Женски' },
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=05&Grupa=01', category: 'Обувки', gender: 'Унисекс' },
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=03&Grupa=02', category: 'Текстил', gender: 'Машки' },
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=04&Grupa=02', category: 'Текстил', gender: 'Женски' },
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=05&Grupa=02', category: 'Текстил', gender: 'Унисекс' },
        { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=06', category: 'Опрема', gender: 'Унисекс' },
    ];

    async scrapeAll() {
        this.log.log(`Starting Sport M scrape for ${this.CATEGORIES.length} categories`);
        for (const { url, category, gender } of this.CATEGORIES) {
            this.log.log(`Scraping Sport M: ${category} (${gender})`);
            try {
                await this.scrapeCategory(url, category, gender);
            } catch (error) {
                this.log.error(`Error scraping Sport M ${category}/${gender}:`, error.message);
            }
        }
        this.log.log('Sport M scrape completed');
    }

    async scrapeCategory(baseUrl: string, category: string, gender: string) {
        for (let page = 1; page <= 10; page++) {
            const pageUrl = `${baseUrl}&Page=${page}`;
            this.log.log(`Scraping URL: ${pageUrl}`);
            this.log.log(`Fetching ${category} - Page ${page}`);
            const html = await this.fetch(pageUrl);
            if (!html) break;

            const $ = cheerio.load(html);
            const productLinks: string[] = [];
            $('.product-preview__image a').each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('ProductID=')) {
                    productLinks.push(`https://www.sport-m.com.mk${href}`);
                }
            });

            if (productLinks.length === 0) {
                this.log.warn(`No products on page ${page}, stopping.`);
                break;
            }

            await Promise.all(
                productLinks.map(link =>
                    this.limit(() => this.scrapePdp(link, category, gender)),
                )
            );
        }
    }

    private async scrapePdp(productUrl: string, category: string, gender: string) {
        const html = await this.fetch(productUrl);
        if (!html) return;

        const $ = cheerio.load(html);
        const name = $('h2.details_description').first().text().trim();
        const productIdMatch = productUrl.match(/ProductID=([^&]+)/);
        const productId = productIdMatch?.[1] || 'UNKNOWN';
        const image = `https://www.sport-m.com.mk/ProductImages/${productId}.jpg`;

        const spec: Record<string, string> = {};
        $('#collapseOpis ul li').each((_, li) => {
            const key = $(li).find('.opis').text().trim();
            const value = $(li).find('span').last().text().trim();
            spec[key] = value;
        });

        const age = normalizeAge(spec['Возраст']);
        const color = normalizeColor(spec['Боја']);
        const subcategory = normalizeSubcategory(spec['Подгрупа'] || category);
        const brand = spec['Бренд'] || this.guessBrandFromName(name);
        gender = normalizeGender(gender);

        const price = this.extractPrice($);

        const uniqueKey = `${name.toLowerCase()}::${brand.toLowerCase()}::${subcategory.toLowerCase()}::${gender.toLowerCase()}::${age.toLowerCase()}::${color.toLowerCase()}`;
        const id = createId(uniqueKey);
        const now = dayjs();

        const product = {
            id,
            name,
            brand,
            category,
            subcategory,
            gender,
            age,
            color,
            image,
            priceMap: { [STORE]: price ?? null },
            storeLinks: { [STORE]: productUrl },
            productUrl,
            currency: 'MKD',
            createdAt: now.toDate(),
            updatedAt: now.toDate(),
        };

        await this.db.upsertProduct(product, STORE, price, now.toDate());
    }

   private extractPrice($: cheerio.CheerioAPI): number | null {
    let priceText: string | null = null;
    const discountSpans = $('span.price-withdiscount[id$="Price"]');
    if (discountSpans.length > 0) {
        priceText = discountSpans.first().text().trim();
    }
    if (!priceText) {
        const normal = $('div.normal-price[id$="Price"]').first().text().trim();
        if (normal) priceText = normal;
    }

    if (!priceText) return null;
    priceText = priceText
        .replace(/ден\.?|МКД|%/gi, '')
        .replace(/[^\d.,]/g, '')
        .trim();
    const match = priceText.match(/(\d{1,3}(?:[.,\s]\d{3})*|\d+)/);
    if (!match) return null;

    const normalized = match[1].replace(/[.\s]/g, '');
    const price = parseInt(normalized, 10);
    if (price < 500) return null;

    return price;
}


    private guessBrandFromName(name: string): string {
        const first = name.split(/\s+/)[0];
        return first.length > 1 ? first : 'Unknown';
    }

    private async fetch(url: string): Promise<string | null> {
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)',
                    'Accept-Language': 'mk,en;q=0.8',
                },
                timeout: 30000,
            });
            return res.data as string;
        } catch (e) {
            this.log.warn(`Fetch failed: ${url} -> ${(e as Error).message}`);
            return null;
        }
    }
}
