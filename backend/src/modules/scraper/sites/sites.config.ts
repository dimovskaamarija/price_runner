import type { SiteConfig, StartPage } from '../core/types';
import { magentoExtractor, nbshopExtractor, owCatalogExtractor } from './platforms';

/**
 * ─── Adding a new website ──────────────────────────────────────────────────────
 * 1. Add a SiteConfig below: start pages, how to paginate, how to find product links.
 * 2. If the shop runs on a platform listed in platforms.ts, reuse its extractor.
 *    Otherwise omit `extractor`: JSON-LD / OpenGraph / spec tables are read
 *    automatically, and `selectors` can fill any gaps.
 * 3. That's it. Categories, gender, age and color are classified automatically
 *    (rules -> learned mappings -> Gemini) and offers are matched to existing
 *    products from other stores by model code / similarity.
 * Test a single site with:  GET /scraper/preview?store=<store>&limit=5
 * ───────────────────────────────────────────────────────────────────────────────
 */

const nbshopPages = (base: string): StartPage[] => [
    { url: `${base}/mk/obuvki`, hints: { category: 'Обувки' } },
    { url: `${base}/mk/tekstil`, hints: { category: 'Текстил' } },
    { url: `${base}/mk/oprema`, hints: { category: 'Опрема' } },
];
const nbshopPaging = (start: string, page: number) => (page === 1 ? start : `${start}/page-${page}`);
/** nbshop product URLs look like /mk/patiki/8738149-nike-dunk-se */
const NBSHOP_PDP = /\/mk\/[a-z0-9-]+\/\d{5,}-[a-z0-9-]+\/?$/i;

export const SITES: SiteConfig[] = [
    {
        store: 'Sport Vision MK',
        startPages: nbshopPages('https://www.sportvision.mk'),
        pageUrl: nbshopPaging,
        productLinks: { pattern: NBSHOP_PDP },
        extractor: nbshopExtractor,
    },
    {
        store: 'Sport Reality MK',
        startPages: nbshopPages('https://www.sportreality.mk'),
        pageUrl: nbshopPaging,
        productLinks: { pattern: NBSHOP_PDP },
        extractor: nbshopExtractor,
    },
    {
        store: 'Buzz Sneakers MK',
        startPages: nbshopPages('https://www.buzzsneakers.mk'),
        pageUrl: nbshopPaging,
        productLinks: { pattern: NBSHOP_PDP },
        extractor: nbshopExtractor,
        latinNames: true,
    },
    {
        store: 'Sizeer MK',
        startPages: ['51', '52', '53'].flatMap((segment) => [
            { url: `https://www.sizeer.com.mk/ProductCatalog?Segment=${segment}&Grupa=01`, hints: { category: 'Обувки' } },
            { url: `https://www.sizeer.com.mk/ProductCatalog?Segment=${segment}&Grupa=02`, hints: { category: 'Текстил' } },
            { url: `https://www.sizeer.com.mk/ProductCatalog?Segment=${segment}&Grupa=03`, hints: { category: 'Опрема' } },
        ]),
        pageUrl: (start, page) => `${start}&PageNumber=${page}`,
        productLinks: { selector: 'a[href*="ProductDetails?ProductID="]' },
        extractor: owCatalogExtractor,
        timeoutMs: 55_000,
    },
    {
        store: 'Sport M',
        startPages: [
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=03&Grupa=01', hints: { category: 'Обувки', gender: 'Машки' } },
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=04&Grupa=01', hints: { category: 'Обувки', gender: 'Женски' } },
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=05&Grupa=01', hints: { category: 'Обувки', gender: 'Унисекс' } },
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=03&Grupa=02', hints: { category: 'Текстил', gender: 'Машки' } },
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=04&Grupa=02', hints: { category: 'Текстил', gender: 'Женски' } },
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=05&Grupa=02', hints: { category: 'Текстил', gender: 'Унисекс' } },
            { url: 'https://www.sport-m.com.mk/ProductCatalog?Segment=06', hints: { category: 'Опрема' } },
        ],
        pageUrl: (start, page) => `${start}&Page=${page}`,
        productLinks: { selector: '.product-preview__image a[href*="ProductID="]' },
        extractor: owCatalogExtractor,
    },
    {
        // Behind Cloudflare: works today, but if a browser challenge is enabled the fetcher
        // detects it, logs "Blocked by anti-bot challenge" and skips the site instead of hanging.
        store: 'D Sport',
        startPages: [
            { url: 'https://www.dsport.mk/muskarci/obuca', hints: { category: 'Обувки', gender: 'Машки', age: 'За возрасни' } },
            { url: 'https://www.dsport.mk/zene/obuca', hints: { category: 'Обувки', gender: 'Женски', age: 'За возрасни' } },
            { url: 'https://www.dsport.mk/deca/obuca', hints: { category: 'Обувки', age: 'За деца' } },
            { url: 'https://www.dsport.mk/muskarci/odeca', hints: { category: 'Текстил', gender: 'Машки', age: 'За возрасни' } },
            { url: 'https://www.dsport.mk/zene/odeca', hints: { category: 'Текстил', gender: 'Женски', age: 'За возрасни' } },
            { url: 'https://www.dsport.mk/deca/odeca', hints: { category: 'Текстил', age: 'За деца' } },
            { url: 'https://www.dsport.mk/muskarci/oprema', hints: { category: 'Опрема', gender: 'Машки' } },
            { url: 'https://www.dsport.mk/zene/oprema', hints: { category: 'Опрема', gender: 'Женски' } },
            { url: 'https://www.dsport.mk/deca/oprema', hints: { category: 'Опрема', age: 'За деца' } },
            { url: 'https://www.dsport.mk/oprema', hints: { category: 'Опрема' } },
        ],
        pageUrl: (start, page) => (page === 1 ? start : `${start}?p=${page}`),
        productLinks: { selector: 'a.product-item-link' },
        extractor: magentoExtractor,
        latinNames: true,
    },
];
