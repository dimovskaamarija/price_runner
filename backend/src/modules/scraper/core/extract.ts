import type { CheerioAPI } from 'cheerio';
import type { RawLabels } from '../../../database/entities/offer.entity';
import type { StructuredData } from './types';

/**
 * Parse prices in any of the formats seen on Macedonian shops:
 * "6.799,00 ден.", "12.990 MKD", "7990.00", "1 299", "999 ден".
 */
export function parsePrice(input?: string | number | null): number | null {
    if (input == null) return null;
    if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? Math.round(input) : null;
    const m = input.replace(/ /g, ' ').match(/\d[\d.,\s]*/);
    if (!m) return null;
    let n = m[0].replace(/\s/g, '').replace(/[.,]$/, '');
    n = n.replace(/[.,]\d{1,2}$/, ''); // drop decimals
    n = n.replace(/[.,]/g, ''); // thousands separators
    const v = parseInt(n, 10);
    return Number.isFinite(v) && v >= 50 && v < 1_000_000 ? v : null;
}

export function absoluteUrl(src: string | undefined | null, base: string): string | null {
    if (!src) return null;
    try {
        return new URL(src.trim(), base).toString();
    } catch {
        return null;
    }
}

export function cleanText(s?: string | null): string {
    return (s || '').replace(/\s+/g, ' ').trim();
}

export function latinOnly(name: string): string {
    return name
        .normalize('NFKC')
        .replace(/[^\x00-\x7F]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** schema.org Product from JSON-LD, then OpenGraph/product meta and microdata as fallbacks. */
export function readStructuredData($: CheerioAPI, pageUrl: string): StructuredData {
    const out: StructuredData = {};

    $('script[type="application/ld+json"]').each((_, el) => {
        if (out.name) return;
        let data: any;
        try {
            data = JSON.parse($(el).contents().text());
        } catch {
            return; // commented-out templates etc.
        }
        const product = findProduct(data);
        if (!product) return;
        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        const image = Array.isArray(product.image) ? product.image[0] : product.image?.url || product.image;
        out.name = cleanText(product.name) || undefined;
        out.brand = cleanText(typeof product.brand === 'string' ? product.brand : product.brand?.name) || undefined;
        out.sku = cleanText(product.sku || product.mpn || product.productID) || undefined;
        out.price = parsePrice(offers?.price ?? offers?.lowPrice);
        out.image = absoluteUrl(image, pageUrl) || undefined;
        out.color = cleanText(product.color) || undefined;
        out.category = cleanText(product.category) || undefined;
    });

    const meta = (p: string) => $(`meta[property="${p}"], meta[name="${p}"]`).attr('content');
    out.name ||= cleanText($('[itemprop="name"]').first().text()) || undefined;
    out.price ??= parsePrice(meta('product:price:amount') || $('[itemprop="price"]').attr('content'));
    out.brand ||= cleanText(meta('product:brand') || $('[itemprop="brand"]').first().text()) || undefined;
    out.sku ||= cleanText($('[itemprop="sku"]').first().attr('content') || $('[itemprop="sku"]').first().text()) || undefined;
    if (meta('og:type') === 'product') {
        out.name ||= cleanText(meta('og:title')) || undefined;
        out.image ||= absoluteUrl(meta('og:image'), pageUrl) || undefined;
    }
    return out;
}

function findProduct(data: any): any {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data)) {
        for (const d of data) {
            const p = findProduct(d);
            if (p) return p;
        }
        return null;
    }
    const type = data['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return data;
    if (data['@graph']) return findProduct(data['@graph']);
    return null;
}

/** Collect "key -> value" pairs from spec tables, definition lists and "Key: value" list items. */
export function readSpecs($: CheerioAPI): Record<string, string> {
    const specs: Record<string, string> = {};
    const put = (k: string, v: string) => {
        const key = cleanText(k).replace(/:$/, '');
        const val = cleanText(v);
        if (key && val && key.length < 40 && val.length < 200 && !(key in specs)) specs[key] = val;
    };
    $('table tr').each((_, tr) => {
        const cells = $(tr).find('td, th');
        if (cells.length === 2) put(cells.eq(0).text(), cells.eq(1).text());
    });
    $('dl').each((_, dl) => {
        $(dl).find('dt').each((_, dt) => put($(dt).text(), $(dt).next('dd').text()));
    });
    $('li').each((_, li) => {
        const t = cleanText($(li).text());
        const m = t.match(/^([^:]{2,30}):\s*(.{1,120})$/);
        if (m) put(m[1], m[2]);
    });
    return specs;
}

const SPEC_KEYS: Record<keyof Omit<RawLabels, 'breadcrumbs'> | 'brand' | 'code', string[]> = {
    category: ['категорија', 'category', 'група'],
    subcategory: ['подгрупа', 'производ', 'тип', 'вид', 'type', 'product type', 'subcategory'],
    gender: ['пол', 'gender', 'за'],
    age: ['возраст', 'age', 'starost'],
    color: ['боја', 'color', 'colour'],
    brand: ['бренд', 'brand', 'марка', 'производител'],
    code: ['код на производ', 'шифра на производ', 'шифра', 'код', 'sku', 'article', 'артикл', 'product code', 'style'],
};

/** Map common spec keys (Macedonian/English) to raw labels. */
export function labelsFromSpecs(specs: Record<string, string>) {
    const lower = Object.fromEntries(Object.entries(specs).map(([k, v]) => [k.toLowerCase(), v]));
    const pick = (keys: string[]) => keys.map((k) => lower[k]).find(Boolean);
    return {
        labels: {
            category: pick(SPEC_KEYS.category),
            subcategory: pick(SPEC_KEYS.subcategory) || pick(SPEC_KEYS.category),
            gender: pick(SPEC_KEYS.gender),
            age: pick(SPEC_KEYS.age),
            color: pick(SPEC_KEYS.color),
        } as RawLabels,
        brand: pick(SPEC_KEYS.brand),
        code: pick(SPEC_KEYS.code),
    };
}

export function readBreadcrumbs($: CheerioAPI, selector = '.breadcrumbs a, .breadcrumb a, nav[aria-label="breadcrumb"] a'): string[] {
    return $(selector)
        .map((_, a) => cleanText($(a).text()))
        .get()
        .filter((t) => t && t.length < 60);
}

/** Drop undefined/empty values so object spreads don't overwrite real data. */
export function compact<T extends object>(o: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)),
    ) as Partial<T>;
}
