import { MigrationInterface, QueryRunner } from 'typeorm';

/** Physical shop locations of each chain, refreshed from the chains' own store locators. */
export class StoreLocations1763400000000 implements MigrationInterface {
    name = 'StoreLocations1763400000000';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`
            CREATE TABLE IF NOT EXISTS "store_locations" (
                "id" varchar PRIMARY KEY,
                "store" varchar NOT NULL,
                "name" varchar NOT NULL,
                "address" varchar,
                "city" varchar,
                "lat" double precision NOT NULL,
                "lng" double precision NOT NULL,
                "approximate" boolean NOT NULL DEFAULT false,
                "phone" varchar,
                "hours" jsonb,
                "url" varchar,
                "updatedAt" timestamp NOT NULL DEFAULT now()
            )`);
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_store_locations_store" ON "store_locations" ("store")`);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP TABLE IF EXISTS "store_locations"`);
    }
}
