import { MigrationInterface, QueryRunner } from 'typeorm';

export class PriceAlerts1763600000000 implements MigrationInterface {
    name = 'PriceAlerts1763600000000';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS "price_alerts" (
                "id" SERIAL PRIMARY KEY,
                "token" varchar NOT NULL,
                "productId" varchar NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
                "userId" integer REFERENCES "users"("id") ON DELETE CASCADE,
                "email" varchar NOT NULL,
                "type" varchar NOT NULL,
                "targetPrice" integer,
                "lastPrice" integer,
                "triggered" boolean NOT NULL DEFAULT false,
                "confirmed" boolean NOT NULL DEFAULT false,
                "active" boolean NOT NULL DEFAULT true,
                "lang" varchar(2) NOT NULL DEFAULT 'mk',
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "lastNotifiedAt" timestamp
            )`);
        await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_alerts_token" ON "price_alerts" ("token")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_price_alerts_product" ON "price_alerts" ("productId")`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_price_alerts_email" ON "price_alerts" ("email")`);
        // Only the alerts that the nightly check has to look at.
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_price_alerts_live" ON "price_alerts" ("productId") WHERE active AND confirmed`);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS "price_alerts"`);
    }
}
