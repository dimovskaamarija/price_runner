import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { PriceHistory } from './entities/price-history.entity';
import { Store } from './entities/store.entity';
import { Product as ProductType } from '../common/types/product';

@Injectable()
export class PostgresService {
    private readonly log = new Logger(PostgresService.name);
    private readonly MAX_HISTORY_ENTRIES = 100;

    constructor(
        @InjectRepository(Product)
        public productRepository: Repository<Product>,
        @InjectRepository(PriceHistory)
        private priceHistoryRepository: Repository<PriceHistory>,
        @InjectRepository(Store)
        private storeRepository: Repository<Store>,
    ) {}

    private isPgUniqueViolation(error: any) {
        return (
            error &&
            (error.code === '23505' ||
                (typeof error.message === 'string' &&
                    error.message.toLowerCase().includes('duplicate key')))
        );
    }

    private capitalizeColor(color: string): string {
        if (!color) return color;
        return color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    }

    private capitalizeBrand(brand: string): string {
        if (!brand) return brand;
        return brand
            .split(' ')
            .map((word) => {
                if (!word) return word;
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    }

    private getDistinctAndNormalized(column: string, normalizeFn?: (val: string) => string): Promise<string[]> {
        return this.productRepository
            .createQueryBuilder("p")
            .select(`p.${column}`, column)
            .where(`p.${column} IS NOT NULL AND p.${column} != ''`)
            .getRawMany()
            .then(rows => {
                const values = rows.map((r) => r[column] as string);
                
                const uniqueMap = new Map<string, string>();
                
                for (const value of values) {
                    if (!value) continue;
                    const lowerKey = value.toLowerCase().trim();
                    
                    if (!uniqueMap.has(lowerKey)) {
                        uniqueMap.set(lowerKey, value);
                    } else {
                        if (normalizeFn) {
                            const current = uniqueMap.get(lowerKey)!;
                            const normalized = normalizeFn(value);
                            if (normalized !== normalized.toLowerCase() && current === current.toLowerCase()) {
                                uniqueMap.set(lowerKey, normalized);
                            }
                        }
                    }
                }
                
                let result = Array.from(uniqueMap.values());
                if (normalizeFn) {
                    result = result.map(normalizeFn);
                    const normalizedMap = new Map<string, string>();
                    for (const value of result) {
                        const lowerKey = value.toLowerCase().trim();
                        if (!normalizedMap.has(lowerKey)) {
                            normalizedMap.set(lowerKey, value);
                        }
                    }
                    result = Array.from(normalizedMap.values());
                }
                
                return result.sort((a, b) => a.localeCompare(b));
            });
    }

    async upsertProduct(doc: ProductType, store?: string, price?: number | null, date?: Date): Promise<void> {
        const now = date || new Date();

        if (store && price != null) {
            await this.addPriceHistory(doc.id, store, price, now);
        }

        const existing = await this.productRepository.findOne({ where: { id: doc.id } });

        if (existing) {
            const mergedPriceMap: Record<string, number | null> = { ...(existing.priceMap || {}) };
            if (store && price != null) mergedPriceMap[store] = price;

            if (doc.priceMap) {
                for (const [s, p] of Object.entries(doc.priceMap)) {
                    if (p != null || s in mergedPriceMap) {
                        mergedPriceMap[s] = p as number | null;
                    }
                }
            }

            const mergedStoreLinks = { ...(existing.storeLinks || {}), ...(doc.storeLinks || {}) };

            await this.productRepository.update(
                { id: doc.id },
                {
                    name: doc.name,
                    brand: doc.brand ? this.capitalizeBrand(doc.brand) : doc.brand,
                    category: doc.category,
                    subcategory: doc.subcategory,
                    gender: doc.gender,
                    age: doc.age,
                    color: doc.color ? this.capitalizeColor(doc.color) : doc.color,
                    image: doc.image,
                    priceMap: mergedPriceMap,
                    storeLinks: mergedStoreLinks,
                    productUrl: doc.productUrl,
                    currency: doc.currency || 'MKD',
                    updatedAt: now,
                },
            );
            return;
        }

        const initialPriceMap: Record<string, number | null> =
            doc.priceMap
                ? { ...doc.priceMap }
                : store && price != null
                    ? { [store]: price }
                    : {};

        try {
            await this.productRepository.save({
                id: doc.id,
                name: doc.name,
                brand: doc.brand,
                category: doc.category,
                subcategory: doc.subcategory,
                gender: doc.gender,
                age: doc.age,
                color: doc.color ? this.capitalizeColor(doc.color) : doc.color,
                image: doc.image,
                priceMap: initialPriceMap,
                storeLinks: doc.storeLinks || {},
                productUrl: doc.productUrl,
                currency: doc.currency || 'MKD',
                createdAt: now,
                updatedAt: now,
            });
        } catch (error: any) {
            if (this.isPgUniqueViolation(error)) {
                this.log.warn(`Product insert race for id=${doc.id} — skipping duplicate.`);
                return;
            }
            throw error;
        }
    }

    public async addPriceHistory(productId: string, store: string, price: number, date: Date) {
        const dateKey = date.toISOString().split('T')[0];
        const dateObj = new Date(dateKey);

        try {
            const existing = await this.priceHistoryRepository.findOne({
                where: { productId, store, date: dateObj },
            });

            if (existing) {
                await this.priceHistoryRepository.update({ id: existing.id }, { price: Number(price) });
            } else {
                await this.priceHistoryRepository.save({
                    productId,
                    store,
                    price: Number(price),
                    date: dateObj,
                });
            }
        } catch (error: any) {
            if (this.isPgUniqueViolation(error)) {
                this.log.warn(
                    `Unique key conflict inserting price_history for ${productId}, store=${store}, date=${dateKey}.`,
                );
            } else {
                this.log.error(`Error inserting price_history for ${productId}: ${error?.message}`);
                throw error;
            }
        }

        const all = await this.priceHistoryRepository.find({
            where: { productId, store },
            order: { date: 'DESC' },
        });
        if (all.length > this.MAX_HISTORY_ENTRIES) {
            const ids = all.slice(this.MAX_HISTORY_ENTRIES).map((h) => h.id);
            await this.priceHistoryRepository.delete(ids);
        }
    }

    async findAllProducts(): Promise<ProductType[]> {
        try {
            const products = await this.productRepository.find();
            const productIds = products.map((p) => p.id);

            // Get today's date in YYYY-MM-DD format (UTC)
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Calculate yesterday's date as fallback
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const allPriceHistory = productIds.length
                ? await this.priceHistoryRepository.find({
                    where: { productId: In(productIds) },
                    order: { date: 'DESC' },
                })
                : [];

            const priceHistoryMap = new Map<string, Record<string, Record<string, number>>>();
            // Map of productId -> Set of stores that have today's date
            const todayStoresMap = new Map<string, Set<string>>();
            // Map of productId -> Set of stores that have yesterday's date
            const yesterdayStoresMap = new Map<string, Set<string>>();

            for (const h of allPriceHistory) {
                if (!priceHistoryMap.has(h.productId)) priceHistoryMap.set(h.productId, {});
                const perStore = priceHistoryMap.get(h.productId)!;
                if (!perStore[h.store]) perStore[h.store] = {};
                const d = h.date.toISOString().split('T')[0];
                perStore[h.store][d] = Number(h.price);

                // Track stores that have today's date
                if (d === todayStr) {
                    if (!todayStoresMap.has(h.productId)) {
                        todayStoresMap.set(h.productId, new Set());
                    }
                    todayStoresMap.get(h.productId)!.add(h.store);
                }
                
                // Track stores that have yesterday's date (for fallback)
                if (d === yesterdayStr) {
                    if (!yesterdayStoresMap.has(h.productId)) {
                        yesterdayStoresMap.set(h.productId, new Set());
                    }
                    yesterdayStoresMap.get(h.productId)!.add(h.store);
                }
            }

            // Determine which date to use: if today has no records, use yesterday
            const hasTodayRecords = todayStoresMap.size > 0;
            const targetDateStr = hasTodayRecords ? todayStr : yesterdayStr;
            const targetStoresMap = hasTodayRecords ? todayStoresMap : yesterdayStoresMap;

            // Filter products and stores
            return products
                .map((p) => {
                    const targetStores = targetStoresMap.get(p.id);
                    
                    // Skip products that don't have any store with the target date (today or yesterday)
                    if (!targetStores || targetStores.size === 0) {
                        return null;
                    }

                    // Filter priceMap and storeLinks to only include stores with the target date
                    const filteredPriceMap: Record<string, number | null> = {};
                    const filteredStoreLinks: Record<string, string> = {};
                    const originalPriceMap = p.priceMap || {};
                    const originalStoreLinks = p.storeLinks || {};

                    // Get the price from price history for the target date
                    const productPriceHistory = priceHistoryMap.get(p.id) || {};
                    for (const store of targetStores) {
                        // Use the price from price history for the target date
                        const storePriceHistory = productPriceHistory[store] || {};
                        const priceForDate = storePriceHistory[targetDateStr];
                        
                        if (priceForDate !== undefined) {
                            filteredPriceMap[store] = priceForDate;
                        } else if (originalPriceMap[store] !== undefined) {
                            filteredPriceMap[store] = originalPriceMap[store];
                        }
                        
                        if (originalStoreLinks[store]) {
                            filteredStoreLinks[store] = originalStoreLinks[store];
                        }
                    }

                    return {
                        id: p.id,
                        name: p.name,
                        brand: p.brand,
                        category: p.category,
                        subcategory: p.subcategory,
                        gender: p.gender,
                        age: p.age,
                        color: p.color,
                        image: p.image,
                        priceMap: filteredPriceMap,
                        storeLinks: filteredStoreLinks,
                        priceHistory: priceHistoryMap.get(p.id) || {},
                        productUrl: p.productUrl,
                        currency: p.currency,
                        createdAt: p.createdAt,
                        updatedAt: p.updatedAt,
                    } as ProductType;
                })
                .filter((p): p is ProductType => p !== null);
        } catch (error: any) {
            this.log.error(`Error finding all products:`, error.message);
            throw error;
        }
    }

    async findProductById(id: string): Promise<ProductType | null> {
        try {
            const product = await this.productRepository.findOne({ where: { id } });
            if (!product) return null;

            const priceHistoryRecords = await this.priceHistoryRepository.find({
                where: { productId: id },
                order: { date: 'DESC' },
            });

            const priceHistory: Record<string, Record<string, number>> = {};
            for (const h of priceHistoryRecords) {
                if (!priceHistory[h.store]) priceHistory[h.store] = {};
                const d = h.date.toISOString().split('T')[0];
                priceHistory[h.store][d] = Number(h.price);
            }

            return {
                id: product.id,
                name: product.name,
                brand: product.brand,
                category: product.category,
                subcategory: product.subcategory,
                gender: product.gender,
                age: product.age,
                color: product.color,
                image: product.image,
                priceMap: product.priceMap || {},
                storeLinks: product.storeLinks || {},
                priceHistory,
                productUrl: product.productUrl,
                currency: product.currency,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
            } as ProductType;
        } catch (error: any) {
            this.log.error(`Error finding product ${id}:`, error.message);
            throw error;
        }
    }

    async getDistinctValues(column: string): Promise<string[]> {
        const rows = await this.productRepository
            .createQueryBuilder("p")
            .select(`DISTINCT p.${column}`, column)
            .where(`p.${column} IS NOT NULL AND p.${column} != ''`)
            .orderBy(`p.${column}`, "ASC")
            .getRawMany();

        return rows.map((r) => r[column]);
    }

    async getDistinctNavBarValues(
        column: string,
        ages: string[],
        genders: string[],
        categories: string[]
    ): Promise<string[]> {

        const qb = this.productRepository
            .createQueryBuilder("p")
            .select(`DISTINCT p.${column}`, column)
            .where(`p.${column} IS NOT NULL AND p.${column} != ''`);

        if (ages.length > 0) {
            qb.andWhere("p.age IN (:...ages)", { ages });
        }

        if (genders.length > 0) {
            qb.andWhere("p.gender IN (:...genders)", { genders });
        }

        if (categories.length > 0) {
            qb.andWhere("p.category IN (:...categories)", { categories });
        }

        qb.orderBy(`p.${column}`, "ASC");

        const rows = await qb.getRawMany();
        return rows.map((r) => r[column]);
    }

    async getFilterOptions() {
        return {
            categories: await this.getDistinctValues("category"),
            subcategories: await this.getDistinctValues("subcategory"),
            brands: await this.getDistinctAndNormalized("brand", (b) => this.capitalizeBrand(b)),
            genders: await this.getDistinctValues("gender"),
            ages: await this.getDistinctValues("age"),
            colors: await this.getDistinctAndNormalized("color", (c) => this.capitalizeColor(c)),
        };
    }

    async getFilterNavBarOptions() {
        return {
            maleShoes: await this.getDistinctNavBarValues("subcategory", ['За возрасни'], ['Машки', 'Унисекс'], ['Обувки']),
            maleClothes: await this.getDistinctNavBarValues("subcategory", ['За возрасни'], ['Машки', 'Унисекс'], ['Текстил']),
            maleEquipment: await this.getDistinctNavBarValues("subcategory", ['За возрасни'], ['Машки', 'Унисекс'], ['Опрема']),
            femaleShoes: await this.getDistinctNavBarValues("subcategory", ['За возрасни'], ['Женски', 'Унисекс'], ['Обувки']),
            femaleClothes: await this.getDistinctNavBarValues("subcategory", ['За возрасни'], ['Женски', 'Унисекс'], ['Текстил']),
            femaleEquipment: await this.getDistinctNavBarValues("subcategory", ['За возрасни'], ['Женски', 'Унисекс'], ['Опрема']),
            kidsShoes: await this.getDistinctNavBarValues("subcategory", ['За деца'], ['Машки', 'Женски','Унисекс'], ['Обувки']),
            kidsClothes: await this.getDistinctNavBarValues("subcategory", ['За деца'], ['Машки', 'Унисекс'], ['Текстил']),
            kidsEquipment: await this.getDistinctNavBarValues("subcategory", ['За деца'], ['Машки', 'Унисекс'], ['Опрема']),
        };
    }

    async getAllStores() {
        return this.storeRepository.find({
            order: { name: 'ASC' },
        });
    }
}
