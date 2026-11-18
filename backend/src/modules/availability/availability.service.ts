import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import pLimit from 'p-limit';
import { In, Repository } from 'typeorm';
import { StoreLocation } from '../../database/entities/store-location.entity';
import { AVAILABILITY_PROVIDERS, AvailabilityProvider, ChainSize, normalizeSize, sizeValue } from './providers';

const TTL_MS = 15 * 60 * 1000;
/** Parallel per-size requests to one store (for chains that need a request per size). */
const PER_STORE_CONCURRENCY = 3;

export type ChainStatus = 'ok' | 'error' | 'unsupported';

export interface ChainResult {
    store: string;
    status: ChainStatus;
    url: string;
    sizes: Array<{ size: string; level?: string }>;
    /** Only for the requested size. */
    onlineOnly?: boolean;
}

/** Everything one chain knows about one product: its sizes and, per size, the shops that have it. */
interface ChainStock {
    sizes: ChainSize[];
    /** size -> shop refs (store_locations ids, or "url:<link>" for chains that only give links). */
    shopsBySize: Record<string, string[]>;
    onlineOnlyBySize: Record<string, boolean>;
}

/**
 * "Which shops have this product in my size?" — asks each chain live (only when a visitor
 * opens the section), caches answers for 15 minutes and maps shops to store_locations.
 * Shop counts are computed for every size, so sizes no shop has can be shown as unavailable.
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
        // Stock is asked live from the store, so we only need each store's product link: use the most
        // recent offer per store (not just "seen in the last 48h"), otherwise a late or failed scrape
        // makes every product look unavailable.
        const offers: Array<{ store: string; url: string }> = await this.locations.query(
            `SELECT DISTINCT ON (o.store) o.store, o.url FROM offers o
             WHERE o."productId" = $1 AND o."lastSeenAt" >= now() - interval '30 days'
             ORDER BY o.store, o."lastSeenAt" DESC, o.price ASC NULLS LAST`,
            [productId],
        );
        const size = requestedSize ? normalizeSize(requestedSize) : null;

        const perChain = await Promise.all(offers.map((o) => this.forOffer(o)));
        const resolve = await this.resolver(perChain);

        // Shops per size across all chains (unique physical shops we can show on the map).
        const shopsBySize = new Map<string, Set<string>>();
        for (const { stock } of perChain) {
            if (!stock) continue;
            for (const s of stock.sizes) {
                const set = shopsBySize.get(s.size) || new Set<string>();
                for (const ref of stock.shopsBySize[s.size] || []) {
                    const id = resolve.get(ref);
                    if (id) set.add(id);
                }
                shopsBySize.set(s.size, set);
            }
        }

        const sizes = [...shopsBySize.keys()].sort(compareSizes);
        const sizeShops = Object.fromEntries(sizes.map((s) => [s, shopsBySize.get(s)!.size]));

        const chains: ChainResult[] = perChain.map(({ chain, stock }) =>
            size && stock?.onlineOnlyBySize[size] ? { ...chain, onlineOnly: true } : chain,
        );

        const ids = size ? [...(shopsBySize.get(size) || [])] : [];
        const locations = ids.length ? await this.locations.find({ where: { id: In(ids) } }) : [];

        return { size, sizes, sizeShops, chains, locations };
    }

    private async forOffer(offer: { store: string; url: string }): Promise<{ chain: ChainResult; stock: ChainStock | null }> {
        const provider = AVAILABILITY_PROVIDERS[offer.store];
        const base = { store: offer.store, url: offer.url };
        if (!provider) return { chain: { ...base, status: 'unsupported', sizes: [] }, stock: null };

        try {
            const stock = await this.cached(`stock|${offer.url}`, () => this.loadStock(provider, offer.url));
            return {
                chain: { ...base, status: 'ok', sizes: stock.sizes.map(({ size, level }) => ({ size, level })) },
                stock,
            };
        } catch (e) {
            this.log.warn(`Availability for ${offer.store} failed: ${(e as Error).message}`);
            return { chain: { ...base, status: 'error', sizes: [] }, stock: null };
        }
    }

    /** One chain's sizes plus shops for every size (one request per size where the chain needs it). */
    private async loadStock(provider: AvailabilityProvider, url: string): Promise<ChainStock> {
        const listing = await provider.sizes(url);
        if (listing.shopsBySize || !provider.shopsForSize) {
            return { sizes: listing.sizes, shopsBySize: listing.shopsBySize || {}, onlineOnlyBySize: {} };
        }
        const limit = pLimit(PER_STORE_CONCURRENCY);
        const shopsBySize: Record<string, string[]> = {};
        const onlineOnlyBySize: Record<string, boolean> = {};
        await Promise.all(
            listing.sizes.map((s) =>
                limit(async () => {
                    try {
                        const r = await provider.shopsForSize!(url, s);
                        shopsBySize[s.size] = r.locationIds;
                        if (r.onlineOnly) onlineOnlyBySize[s.size] = true;
                    } catch (e) {
                        this.log.warn(`Shops for size ${s.size} failed: ${(e as Error).message}`);
                    }
                }),
            ),
        );
        return { sizes: listing.sizes, shopsBySize, onlineOnlyBySize };
    }

    /** Map shop refs to store_locations ids: ids pass through, "url:<link>" refs are matched by URL. */
    private async resolver(perChain: Array<{ chain: ChainResult; stock: ChainStock | null }>): Promise<Map<string, string>> {
        const refs = new Map<string, string>(); // ref -> store
        for (const { chain, stock } of perChain) {
            for (const list of Object.values(stock?.shopsBySize || {})) for (const ref of list) refs.set(ref, chain.store);
        }
        const out = new Map<string, string>();
        const byUrl = [...refs.entries()].filter(([ref]) => ref.startsWith('url:'));
        const byId = [...refs.keys()].filter((ref) => !ref.startsWith('url:'));

        if (byId.length) {
            const found = await this.locations.find({ where: { id: In(byId) }, select: { id: true } });
            for (const l of found) out.set(l.id, l.id);
        }
        if (byUrl.length) {
            const stores = [...new Set(byUrl.map(([, store]) => store))];
            const found = await this.locations.find({ where: { store: In(stores) }, select: { id: true, url: true } });
            const norm = (u: string | null) => (u || '').trim().replace(/\/+$/, '').toLowerCase();
            const idByUrl = new Map(found.map((l) => [norm(l.url), l.id]));
            for (const [ref] of byUrl) {
                const id = idByUrl.get(norm(ref.slice(4)));
                if (id) out.set(ref, id);
                else this.log.warn(`Unknown shop link ${ref.slice(4)} (store locations may need a sync)`);
            }
        }
        return out;
    }
}

function compareSizes(a: string, b: string): number {
    const na = sizeValue(a);
    const nb = sizeValue(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    if (!Number.isNaN(na)) return -1;
    if (!Number.isNaN(nb)) return 1;
    const order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    return a.localeCompare(b);
}
