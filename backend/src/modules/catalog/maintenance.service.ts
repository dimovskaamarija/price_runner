import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import pLimit from 'p-limit';
import { DataSource } from 'typeorm';

export const ACTIVE_WINDOW_HOURS = parseInt(process.env.ACTIVE_WINDOW_HOURS || '48', 10);
const OFFER_RETENTION_DAYS = parseInt(process.env.OFFER_RETENTION_DAYS || '30', 10);
const IMAGE_CHECKS_PER_PASS = parseInt(process.env.IMAGE_CHECKS_PER_PASS || '4000', 10);

/** SQL fragment: a product is listed if a store sells it and its image isn't known to be broken. */
export const VISIBLE_PRODUCT_SQL = `p."storeCount" > 0 AND p.image IS NOT NULL AND p."imageOk" IS NOT FALSE`;

const MAX_STALE_DAYS = parseInt(process.env.MAX_STALE_DAYS || '7', 10);

/**
 * SQL fragment (offer alias `o`): an offer counts as "currently on sale" if it has a price and was
 * seen within ACTIVE_WINDOW_HOURS of that store's latest scrape — relative to the store's last run,
 * not the clock, so a late or failed scrape keeps the last known prices instead of emptying the site.
 * Prices older than MAX_STALE_DAYS are never shown as current.
 */
export const ACTIVE_OFFER_SQL = `o.price IS NOT NULL
    AND o."lastSeenAt" >= now() - interval '${MAX_STALE_DAYS} days'
    AND o."lastSeenAt" >= (SELECT max(x."lastSeenAt") FROM offers x WHERE x.store = o.store) - interval '${ACTIVE_WINDOW_HOURS} hours'`;

/**
 * Post-scrape housekeeping. Everything here is set-based SQL (no per-row round trips).
 */
@Injectable()
export class CatalogMaintenanceService {
    private readonly log = new Logger(CatalogMaintenanceService.name);

    constructor(private readonly dataSource: DataSource) {}

    async runAll() {
        const synced = await this.syncProductFields();
        const merged = await this.mergeDuplicateProducts();
        const imagesChanged = await this.syncImages();
        const aggregates = await this.recomputeAggregates();
        const images = await this.validateImages();
        const cleanup = await this.cleanup();
        const result = { synced, merged, imagesChanged, images, aggregates, ...cleanup };
        this.log.log(`Maintenance: ${JSON.stringify(result)}`);
        return result;
    }

    /**
     * Product attributes = majority vote of its offers' classifications, so one store's odd
     * label can't mis-file a product sold by several stores.
     */
    async syncProductFields(): Promise<number> {
        const [, n] = await this.dataSource.query(`
            UPDATE products p SET
                category    = COALESCE(s.category, p.category),
                subcategory = COALESCE(s.subcategory, p.subcategory),
                gender      = COALESCE(s.gender, p.gender),
                age         = COALESCE(s.age, p.age),
                color       = COALESCE(s.color, p.color),
                brand       = COALESCE(s.brand, p.brand),
                "modelCode" = COALESCE(p."modelCode", s."modelCode"),
                "updatedAt" = now()
            FROM (
                SELECT "productId" AS pid,
                       mode() WITHIN GROUP (ORDER BY category)    AS category,
                       mode() WITHIN GROUP (ORDER BY subcategory) AS subcategory,
                       mode() WITHIN GROUP (ORDER BY gender)      AS gender,
                       mode() WITHIN GROUP (ORDER BY age)         AS age,
                       mode() WITHIN GROUP (ORDER BY color)       AS color,
                       mode() WITHIN GROUP (ORDER BY brand)       AS brand,
                       mode() WITHIN GROUP (ORDER BY "modelCode") AS "modelCode"
                FROM offers
                WHERE "productId" IS NOT NULL AND "classifiedAt" IS NOT NULL
                GROUP BY "productId"
            ) s
            WHERE p.id = s.pid AND (
                p.category    IS DISTINCT FROM COALESCE(s.category, p.category) OR
                p.subcategory IS DISTINCT FROM COALESCE(s.subcategory, p.subcategory) OR
                p.gender      IS DISTINCT FROM COALESCE(s.gender, p.gender) OR
                p.age         IS DISTINCT FROM COALESCE(s.age, p.age) OR
                p.color       IS DISTINCT FROM COALESCE(s.color, p.color) OR
                p.brand       IS DISTINCT FROM COALESCE(s.brand, p.brand) OR
                (p."modelCode" IS NULL AND s."modelCode" IS NOT NULL)
            )`);
        return n || 0;
    }

