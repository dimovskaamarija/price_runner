import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { PriceHistory } from './entities/price-history.entity';
import { Product as ProductType } from '../common/types/product';

@Injectable()
export class PostgresService {
    private readonly log = new Logger(PostgresService.name);
    private readonly MAX_HISTORY_ENTRIES = 100;

    constructor(
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
        @InjectRepository(PriceHistory)
        private priceHistoryRepository: Repository<PriceHistory>,
    ) { }

    private isPgUniqueViolation(error: any) {
        return (
            error &&
            (error.code === '23505' ||
                (typeof error.message === 'string' &&
                    error.message.toLowerCase().includes('duplicate key')))
        );
    }

    async upsertProduct(
        doc: ProductType,
        store?: string,
        price?: number | null,
        date?: Date,
    ): Promise<void> {
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
                    brand: doc.brand,
                    category: doc.category,
                    subcategory: doc.subcategory,
                    gender: doc.gender,
                    age: doc.age,
                    color: doc.color ? doc.color.toLowerCase() : doc.color,
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
                color: doc.color ? doc.color.toLowerCase() : doc.color,
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

            const allPriceHistory = productIds.length
                ? await this.priceHistoryRepository.find({
                    where: { productId: In(productIds) },
                    order: { date: 'DESC' },
                })
                : [];

            const priceHistoryMap = new Map<string, Record<string, Record<string, number>>>();
            for (const h of allPriceHistory) {
                if (!priceHistoryMap.has(h.productId)) priceHistoryMap.set(h.productId, {});
                const perStore = priceHistoryMap.get(h.productId)!;
                if (!perStore[h.store]) perStore[h.store] = {};
                const d = h.date.toISOString().split('T')[0];
                perStore[h.store][d] = Number(h.price);
            }

            return products.map((p) => ({
                id: p.id,
                name: p.name,
                brand: p.brand,
                category: p.category,
                subcategory: p.subcategory,
                gender: p.gender,
                age: p.age,
                color: p.color,
                image: p.image,
                priceMap: p.priceMap || {},
                storeLinks: p.storeLinks || {},
                priceHistory: priceHistoryMap.get(p.id) || {},
                productUrl: p.productUrl,
                currency: p.currency,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            })) as ProductType[];
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

    async getFilterOptions() {
        return {
            categories: await this.getDistinctValues("category"),
            subcategories: await this.getDistinctValues("subcategory"),
            brands: await this.getDistinctValues("brand"),
            genders: await this.getDistinctValues("gender"),
            ages: await this.getDistinctValues("age"),
            colors: await this.getDistinctValues("color"),
        };
    }

}
