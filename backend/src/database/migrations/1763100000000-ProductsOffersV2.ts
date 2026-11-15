import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * V2 catalog schema:
 *  - products  -> canonical products (+ modelCode, minPrice, storeCount, embedding)
 *  - offers    -> NEW: one row per store listing (price, link, raw labels)
 *  - price_history -> keyed by offerId, change-only (consecutive duplicates removed)
 *  - category_mappings -> NEW: learned raw-label -> taxonomy mapping cache
 *
 * Idempotent: safe on a fresh database and on the legacy schema
 * (products.priceMap / storeLinks JSON + daily price_history rows).
 */
export class ProductsOffersV21763100000000 implements MigrationInterface {
    name = 'ProductsOffersV21763100000000';

    public async up(q: QueryRunner): Promise<void> {
        // ---------- base tables (fresh databases only) ----------
        await q.query(`
            CREATE TABLE IF NOT EXISTS "products" (
                "id" varchar PRIMARY KEY,
                "name" varchar NOT NULL,
                "brand" varchar, "category" varchar, "subcategory" varchar,
                "gender" varchar, "age" varchar, "color" varchar, "image" varchar,
                "currency" varchar DEFAULT 'MKD',
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "updatedAt" timestamp NOT NULL DEFAULT now()
            )`);
        await q.query(`
            CREATE TABLE IF NOT EXISTS "stores" (
                "id" varchar PRIMARY KEY,
                "name" varchar NOT NULL,
                "logo_url" varchar,
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "updatedAt" timestamp NOT NULL DEFAULT now()
            )`);
        await q.query(`
            CREATE TABLE IF NOT EXISTS "users" (
                "id" SERIAL PRIMARY KEY,
                "authkit_id" varchar NOT NULL UNIQUE,
                "email" varchar NOT NULL,
                "name" varchar
            )`);
        if (!(await q.hasTable('favorites'))) {
            await q.query(`
                CREATE TABLE "favorites" (
                    "id" SERIAL PRIMARY KEY,
                    "userId" integer NOT NULL REFERENCES "users"("id"),
                    "productId" varchar NOT NULL,
                    "createdAt" timestamp NOT NULL DEFAULT now()
                )`);
            await q.query(`CREATE UNIQUE INDEX "IDX_favorites_user_product" ON "favorites" ("userId", "productId")`);
        }

        // ---------- products: new columns ----------
        await q.query(`
            ALTER TABLE "products"
                ADD COLUMN IF NOT EXISTS "modelCode" varchar,
                ADD COLUMN IF NOT EXISTS "minPrice" integer,
                ADD COLUMN IF NOT EXISTS "storeCount" integer NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS "embedding" real[]`);

        // ---------- offers ----------
        await q.query(`
            CREATE TABLE IF NOT EXISTS "offers" (
                "id" SERIAL PRIMARY KEY,
                "store" varchar NOT NULL,
                "externalKey" varchar NOT NULL,
                "productId" varchar REFERENCES "products"("id") ON DELETE SET NULL,
                "url" varchar NOT NULL,
                "name" varchar NOT NULL,
                "brand" varchar,
                "modelCode" varchar,
                "image" varchar,
                "price" integer,
                "rawLabels" jsonb NOT NULL DEFAULT '{}',
                "hints" jsonb NOT NULL DEFAULT '{}',
                "category" varchar, "subcategory" varchar, "gender" varchar, "age" varchar, "color" varchar,
                "classificationSource" varchar,
                "classifiedAt" timestamp,
                "lastSeenAt" timestamp NOT NULL DEFAULT now(),
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "updatedAt" timestamp NOT NULL DEFAULT now()
            )`);
        await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_offers_store_key" ON "offers" ("store", "externalKey")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_offers_product" ON "offers" ("productId")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_offers_last_seen" ON "offers" ("lastSeenAt")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_offers_unclassified" ON "offers" ("id") WHERE "classifiedAt" IS NULL`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_offers_unclustered" ON "offers" ("id") WHERE "productId" IS NULL`);

        // ---------- category_mappings ----------
        await q.query(`
            CREATE TABLE IF NOT EXISTS "category_mappings" (
                "id" SERIAL PRIMARY KEY,
                "kind" varchar NOT NULL,
                "raw" varchar NOT NULL,
                "value" varchar,
                "source" varchar NOT NULL DEFAULT 'gemini',
                "createdAt" timestamp NOT NULL DEFAULT now()
            )`);
        await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_mappings_kind_raw" ON "category_mappings" ("kind", "raw")`);

