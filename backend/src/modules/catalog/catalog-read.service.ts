import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity';
import { Store } from '../../database/entities/store.entity';
import { ACTIVE_OFFER_SQL, VISIBLE_PRODUCT_SQL } from './maintenance.service';
import { ProductDto, ProductFilters } from './product.dto';
import { GENDERS, SUBCATEGORIES, SUBCATEGORY_NAMES } from './taxonomy';

const CACHE_TTL_MS = 10 * 60 * 1000;
/** Must match the expression of IDX_products_search_trgm exactly so the index is used. */
const SEARCH_EXPR = `lower(coalesce(p.name, '') || ' ' || coalesce(p.brand, '') || ' ' || coalesce(p.subcategory, ''))`;

const SORTS: Record<string, Array<[string, 'ASC' | 'DESC', ('NULLS FIRST' | 'NULLS LAST')?]>> = {
    'price-asc': [['p.minPrice', 'ASC', 'NULLS LAST']],
    'price-desc': [['p.minPrice', 'DESC', 'NULLS LAST']],
    'name-asc': [['p.name', 'ASC']],
    'name-desc': [['p.name', 'DESC']],
    newest: [['p.createdAt', 'DESC']],
    popular: [['p.storeCount', 'DESC'], ['p.minPrice', 'ASC', 'NULLS LAST']],
    'available-desc': [['p.storeCount', 'DESC'], ['p.minPrice', 'ASC', 'NULLS LAST']],
};

/**
 * All read queries for the public API. Filtering, sorting and pagination run in Postgres;
 * only the requested page is loaded and hydrated with its offers.
 */
@Injectable()
export class CatalogReadService {
    private cache = new Map<string, { at: number; value: unknown }>();

    constructor(
        @InjectRepository(Product) private readonly products: Repository<Product>,
        @InjectRepository(Store) private readonly stores: Repository<Store>,
        private readonly dataSource: DataSource,
    ) {}

    invalidateCache() {
        this.cache.clear();
    }

