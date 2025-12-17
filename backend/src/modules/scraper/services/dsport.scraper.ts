import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import dayjs from 'dayjs';
import { Injectable, Logger } from '@nestjs/common';
import { PostgresService } from '../../../database/postgres.service';
import { createId } from '../../../common/hashing';
import { normalizeGender, normalizeAge, normalizeColor, normalizeSubcategory, capitalizeFirstLetter } from '../utils/normalize_data';

type Gender = 'Машки' | 'Женски' | 'Унисекс' | 'Kids';

const STORE = 'D Sport';

@Injectable()
export class DSportScraper {
    private readonly log = new Logger(DSportScraper.name);
    private readonly limit = pLimit(4);

    constructor(private readonly db: PostgresService) {}

    private readonly CATEGORIES: Array<{ url: string; category: string; gender: Gender }> = [
        { url: 'https://www.dsport.mk/muskarci/obuca', category: 'Обувки', gender: 'Машки' },
        { url: 'https://www.dsport.mk/zene/obuca', category: 'Обувки', gender: 'Женски' },
        { url: 'https://www.dsport.mk/deca/obuca', category: 'Обувки', gender: 'Kids' },
        { url: 'https://www.dsport.mk/muskarci/odeca', category: 'Текстил', gender: 'Машки' },
        { url: 'https://www.dsport.mk/zene/odeca', category: 'Текстил', gender: 'Женски' },
        { url: 'https://www.dsport.mk/deca/odeca', category: 'Текстил', gender: 'Kids' },
        { url: 'https://www.dsport.mk/oprema', category: 'Опрема', gender: 'Унисекс' },
        { url: 'https://www.dsport.mk/muskarci/oprema', category: 'Опрема', gender: 'Машки' },
        { url: 'https://www.dsport.mk/zene/oprema', category: 'Опрема', gender: 'Женски' },
        { url: 'https://www.dsport.mk/deca/oprema', category: 'Опрема', gender: 'Kids' },
    ];

    async scrapeAll() {
        for (const { url, category, gender } of this.CATEGORIES) {
            await this.scrapeCategory(url, category, gender);
        }
    }

    async scrapeCategory(baseUrl: string, category: string, gender: Gender) {
        for (let page = 1; page <= 50; page++) {
            const pageUrl = page === 1 ? baseUrl : `${baseUrl}?p=${page}`;
            this.log.log(`[DSport] ${category}/${gender} – fetching page ${page}`);
            const html = await this.fetch(pageUrl);
            if (!html) break;

            const $ = cheerio.load(html);
            const productLinks = this.extractProductLinksFromCategory($);

            if (productLinks.length === 0) {
                this.log.warn(`[DSport] No products on page ${page}; stopping pagination.`);
                break;
            }

            await Promise.all(
                productLinks.map(link =>
                    this.limit(() => this.scrapePdp(link, category, gender)),
                )
            );
        }
    }

