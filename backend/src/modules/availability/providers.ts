import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Live in-store stock lookups against each chain's own "find in store" feature.
 * Only called when a visitor asks (results are cached by AvailabilityService).
 */

export interface ChainSize {
    size: string;
    /** Chain's own stock hint, e.g. "Последните парчиња". */
    level?: string;
    /** Opaque data needed to ask this chain about this size later. */
    ref?: Record<string, string>;
}

/** Shops (as store_locations ids) that have the size, or the reason there are none. */
export interface ShopsForSize {
    locationIds: string[];
    onlineOnly?: boolean;
}

export interface AvailabilityProvider {
    /** Sizes this chain lists for the product; `shops` is filled when one request returns everything. */
    sizes(offerUrl: string): Promise<{ sizes: ChainSize[]; shopsBySize?: Record<string, string[]> }>;
    /** Shops that have one size (only for chains that need a request per size). */
    shopsForSize?(offerUrl: string, size: ChainSize): Promise<ShopsForSize>;
}

const http = axios.create({
    timeout: 20_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)', 'Accept-Language': 'mk,en;q=0.8' },
});

const form = (data: Record<string, string>) => new URLSearchParams(data).toString();
const clean = (s?: string | null) => (s || '').replace(/\s+/g, ' ').trim();

/** "38,5" -> "38.5", "41-1/3" -> "41 1/3", "xl" -> "XL" so sizes from different chains line up. */
export function normalizeSize(s: string): string {
    return clean(s)
        .replace(/\\\//g, '/')
        .replace(',', '.')
        .replace(/^(\d+)\s*-\s*(\d)\/(\d)$/, '$1 $2/$3')
        .toUpperCase();
}

/** Numeric value of a shoe size, including thirds ("41 1/3" -> 41.33); NaN for letter sizes. */
export function sizeValue(s: string): number {
    const m = s.match(/^(\d+(?:\.\d+)?)(?:\s+(\d)\/(\d))?$/);
    return m ? parseFloat(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0) : NaN;
}

// ------------------------------------------------------------------ nbshop: Sport Vision, Sport Reality, Buzz

/**
 * Two steps, mirroring the chain's own widget:
 *   task=searchproductsapcar          -> sizes with a stock hint
 *   task=checksizeavailabilityinsapcar -> shops that have the chosen size
 */
function nbshop(store: string): AvailabilityProvider {
    // The endpoint (e.g. /mk/pronajdivosv, /mk/pronadjiubuzz) and product code are read from the product page.
    const context = async (offerUrl: string) => {
        const html: string = (await http.get(offerUrl)).data;
        const m = html.match(/searchProductDataTabSapCar\('([^']+)',\s*'([^']+)'\)/);
        if (!m) throw new Error('availability widget not found on product page');
        return { endpoint: m[1], code: m[2] };
    };
    const post = async (endpoint: string, referer: string, data: Record<string, string>) => {
        const res = await http.post(endpoint, form({ ...data, returnType: 'json', tabview: 'yes', ajax: 'yes' }), {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                Referer: referer,
            },
        });
        if (!res.data?.flag) throw new Error('unexpected response');
        return String(res.data.info || '');
    };

    return {
        async sizes(offerUrl) {
            const { endpoint, code } = await context(offerUrl);
            const $ = cheerio.load(await post(endpoint, offerUrl, { task: 'searchproductsapcar', search: code }));
            const sizes: ChainSize[] = [];
            $('li[onclick*="checkSizeAvailabilityInSapCar"]').each((_, li) => {
                const args = ($(li).attr('onclick') || '').match(/\(\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*(\d+)/);
                const size = clean($(li).find('.size-name').first().text());
                if (!args || !size) return;
                sizes.push({
                    size: normalizeSize(size),
                    level: clean($(li).find('.size-number').first().text()) || undefined,
                    ref: { endpoint: args[1], productId: args[2], productCode: args[3], combId: args[4] },
                });
            });
            return { sizes };
        },

        async shopsForSize(offerUrl, size) {
            const r = size.ref!;
            const html = await post(r.endpoint, offerUrl, {
                task: 'checksizeavailabilityinsapcar',
                productId: r.productId,
                productCode: r.productCode,
                id: r.combId,
            });
            if (/само за online/i.test(html)) return { locationIds: [], onlineOnly: true };
            const $ = cheerio.load(html);
            const ids = new Set<string>();
            $('.store-content a[href*="/prodavnici/"]').each((_, a) => {
                const id = ($(a).attr('href') || '').match(/\/prodavnici\/(\d+)-/)?.[1];
                if (id) ids.add(`${store}:${id}`);
            });
            return { locationIds: [...ids] };
        },
    };
}

// ------------------------------------------------------------------ OW catalog: Sizeer, Sport M

/** One request returns every shop with its available sizes. */
function owCatalog(store: string): AvailabilityProvider {
    return {
        async sizes(offerUrl) {
            const url = new URL(offerUrl);
            const productId = url.searchParams.get('ProductID');
            if (!productId) throw new Error('no ProductID in product URL');
            const res = await http.post(`${url.origin}/ProductCatalog/GetMagaciniVelicini`, form({ productID: productId }), {
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const rows: any[] = Array.isArray(res.data) ? res.data : [];
            const shopsBySize: Record<string, string[]> = {};
            for (const row of rows) {
                // Shop id comes from its image, e.g. "/StoreImages/52.jpg" -> "Sizeer MK:52".
                const shopId = String(row.SlikaIme || '').match(/StoreImages\/([^./]+)\./)?.[1];
                if (!shopId || /е\s*продавница|online/i.test(String(row.Magacin))) continue; // web shop, not physical
                for (const raw of String(row.Velicini || '').split(',')) {
                    const size = normalizeSize(raw);
                    if (!size) continue;
                    (shopsBySize[size] ||= []).push(`${store}:${shopId}`);
                }
            }
            return { sizes: Object.keys(shopsBySize).map((size) => ({ size })), shopsBySize };
        },
    };
}

// ------------------------------------------------------------------ Magento (D Sport)

/**
 * The product page itself lists the shops per size: `.warehouse-list[data-size-id]` with links
 * to /lokacije/<code>/, and the size labels are in the swatch config. Shops are returned as
 * "url:<link>" and matched to store_locations by URL.
 */
function magento(): AvailabilityProvider {
    return {
        async sizes(offerUrl) {
            const html: string = (await http.get(offerUrl)).data;
            const $ = cheerio.load(html);

            const labels = new Map<string, string>();
            for (const m of html.matchAll(/"(\d+)":\{"type":"\d+","value":"[^"]*","label":"([^"]*)"/g)) {
                const label = normalizeSize(m[2]);
                if (/\d|^(\d?X{0,3}[SML]|\d?XL)$/.test(label)) labels.set(m[1], label);
            }

            const shopsBySize: Record<string, string[]> = {};
            $('.warehouse-list[data-size-id]').each((_, el) => {
                const size = labels.get(String($(el).attr('data-size-id')));
                if (!size) return;
                const refs = $(el)
                    .find('a[href*="/lokacije/"]')
                    .map((__, a) => `url:${($(a).attr('href') || '').trim()}`)
                    .get();
                if (refs.length) shopsBySize[size] = [...new Set(refs)];
            });
            // Every size the product has, so sizes without shops can be shown as unavailable.
            const sizes = [...new Set(labels.values())].map((size) => ({ size }));
            return { sizes, shopsBySize };
        },
    };
}

/** Chains whose shops can be queried. */
export const AVAILABILITY_PROVIDERS: Record<string, AvailabilityProvider> = {
    'Sport Vision MK': nbshop('Sport Vision MK'),
    'Sport Reality MK': nbshop('Sport Reality MK'),
    'Buzz Sneakers MK': nbshop('Buzz Sneakers MK'),
    'Sizeer MK': owCatalog('Sizeer MK'),
    'Sport M': owCatalog('Sport M'),
    'D Sport': magento(),
};
