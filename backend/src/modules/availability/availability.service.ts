import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StoreLocation } from '../../database/entities/store-location.entity';
import { ACTIVE_OFFER_SQL } from '../catalog/maintenance.service';
import { AVAILABILITY_PROVIDERS, ChainSize, normalizeSize } from './providers';

const TTL_MS = 15 * 60 * 1000;

export type ChainStatus = 'ok' | 'error' | 'unsupported';

export interface ChainResult {
    store: string;
    status: ChainStatus;
    url: string;
    sizes: Array<{ size: string; level?: string }>;
    /** Only for the requested size. */
    onlineOnly?: boolean;
}

/**
 * "Which shops have this product in my size?" — asks each chain live (only when a visitor
 * opens the section), caches answers for 15 minutes and maps shops to store_locations.
 */
@Injectable()
export class AvailabilityService {
    private readonly log = new Logger(AvailabilityService.name);
    private readonly cache = new Map<string, { at: number; value: Promise<unknown> }>();

    constructor(@InjectRepository(StoreLocation) private readonly locations: Repository<StoreLocation>) {}

    /** Cache promises (not results) so concurrent visitors share one request to the store. */
    private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
        const hit = this.cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
        const value = load();
        this.cache.set(key, { at: Date.now(), value });
        value.catch(() => this.cache.delete(key)); // don't keep failures
        if (this.cache.size > 2000) this.cache.delete(this.cache.keys().next().value!);
        return value;
    }

    async forProduct(productId: string, requestedSize?: string) {
        const offers: Array<{ store: string; url: string }> = await this.locations.query(
            `SELECT DISTINCT ON (o.store) o.store, o.url FROM offers o
             WHERE o."productId" = $1 AND ${ACTIVE_OFFER_SQL}
             ORDER BY o.store, o.price ASC`,
            [productId],
        );
        const size = requestedSize ? normalizeSize(requestedSize) : null;

        const results = await Promise.all(offers.map((o) => this.forOffer(o, size)));
        const chains: ChainResult[] = results.map((r) => r.chain);

        // Union of sizes across chains, sorted numerically where possible ("36", "36.5", ..., "M", "L").
        const allSizes = [...new Set(chains.flatMap((c) => c.sizes.map((s) => s.size)))].sort(compareSizes);

        let locations: Array<StoreLocation & { sizes?: string[] }> = [];
        const ids = results.flatMap((r) => r.locationIds);
        if (ids.length) locations = await this.locations.find({ where: { id: In([...new Set(ids)]) } });

        return { size, sizes: allSizes, chains, locations };
    }

    private async forOffer(offer: { store: string; url: string }, size: string | null) {
        const provider = AVAILABILITY_PROVIDERS[offer.store];
        const base = { store: offer.store, url: offer.url };
        if (!provider) return { chain: { ...base, status: 'unsupported' as ChainStatus, sizes: [] }, locationIds: [] };

        try {
            const listing = await this.cached(`sizes|${offer.url}`, () => provider.sizes(offer.url));
            const chain: ChainResult = {
                ...base,
                status: 'ok',
                sizes: listing.sizes.map(({ size: s, level }) => ({ size: s, level })),
            };
            let locationIds: string[] = [];
            if (size) {
                if (listing.shopsBySize) {
                    locationIds = listing.shopsBySize[size] || [];
                } else if (provider.shopsForSize) {
                    const match: ChainSize | undefined = listing.sizes.find((s) => s.size === size);
                    if (match) {
                        const shops = await this.cached(`shops|${offer.url}|${size}`, () => provider.shopsForSize!(offer.url, match));
                        locationIds = shops.locationIds;
                        chain.onlineOnly = shops.onlineOnly;
                    }
                }
            }
            return { chain, locationIds };
        } catch (e) {
            this.log.warn(`Availability for ${offer.store} failed: ${(e as Error).message}`);
            return { chain: { ...base, status: 'error' as ChainStatus, sizes: [] }, locationIds: [] };
        }
    }
}

function compareSizes(a: string, b: string): number {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    if (!Number.isNaN(na)) return -1;
    if (!Number.isNaN(nb)) return 1;
    const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    return a.localeCompare(b);
}