    private async scrapePdp(productUrl: string, categoryIn: string, genderIn: Gender) {
        try {
            const html = await this.fetch(productUrl);
            if (!html) return;
            const $ = cheerio.load(html);
            const rawName =
                $('h1.page-title span.base').first().text().trim() ||
                $('h1.page-title').first().text().trim() ||
                $('h1').first().text().trim();
          let name = rawName
  .normalize('NFKC')
  .replace(/[^\x00-\x7F]+/g, ' ')        
  .replace(/[^A-Za-z0-9&/+.\- ]+/g, ' ') 
  .replace(/\s+/g, ' ')                 
  .trim();

if (!name) {
  const last = productUrl.split('/').pop() || '';
  const slugSource = decodeURIComponent(last)       
    .replace(/\.(html?|php|aspx)$/i, '')            
    .replace(/[-_]+/g, ' ');                   

  name = slugSource
    .normalize('NFKC')
    .replace(/[^\x00-\x7F]+/g, ' ')
    .replace(/[^A-Za-z0-9&/+.\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown';
}
            const specs = this.parseSpecs($);
            const rawBrand =
                (specs['Бренд'] || '').trim() ||
                $('div.product-info-main a[href*="/brands"], a[href*="/brand"]').first().text().trim() ||
                this.guessBrandFromName(name);
            const brand = capitalizeFirstLetter(rawBrand);
            const code =
                $('div.product.attribute.sku .value').first().text().trim() ||
                specs['Шифра на производ'] ||
                'Unknown';
            const category = categoryIn;
            const subcategory = normalizeSubcategory(specs['Производ']);
            const gender = normalizeGender((specs['Пол'] || '').trim());
            const age = normalizeAge(genderIn === 'Kids' ? 'За деца' : 'За возрасни');
            const rawColor = (specs['Боја'] || '').trim() || this.extractColorFromName(name) || 'Unknown';
            var color = normalizeColor(rawColor.toLowerCase());
            color = capitalizeFirstLetter(color);
            const image = this.extractDsportImage($);
            const price = this.extractPriceFromPdp($);
            if (price == null) {
                this.log.warn(`[DSport] Skipping (no price): ${productUrl}`);
                return;
            }
            const uniqueKey = `${code.toLowerCase()}::${brand.toLowerCase()}::${subcategory.toLowerCase()}::${gender.toLowerCase()}::${age.toLowerCase()}::${color.toLowerCase()}`;
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
        } catch (error) {
            this.log.error(`Error scraping PDP ${productUrl}:`, error.message);
        }
    }
    private keepLatinWords(input: string): string {
        if (!input) return '';
        const tokens = input.split(/\s+/);
        const latinWord = /^[\p{Script=Latin}0-9'.,()\-]+$/u;
        const kept = tokens.filter(t => latinWord.test(t));
        return kept.join(' ').replace(/\s{2,}/g, ' ').trim();
    }
    private parseSpecs($: cheerio.CheerioAPI): Record<string, string> {
        const specs: Record<string, string> = {};
        $('table.technical-specifications-options tr').each((_, tr) => {
            const key = $(tr).find('td strong').first().text().replace(':', '').trim();
            const val = $(tr).find('td').eq(1).find('p').last().text().trim();
            if (key && val) specs[key] = val;
        });
        return specs;
    }

    private ensureAbsolute(url?: string | null): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return `https:${url}`;
    return `https://www.dsport.mk${url.startsWith('/') ? '' : '/'}${url}`;
}

private extractDsportImage($: cheerio.CheerioAPI): string | null {
    const src = $('img.fotorama__img').first().attr('src')
        || $('img.fotorama__img').first().attr('data-src');
    const og = $('meta[property="og:image"]').attr('content');

    return this.ensureAbsolute(src || og || null);
}
    private extractPriceFromPdp($: cheerio.CheerioAPI): number | null {
        let text: string | null =
            $('.product-info-price .special-price .price').first().text().trim() ||
            $('.price-wrapper .price').first().text().trim() ||
            $('.product-info-price .price-final_price .price').first().text().trim() ||
            $('.product-info-price .price').first().text().trim() ||
            $('body').text().match(/([\d\.\s,]+)\s*ден/i)?.[0] ||
            null;

        if (!text) return null;

        text = text.replace(/ден\.?|МКД|%/gi, '').replace(/[^\d.,\s]/g, '').trim();
        const match = text.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)/);
        if (!match) return null;

        const normalized = match[1].replace(/[.\s]/g, '');
        const val = parseInt(normalized, 10);
        if (isNaN(val) || val < 300) return null;
        return val;
    }
    private guessBrandFromName(name: string): string {
        const first = (name || '').trim().split(/\s+/)[0] || '';
        return first.length > 1 ? first : 'Unknown';
    }
    private extractColorFromName(name: string): string | null {
        const m = name.match(/\b(Black|White|Red|Blue|Green|Grey|Gray|Pink|Beige|Brown|Navy|Olive|Yellow)\b/i);
        return m ? m[0] : null;
    }
    private extractProductLinksFromCategory($: cheerio.CheerioAPI): string[] {
        const links: string[] = [];
        $('a.product-item-link').each((_, el) => {
            const href = ($(el).attr('href') || '').split('?')[0];
            if (href && href.startsWith('https://www.dsport.mk/')) links.push(href);
        });
        if (links.length === 0) {
            $('a[href*="/muskarci/"], a[href*="/zene/"], a[href*="/deca/"], a[href*="/oprema/"]').each((_, el) => {
                const href = ($(el).attr('href') || '').split('?')[0];
                if (href && /\/(muskarci|zene|deca|oprema)\//.test(href) && href.split('/').length > 4) {
                    links.push(href);
                }
            });
        }

        return Array.from(new Set(links));
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
            this.log.warn(`[DSport] Fetch failed: ${url} -> ${(e as Error).message}`);
            return null;
        }
    }
}