    /**
     * Keep each product's image if it's still one of its offers' images and not known broken;
     * otherwise switch to another store's image (and re-check it).
     */
    async syncImages(): Promise<number> {
        const [, n] = await this.dataSource.query(`
            UPDATE products p SET image = c.new_image, "imageOk" = NULL
            FROM (
                SELECT p2.id,
                       CASE WHEN p2.image = ANY(s.images) AND p2."imageOk" IS NOT FALSE THEN p2.image
                            ELSE COALESCE((SELECT i FROM unnest(s.images) i WHERE i IS DISTINCT FROM p2.image LIMIT 1), p2.image)
                       END AS new_image
                FROM products p2
                JOIN (
                    SELECT "productId" AS pid, array_agg(DISTINCT image) FILTER (WHERE image IS NOT NULL) AS images
                    FROM offers WHERE "productId" IS NOT NULL
                    GROUP BY "productId"
                ) s ON s.pid = p2.id
                WHERE s.images IS NOT NULL
            ) c
            WHERE p.id = c.id AND c.new_image IS DISTINCT FROM p.image`);
        return n || 0;
    }

    /**
     * Check image URLs of listed products that haven't been checked yet (fetches only the first
     * bytes). Broken ones get imageOk = false and disappear from listings until a store provides
     * a working image. Network errors leave the product unchecked so it's retried next pass.
     */
    async validateImages(): Promise<{ checked: number; broken: number }> {
        const rows: Array<{ id: string; image: string }> = await this.dataSource.query(
            `SELECT id, image FROM products
             WHERE image IS NOT NULL AND "imageOk" IS NULL AND "storeCount" > 0
             LIMIT $1`,
            [IMAGE_CHECKS_PER_PASS],
        );
        if (!rows.length) return { checked: 0, broken: 0 };
        const limit = pLimit(12);
        const results = await Promise.all(rows.map((r) => limit(() => checkImage(r.image))));
        const checked = rows.filter((_, i) => results[i] !== null);
        if (checked.length) {
            await this.dataSource.query(
                `UPDATE products p SET "imageOk" = v.ok FROM unnest($1::varchar[], $2::boolean[]) AS v(id, ok) WHERE p.id = v.id`,
                [checked.map((r) => r.id), results.filter((r) => r !== null)],
            );
        }
        return { checked: checked.length, broken: results.filter((r) => r === false).length };
    }

