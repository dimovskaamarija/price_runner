import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { canonicalBrand, normalizeModelCode, urlKey } from '../catalog/text';
import type { ScrapedListing } from './core/types';

/**
 * Persists scraped listings as offers. Per listing page this is:
 *   1 SELECT (previous prices) + 1 bulk UPSERT + 1 bulk INSERT into price_history
 * instead of the previous ~4 queries per product.
 *
 * Price history is change-only: a row is written only when the price differs from the
 * offer's last known price.
 */
@Injectable()
export class IngestService {
    constructor(private readonly dataSource: DataSource) {}

    async saveBatch(store: string, listings: ScrapedListing[], seenAt = new Date()): Promise<{ upserted: number; priceChanges: number }> {
        const rows = new Map<string, ReturnType<IngestService['toRow']>>();
        for (const l of listings) {
            const row = this.toRow(l);
            if (row) rows.set(row.externalKey, row); // dedupe within batch
        }
        if (!rows.size) return { upserted: 0, priceChanges: 0 };
        const list = [...rows.values()];

        const previous: Array<{ externalKey: string; price: number | null }> = await this.dataSource.query(
            `SELECT "externalKey", price FROM offers WHERE store = $1 AND "externalKey" = ANY($2)`,
            [store, list.map((r) => r.externalKey)],
        );
        const prevPrice = new Map(previous.map((p) => [p.externalKey, p.price]));

        const params: unknown[] = [store, seenAt];
        const tuples = list.map((r) => {
            params.push(r.externalKey, r.url, r.name, r.brand, r.modelCode, r.image, r.price, JSON.stringify(r.labels), JSON.stringify(r.hints));
            const n = params.length;
            return `($1, $${n - 8}, $${n - 7}, $${n - 6}, $${n - 5}, $${n - 4}, $${n - 3}, $${n - 2}::int, $${n - 1}::jsonb, $${n}::jsonb, $2::timestamp, $2::timestamp, $2::timestamp)`;
        });

        const upserted: Array<{ id: number; externalKey: string; price: number | null }> = await this.dataSource.query(
            `INSERT INTO offers (store, "externalKey", url, name, brand, "modelCode", image, price, "rawLabels", hints,
                                 "lastSeenAt", "createdAt", "updatedAt")
             VALUES ${tuples.join(',')}
             ON CONFLICT (store, "externalKey") DO UPDATE SET
                url = EXCLUDED.url,
                name = EXCLUDED.name,
                brand = COALESCE(EXCLUDED.brand, offers.brand),
                "modelCode" = COALESCE(EXCLUDED."modelCode", offers."modelCode"),
                image = COALESCE(EXCLUDED.image, offers.image),
                price = EXCLUDED.price,
                "rawLabels" = EXCLUDED."rawLabels",
                hints = EXCLUDED.hints,
                "lastSeenAt" = EXCLUDED."lastSeenAt",
                "updatedAt" = EXCLUDED."updatedAt",
                -- Re-classify only when the inputs to classification changed.
                "classifiedAt" = CASE
                    WHEN offers."rawLabels" IS DISTINCT FROM EXCLUDED."rawLabels"
                      OR offers.hints IS DISTINCT FROM EXCLUDED.hints
                      OR offers.name IS DISTINCT FROM EXCLUDED.name
                    THEN NULL ELSE offers."classifiedAt" END
             RETURNING id, "externalKey", price`,
            params,
        );

        const changes = upserted.filter(
            (o) => o.price != null && (!prevPrice.has(o.externalKey) || prevPrice.get(o.externalKey) !== o.price),
        );
        if (changes.length) {
            await this.dataSource.query(
                `INSERT INTO price_history ("offerId", price, date)
                 SELECT * FROM unnest($1::int[], $2::int[], $3::timestamp[])`,
                [changes.map((c) => c.id), changes.map((c) => c.price), changes.map(() => seenAt)],
            );
        }
        return { upserted: upserted.length, priceChanges: changes.length };
    }

    private toRow(l: ScrapedListing) {
        const name = (l.name || '').replace(/\s+/g, ' ').trim();
        if (!name || !l.url) return null;
        return {
            externalKey: urlKey(l.url),
            url: l.url,
            name: name.slice(0, 300),
            brand: canonicalBrand(l.brand) || null,
            modelCode: normalizeModelCode(l.code) || null,
            image: l.image || null,
            price: l.price ?? null,
            labels: l.labels || {},
            hints: l.hints || {},
        };
    }
}