    private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
        const value = await load();
        this.cache.set(key, { at: Date.now(), value });
        return value;
    }

    // ------------------------------------------------------------------ products

    async listProducts(page: number, pageSize: number, sort: string, f: ProductFilters) {
        const qb = this.products.createQueryBuilder('p').where(VISIBLE_PRODUCT_SQL);

        const inFilter = (column: string, values: string[]) => {
            if (values.length) qb.andWhere(`p.${column} IN (:...${column})`, { [column]: values });
        };
        inFilter('category', f.category);
        inFilter('subcategory', f.subcategory);
        inFilter('brand', f.brand);
        inFilter('age', f.age);
        inFilter('gender', f.gender);
        inFilter('color', f.color);

        if (f.minPrice > 0) qb.andWhere('p.minPrice >= :minPrice', { minPrice: f.minPrice });
        if (Number.isFinite(f.maxPrice) && f.maxPrice < 20000) qb.andWhere('p.minPrice <= :maxPrice', { maxPrice: f.maxPrice });

        const words = f.search.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
        words.forEach((w, i) => {
            qb.andWhere(`${SEARCH_EXPR} LIKE :w${i}`, { [`w${i}`]: `%${w.replace(/[\\%_]/g, '\\$&')}%` });
        });

        const order = SORTS[sort] || SORTS['available-desc'];
        order.forEach(([col, dir, nulls], i) => (i === 0 ? qb.orderBy(col, dir, nulls) : qb.addOrderBy(col, dir, nulls)));
        qb.addOrderBy('p.id', 'ASC'); // stable pagination

        const [rows, total] = await qb.skip((page - 1) * pageSize).take(pageSize).getManyAndCount();
        return { items: await this.hydrate(rows), total };
    }

    async getProduct(id: string): Promise<ProductDto | null> {
        const p = await this.products.findOne({ where: { id } });
        if (!p) return null;
        const [dto] = await this.hydrate([p], true);
        return dto;
    }

    async getProductsByIds(ids: string[]): Promise<ProductDto[]> {
        if (!ids.length) return [];
        const rows = await this.products.createQueryBuilder('p').where('p.id IN (:...ids)', { ids }).getMany();
        const byId = new Map((await this.hydrate(rows, true)).map((p) => [p.id, p]));
        return ids.map((id) => byId.get(id)).filter((p): p is ProductDto => !!p);
    }

    /**
     * Attach priceMap/storeLinks from offers. `includeInactive` falls back to the last known
     * offers for products no store currently sells (favorites, direct links).
     */
    async hydrate(products: Product[], includeInactive = false): Promise<ProductDto[]> {
        if (!products.length) return [];
        const offers: Array<{ productId: string; store: string; price: number | null; url: string; active: boolean }> =
            await this.dataSource.query(
                `SELECT o."productId", o.store, o.price, o.url, (${ACTIVE_OFFER_SQL}) AS active
                 FROM offers o WHERE o."productId" = ANY($1)
                 ORDER BY o.price ASC NULLS LAST`,
                [products.map((p) => p.id)],
            );

        const grouped = new Map<string, typeof offers>();
        for (const o of offers) {
            const list = grouped.get(o.productId) || [];
            list.push(o);
            grouped.set(o.productId, list);
        }

        return products.map((p) => {
            const all = grouped.get(p.id) || [];
            const active = all.filter((o) => o.active);
            const shown = active.length || !includeInactive ? active : all;
            const priceMap: Record<string, number | null> = {};
            const storeLinks: Record<string, string> = {};
            for (const o of shown) {
                if (o.store in priceMap) continue; // cheapest listing per store (sorted above)
                priceMap[o.store] = o.price;
                storeLinks[o.store] = o.url;
            }
            return {
                id: p.id,
                name: p.name,
                brand: p.brand,
                category: p.category,
                subcategory: p.subcategory,
                gender: p.gender,
                age: p.age,
                color: p.color,
                image: p.image,
                priceMap,
                storeLinks,
                minPrice: p.minPrice,
                storeCount: p.storeCount,
                productUrl: shown[0]?.url,
                currency: p.currency || 'MKD',
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            };
        });
    }

    // ------------------------------------------------------------------ price history

    /**
     * Daily price series, forward-filled from the change log (history only stores rows when a
     * price changes). `days = null` means all time: from the first recorded price (max 3 years).
     */
    async getPriceHistory(productId: string, days: number | null = 30): Promise<Array<{ store: string; price: number; date: string }>> {
        const rows: Array<{ store: string; price: number; date: string }> = await this.dataSource.query(
            `WITH o AS (
                 SELECT id, store, "lastSeenAt" FROM offers WHERE "productId" = $1
             ),
             start_day AS (
                 SELECT GREATEST(
                     current_date - 1095,
                     CASE WHEN $2::int IS NULL
                          THEN COALESCE((SELECT min(h.date)::date FROM price_history h JOIN o ON o.id = h."offerId"), current_date)
                          ELSE current_date - ($2::int - 1) END
                 ) AS d
             ),
             series AS (
                 SELECT o.store, d::date AS day,
                        (SELECT h.price FROM price_history h
                         WHERE h."offerId" = o.id AND h.date < d + interval '1 day'
                         ORDER BY h.date DESC LIMIT 1) AS price
                 FROM o
                 CROSS JOIN generate_series((SELECT d FROM start_day), current_date, interval '1 day') d
                 WHERE d::date <= o."lastSeenAt"::date
             )
             SELECT store, MIN(price)::int AS price, to_char(day, 'YYYY-MM-DD') AS date
             FROM series WHERE price IS NOT NULL
             GROUP BY store, day
             ORDER BY day, store`,
            [productId, days],
        );
        return rows;
    }

    /** Lowest price across stores per product per day (forward-filled), for comparing products. */
    async getLowestPriceSeries(productIds: string[], days = 90): Promise<Array<{ productId: string; price: number; date: string }>> {
        if (!productIds.length) return [];
        return this.dataSource.query(
            `WITH o AS (
                 SELECT id, "productId", "lastSeenAt" FROM offers WHERE "productId" = ANY($1)
             ),
             series AS (
                 SELECT o."productId", d::date AS day,
                        (SELECT h.price FROM price_history h
                         WHERE h."offerId" = o.id AND h.date < d + interval '1 day'
                         ORDER BY h.date DESC LIMIT 1) AS price
                 FROM o
                 CROSS JOIN generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d
                 WHERE d::date <= o."lastSeenAt"::date
             )
             SELECT "productId", MIN(price)::int AS price, to_char(day, 'YYYY-MM-DD') AS date
             FROM series WHERE price IS NOT NULL
             GROUP BY "productId", day
             ORDER BY day`,
            [productIds, days],
        );
    }

    // ------------------------------------------------------------------ navigation / filters

    async getFilterOptions() {
        return this.cached('filter-options', async () => {
            const [combos, brands, colors] = await Promise.all([this.activeCombos(), this.activeBrands(), this.distinct('color')]);
            const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
            return {
                categories: uniq(combos.map((c) => c.category)),
                subcategories: uniq(combos.map((c) => c.subcategory)),
                brands: brands.map((b) => b.brand).sort((a, b) => a.localeCompare(b)),
                genders: uniq(combos.map((c) => c.gender)),
                ages: uniq(combos.map((c) => c.age)),
                colors,
            };
        });
    }

    async getNavData() {
        return this.cached('nav-data', async () => {
            const [combos, brands, filters] = await Promise.all([this.activeCombos(), this.activeBrands(), this.getFilterOptions()]);

            const subcats = (age: string, genders: string[], category: string) =>
                sortByTaxonomy(
                    combos
                        .filter((c) => c.age === age && c.category === category && genders.includes(c.gender || ''))
                        .map((c) => c.subcategory),
                );

            const menuFor = (age: string, genders: string[]) => ({
                Обувки: subcats(age, genders, 'Обувки'),
                Текстил: subcats(age, genders, 'Текстил'),
                Опрема: subcats(age, genders, 'Опрема'),
            });

            const equipmentSubs = sortByTaxonomy(combos.filter((c) => c.category === 'Опрема').map((c) => c.subcategory));
            const all: Record<string, string[]> = {};
            for (const { brand } of brands) {
                const letter = brand[0].toUpperCase();
                (all[letter] ||= []).push(brand);
            }
            for (const list of Object.values(all)) list.sort((a, b) => a.localeCompare(b));

            return {
                menu: {
                    men: menuFor('За возрасни', ['Машки', 'Унисекс']),
                    women: menuFor('За возрасни', ['Женски', 'Унисекс']),
                    kids: menuFor('За деца', [...GENDERS]),
                },
                equipment: {
                    dodatoci: equipmentSubs.filter((s) => SUBCATEGORIES[s]?.group === 'dodatoci'),
                    sports: equipmentSubs.filter((s) => SUBCATEGORIES[s]?.group === 'sports'),
                },
                brands: {
                    top: [...brands].sort((a, b) => b.count - a.count).slice(0, 10).map((b) => ({ name: b.brand, count: b.count })),
                    all,
                },
                filters,
            };
        });
    }

    async getStores() {
        return this.cached('stores', () => this.stores.find({ order: { name: 'ASC' } }));
    }

    private activeCombos(): Promise<Array<{ category: string | null; subcategory: string | null; gender: string | null; age: string | null }>> {
        return this.cached('combos', () =>
            this.dataSource.query(
                `SELECT DISTINCT category, subcategory, gender, age FROM products p WHERE ${VISIBLE_PRODUCT_SQL}`,
            ),
        );
    }

    private activeBrands(): Promise<Array<{ brand: string; count: number }>> {
        return this.cached('brands', () =>
            this.dataSource.query(
                `SELECT brand, COUNT(*)::int AS count FROM products p
                 WHERE ${VISIBLE_PRODUCT_SQL} AND brand IS NOT NULL AND brand <> ''
                 GROUP BY brand`,
            ),
        );
    }

    private async distinct(column: 'color'): Promise<string[]> {
        const rows = await this.dataSource.query(
            `SELECT DISTINCT ${column} AS v FROM products p WHERE ${VISIBLE_PRODUCT_SQL} AND ${column} IS NOT NULL ORDER BY 1`,
        );
        return rows.map((r: { v: string }) => r.v);
    }
}

function sortByTaxonomy(values: (string | null)[]): string[] {
    const set = new Set(values.filter(Boolean) as string[]);
    return [...set].sort((a, b) => {
        const ia = SUBCATEGORY_NAMES.indexOf(a);
        const ib = SUBCATEGORY_NAMES.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
    });
}