    /**
     * Products sharing a model code are the same product (typical for legacy rows created
     * per-store before clustering existed). Keep the oldest, move offers + favorites to it.
     */
    async mergeDuplicateProducts(): Promise<number> {
        const groups: Array<{ keep: string; drop: string[] }> = await this.dataSource.query(`
            SELECT (array_agg(id ORDER BY "createdAt", id))[1] AS keep,
                   (array_agg(id ORDER BY "createdAt", id))[2:] AS drop
            FROM products
            WHERE "modelCode" IS NOT NULL
            GROUP BY "modelCode", regexp_replace(lower(coalesce(brand, '')), '[^[:alnum:]]', '', 'g')
            HAVING count(*) > 1`);
        if (!groups.length) return 0;

        const keep = groups.flatMap((g) => g.drop.map(() => g.keep));
        const drop = groups.flatMap((g) => g.drop);

        await this.dataSource.transaction(async (m) => {
            await m.query(`CREATE TEMP TABLE merge_map (drop_id varchar PRIMARY KEY, keep_id varchar) ON COMMIT DROP`);
            await m.query(`INSERT INTO merge_map SELECT * FROM unnest($1::varchar[], $2::varchar[])`, [drop, keep]);
            await m.query(`UPDATE offers o SET "productId" = mm.keep_id FROM merge_map mm WHERE o."productId" = mm.drop_id`);
            // Move favorites unless the user already favorited the surviving product. DISTINCT ON keeps
            // one row per (user, surviving product) when a user favorited several duplicates.
            await m.query(`
                UPDATE favorites f SET "productId" = mm.keep_id
                FROM merge_map mm
                WHERE f."productId" = mm.drop_id
                  AND f.id IN (
                      SELECT DISTINCT ON (f3."userId", mm3.keep_id) f3.id
                      FROM favorites f3 JOIN merge_map mm3 ON f3."productId" = mm3.drop_id
                      ORDER BY f3."userId", mm3.keep_id, f3.id)
                  AND NOT EXISTS (SELECT 1 FROM favorites f2 WHERE f2."userId" = f."userId" AND f2."productId" = mm.keep_id)`);
            await m.query(`DELETE FROM favorites f USING merge_map mm WHERE f."productId" = mm.drop_id`);
            await m.query(`DELETE FROM products p USING merge_map mm WHERE p.id = mm.drop_id`);
        });
        return drop.length;
    }

    /** Denormalize min price and store count so listing/sorting/filtering is pure indexed SQL. */
    async recomputeAggregates(): Promise<number> {
        const [, n] = await this.dataSource.query(`
            UPDATE products p SET "minPrice" = a.mn, "storeCount" = COALESCE(a.cnt, 0)
            FROM products p2
            LEFT JOIN (
                SELECT o."productId" AS pid, MIN(o.price) AS mn, COUNT(DISTINCT o.store)::int AS cnt
                FROM offers o
                WHERE ${ACTIVE_OFFER_SQL} AND o."productId" IS NOT NULL
                GROUP BY o."productId"
            ) a ON a.pid = p2.id
            WHERE p.id = p2.id
              AND (p."minPrice" IS DISTINCT FROM a.mn OR p."storeCount" IS DISTINCT FROM COALESCE(a.cnt, 0))`);
        return n || 0;
    }

    /** Drop listings that disappeared from stores and products nobody can buy or has favorited. */
    async cleanup() {
        const [, staleOffers] = await this.dataSource.query(
            `DELETE FROM offers WHERE "lastSeenAt" < now() - make_interval(days => $1)`,
            [OFFER_RETENTION_DAYS],
        );
        const [, orphanProducts] = await this.dataSource.query(`
            DELETE FROM products p
            WHERE p."createdAt" < now() - interval '1 day'
              AND NOT EXISTS (SELECT 1 FROM offers o WHERE o."productId" = p.id)
              AND NOT EXISTS (SELECT 1 FROM favorites f WHERE f."productId" = p.id)`);
        return { staleOffers: staleOffers || 0, orphanProducts: orphanProducts || 0 };
    }
}

/** true = loads as an image, false = definitely broken (4xx / not an image), null = couldn't tell. */
async function checkImage(url: string): Promise<boolean | null> {
    try {
        const res = await axios.get(url, {
            responseType: 'stream',
            timeout: 10_000,
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PriceRunnerBot/1.0)', Range: 'bytes=0-1023' },
            validateStatus: () => true,
        });
        res.data?.destroy?.();
        if (res.status === 200 || res.status === 206) {
            return String(res.headers['content-type'] || '').startsWith('image/');
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 429) return false;
        return null;
    } catch {
        return null;
    }
}
