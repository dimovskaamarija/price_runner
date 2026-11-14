import type { CheerioAPI } from 'cheerio';
import type { RawLabels } from '../../../database/entities/offer.entity';

/** What a scraper extracts from one product page. No classification happens here. */
export interface ScrapedListing {
    url: string;
    name: string;
    brand?: string;
    /** Manufacturer style code / SKU — the key for cross-store matching. */
    code?: string;
    price: number | null;
    image?: string | null;
    labels: RawLabels;
    hints?: RawLabels;
}

/** Fields found in schema.org JSON-LD / OpenGraph / microdata, available to every extractor. */
export interface StructuredData {
    name?: string;
    brand?: string;
    sku?: string;
    price?: number | null;
    image?: string;
    color?: string;
    category?: string;
}

export interface ExtractContext {
    $: CheerioAPI;
    url: string;
    site: SiteConfig;
    structured: StructuredData;
    /** Key/value specification pairs found on the page (tables, dl, "Key: value" lists). */
    specs: Record<string, string>;
}

export type Extractor = (ctx: ExtractContext) => Partial<ScrapedListing>;

export interface StartPage {
    url: string;
    /** Facts implied by the listing page (e.g. the "Women / Shoes" section). */
    hints?: RawLabels;
}

/**
 * Declarative description of a store. Adding a new website = adding one of these to
 * `sites.config.ts`. Classification and cross-store matching are automatic.
 */
export interface SiteConfig {
    /** Store name, shown in the UI and used as the offer key. Must stay stable. */
    store: string;
    enabled?: boolean;
    startPages: StartPage[];
    /** Build the URL for listing page N (1-based) from a start page URL. */
    pageUrl: (startUrl: string, page: number) => string;
    /** How to find product links on a listing page. */
    productLinks: { selector?: string; pattern?: RegExp };
    /** Platform-specific extractor; omit to rely on the generic one (JSON-LD/OpenGraph/specs + `selectors`). */
    extractor?: Extractor;
    /** CSS selectors for the generic extractor (used for any field the extractor/structured data didn't find). */
    selectors?: Partial<Record<'name' | 'price' | 'image' | 'brand' | 'code' | 'breadcrumbs', string>>;
    /** Strip non-Latin words from product names (some stores mix Cyrillic category words into names). */
    latinNames?: boolean;
    concurrency?: number;
    maxPages?: number;
    timeoutMs?: number;
}