        // ---------- legacy data: products.priceMap/storeLinks -> offers ----------
        const legacyProducts = await q.hasColumn('products', 'priceMap');
        if (legacyProducts) {
            await q.query(`
                INSERT INTO "offers" ("store", "externalKey", "productId", "url", "name", "brand", "image", "price",
                                      "category", "subcategory", "gender", "age", "color",
                                      "classificationSource", "classifiedAt", "lastSeenAt", "createdAt", "updatedAt")
                SELECT s.key,
                       regexp_replace(regexp_replace(COALESCE(p."storeLinks"->>s.key, p."productUrl", p.id), '#.*$', ''), '/+$', ''),
                       p.id,
                       COALESCE(p."storeLinks"->>s.key, p."productUrl", ''),
                       p.name, p.brand, p.image,
                       round(NULLIF(s.value #>> '{}', '')::numeric)::int,
                       p.category, p.subcategory, p.gender, p.age, p.color,
                       'legacy', now(), p."updatedAt", p."createdAt", p."updatedAt"
                FROM "products" p, jsonb_each(COALESCE(p."priceMap", '{}'::jsonb)) s
                ORDER BY p."updatedAt" DESC
                ON CONFLICT ("store", "externalKey") DO NOTHING`);
        }

        // ---------- price_history -> offerId + change-only ----------
        if (!(await q.hasTable('price_history'))) {
            await q.query(`
                CREATE TABLE "price_history" (
                    "id" SERIAL PRIMARY KEY,
                    "offerId" integer NOT NULL REFERENCES "offers"("id") ON DELETE CASCADE,
                    "price" integer NOT NULL,
                    "date" timestamp NOT NULL DEFAULT now()
                )`);
        } else if (await q.hasColumn('price_history', 'productId')) {
            await q.query(`ALTER TABLE "price_history" ADD COLUMN IF NOT EXISTS "offerId" integer`);
            await q.query(`
                UPDATE "price_history" h SET "offerId" = o.id
                FROM "offers" o
                WHERE h."offerId" IS NULL AND o."productId" = h."productId" AND o.store = h.store`);
            await q.query(`DELETE FROM "price_history" WHERE "offerId" IS NULL OR price IS NULL`);
            // Keep only rows where the price changed vs. the previous row (per offer).
            await q.query(`
                DELETE FROM "price_history" WHERE id IN (
                    SELECT id FROM (
                        SELECT id, price, date,
                               LAG(price) OVER (PARTITION BY "offerId" ORDER BY date, id) AS prev
                        FROM "price_history"
                    ) t
                    WHERE t.prev IS NOT NULL AND t.prev = t.price
                )`);
            await q.query(`ALTER TABLE "price_history" DROP COLUMN "productId", DROP COLUMN "store"`);
            await q.query(`ALTER TABLE "price_history" ALTER COLUMN "price" TYPE integer USING round("price")::int`);
            await q.query(`ALTER TABLE "price_history" ALTER COLUMN "offerId" SET NOT NULL`);
            await q.query(`
                ALTER TABLE "price_history"
                ADD CONSTRAINT "FK_price_history_offer" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE`);
        }
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_price_history_offer_date" ON "price_history" ("offerId", "date")`);

        if (legacyProducts) {
            await q.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "priceMap", DROP COLUMN IF EXISTS "storeLinks", DROP COLUMN IF EXISTS "productUrl"`);
        }

        // ---------- denormalized aggregates ----------
        await q.query(`
            UPDATE "products" p SET "minPrice" = a.mn, "storeCount" = a.cnt
            FROM (
                SELECT "productId" AS pid, MIN(price) AS mn, COUNT(*) AS cnt
                FROM "offers"
                WHERE price IS NOT NULL AND "lastSeenAt" >= now() - interval '48 hours'
                GROUP BY "productId"
            ) a
            WHERE p.id = a.pid`);

        // ---------- product indexes ----------
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_products_listing" ON "products" ("storeCount", "minPrice")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_products_cat_sub" ON "products" ("category", "subcategory")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_products_brand" ON "products" ("brand")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_products_model_code" ON "products" ("modelCode")`);

        // Trigram index for fast ILIKE search; skipped silently if the extension is unavailable.
        await q.query(`
            DO $$ BEGIN
                CREATE EXTENSION IF NOT EXISTS pg_trgm;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'pg_trgm not available, search will use sequential scan';
            END $$`);
        await q.query(`
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
                    EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_products_search_trgm" ON "products" USING gin ('
                         || '(lower(coalesce(name, '''') || '' '' || coalesce(brand, '''') || '' '' || coalesce(subcategory, ''''))) gin_trgm_ops)';
                END IF;
            END $$`);
    }

    public async down(): Promise<void> {
        throw new Error('ProductsOffersV2 is a one-way data migration; restore from a backup to roll back.');
    }
}
