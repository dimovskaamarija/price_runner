import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-field provenance of each offer's classification ({"subcategory":"rules","gender":"ml",...}).
 * The ML service trains only on labels from trusted sources (rules / mapping / gemini / manual),
 * never on defaults or on its own predictions.
 */
export class OfferFieldSources1763200000000 implements MigrationInterface {
    name = 'OfferFieldSources1763200000000';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "fieldSources" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE "offers" DROP COLUMN IF EXISTS "fieldSources"`);
    }
}
