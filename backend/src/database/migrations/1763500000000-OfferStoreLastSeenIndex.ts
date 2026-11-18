import { MigrationInterface, QueryRunner } from 'typeorm';

/** Makes "latest scrape of this store" (max lastSeenAt per store) an index lookup. */
export class OfferStoreLastSeenIndex1763500000000 implements MigrationInterface {
    name = 'OfferStoreLastSeenIndex1763500000000';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`CREATE INDEX IF NOT EXISTS "IDX_offers_store_last_seen" ON "offers" ("store", "lastSeenAt")`);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS "IDX_offers_store_last_seen"`);
    }
}
