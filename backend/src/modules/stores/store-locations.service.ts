import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { StoreLocation } from '../../database/entities/store-location.entity';
import { LOCATION_SOURCES, SourceLocation } from './sources';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/**
 * Keeps `store_locations` in sync with each chain's own store locator.
 * Runs weekly, and once at startup when the table is empty.
 */
@Injectable()
export class StoreLocationsService implements OnApplicationBootstrap {
    private readonly log = new Logger(StoreLocationsService.name);
    private syncing: Promise<unknown> | null = null;

    constructor(@InjectRepository(StoreLocation) private readonly repo: Repository<StoreLocation>) {}

    onApplicationBootstrap() {
        this.repo
            .count()
            .then((n) => n === 0 && this.sync())
            .catch((e) => this.log.warn(`Initial store sync skipped: ${(e as Error).message}`));
    }

    @Cron('0 4 * * 1') // Mondays 04:00
    async scheduled() {
        if (process.env.ENABLE_SCRAPER_CRON === 'false') return;
        await this.sync();
    }

    list(): Promise<StoreLocation[]> {
        return this.repo.find({ order: { store: 'ASC', city: 'ASC', name: 'ASC' } });
    }

    sync() {
        if (!this.syncing) this.syncing = this.syncAll().finally(() => (this.syncing = null));
        return this.syncing;
    }

    private async syncAll() {
        const result: Record<string, number | string> = {};
        for (const source of LOCATION_SOURCES) {
            try {
                const found = await source.fetch();
                if (!found.length) throw new Error('no locations returned');
                const saved = await this.saveChain(source.store, found);
                result[source.store] = saved;
            } catch (e) {
                // Keep the previous data for this chain rather than wiping it.
                result[source.store] = `error: ${(e as Error).message}`;
                this.log.warn(`Store locations for ${source.store} failed: ${(e as Error).message}`);
            }
        }
        // Shops whose address names no city: take the city of the nearest shop within ~15 km.
        await this.repo.query(`
            UPDATE store_locations s SET city = (
                SELECT o.city FROM store_locations o
                WHERE o.city IS NOT NULL AND o.id <> s.id
                  AND abs(o.lat - s.lat) < 0.15 AND abs(o.lng - s.lng) < 0.2
                ORDER BY (o.lat - s.lat) ^ 2 + (o.lng - s.lng) ^ 2
                LIMIT 1)
            WHERE s.city IS NULL`);
        this.log.log(`Store locations synced: ${JSON.stringify(result)}`);
        return result;
    }

    private async saveChain(store: string, found: SourceLocation[]): Promise<number> {
        const existing = new Map((await this.repo.find({ where: { store } })).map((l) => [l.id, l]));
        const rows: StoreLocation[] = [];

        for (const f of found) {
            let lat = f.lat;
            let lng = f.lng;
            let approximate = false;
            if (lat == null || lng == null) {
                const prev = existing.get(f.id);
                if (prev && prev.address === f.address) {
                    // Address unchanged: reuse the earlier geocoding result.
                    ({ lat, lng, approximate } = prev);
                } else {
                    const geo = await this.geocode(f.name, f.address, f.city);
                    if (!geo) {
                        this.log.warn(`Could not locate "${f.name}" (${f.address}); skipped`);
                        continue;
                    }
                    ({ lat, lng } = geo);
                    approximate = true;
                }
            }
            rows.push(this.repo.create({ ...f, lat: lat!, lng: lng!, approximate }));
        }

        await this.repo.save(rows);
        const keep = new Set(rows.map((r) => r.id));
        const gone = [...existing.keys()].filter((id) => !keep.has(id));
        if (gone.length) await this.repo.delete(gone);
        return rows.length;
    }

    /**
     * OpenStreetMap Nominatim, used only for shops whose locator has no coordinates and only
     * when their address changes (a handful of requests per year). Respects the 1 req/s policy.
     *
     * Order: shopping-centre name ("ТЦ East Gate" -> "East Gate Mall, Скопје"), then the street
     * without unit details ("ул. Беласица бр. 2 локал К1" -> "Беласица 2, Скопје"), then the city.
     */
    private async geocode(name: string, address: string | null, city: string | null): Promise<{ lat: number; lng: number } | null> {
        const queries: string[] = [];
        const mall = name.match(/(?:ТЦ|TC|Mall|Мол)\s+(.+)$/i)?.[1]?.trim();
        if (mall && city) {
            queries.push(`${mall}, ${city}`);
            if (!/mall|мол/i.test(mall)) queries.push(`${mall} Mall, ${city}`, `${mall} Мол, ${city}`);
        }
        // Place in the shop name ("Интерспорт - Визбегово" -> "Визбегово, Скопје"), unless it's just the city.
        const place = name.split(/\s+-\s+/).pop()?.trim();
        if (!mall && place && place !== name && city && place.toLowerCase() !== city.toLowerCase()) {
            queries.push(`${place}, ${city}`, place);
        }
        if (address) {
            const street = address
                .split(',')[0]
                .replace(/\b(лок(ал)?|lok(al)?)\.?\s*.*$/i, '')
                .replace(/^(ул|ulica|бул|bul)\.?\s*/i, '')
                .replace(/\bбр\.?\s*/i, '')
                .trim();
            if (street && city) queries.push(`${street}, ${city}`);
            queries.push(address);
        }
        if (city) queries.push(city);

        for (const q of [...new Set(queries)]) {
            await new Promise((r) => setTimeout(r, 1100));
            try {
                const res = await axios.get(NOMINATIM, {
                    params: { q, format: 'json', limit: 1, countrycodes: 'mk' },
                    headers: { 'User-Agent': 'PriceRunnerBot/1.0 (store locator)' },
                    timeout: 15_000,
                });
                const hit = res.data?.[0];
                if (hit) {
                    if (q === city) this.log.warn(`"${name}" placed at the centre of ${city} (address not found)`);
                    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) };
                }
            } catch (e) {
                this.log.warn(`Geocoding failed for "${q}": ${(e as Error).message}`);
            }
        }
        return null;
    }
}
