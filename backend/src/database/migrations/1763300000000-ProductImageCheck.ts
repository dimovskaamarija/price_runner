import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - products."imageOk": result of checking the image URL; products with broken images are hidden.
 * - Repair Sizeer / Sport M image URLs: those shops moved product images from .jpg to .webp,
 *   and the scrapers guessed ".jpg", so every image from both stores returned 404.
 */
export class ProductImageCheck1763300000000 implements MigrationInterface {
    name = 'ProductImageCheck1763300000000';

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "imageOk" boolean`);
        for (const table of ['offers', 'products']) {
            await q.query(`
                UPDATE "${table}" SET image = regexp_replace(image, '\\.jpg$', '.webp')
                WHERE image ~ '^https?://(www\\.)?(sizeer\\.com\\.mk|sport-m\\.com\\.mk)/ProductImages/.+\\.jpg$'`);
        }
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "imageOk"`);
    }
}
