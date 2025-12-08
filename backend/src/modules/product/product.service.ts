import { Injectable } from "@nestjs/common";
import { PostgresService } from "../../database/postgres.service";

@Injectable()
export class ProductsService {
    constructor(private readonly postgres: PostgresService) {}

    async getFilterOptions() {
        return this.postgres.getFilterOptions();
    }

    async getAllProducts() {
        return this.postgres.findAllProducts();
    }

    async getFilteredProducts(page: number, pageSize: number, sort: string, filters: any) {
        const all = await this.postgres.findAllProducts();

        const getMin = (pm?: Record<string, number | null>) => {
            const v = Object.values(pm || {}).filter((p): p is number => p != null);
            return v.length ? Math.min(...v) : null;
        };

        let f = all;

        if (filters.category.length) {
            f = f.filter((p) => filters.category.includes(p.category || ''));
        }

        if (filters.subcategory.length) {
            f = f.filter((p) => filters.subcategory.includes(p.subcategory || ''));
        }

        if (filters.brand.length) {
            f = f.filter((p) => filters.brand.includes(p.brand || ''));
        }

        if (filters.age.length) {
            f = f.filter((p) => filters.age.includes(p.age || ''));
        }

        if (filters.gender.length) {
            f = f.filter((p) => filters.gender.includes(p.gender || ''));
        }

        if (filters.color.length) {
            f = f.filter((p) => filters.color.includes(p.color || ''));
        }

        if (filters.search) {
            const q = filters.search.toLowerCase();

            f = f.filter((p) =>
                [
                    p.name,
                    p.brand,
                    p.color,
                    p.gender,
                    p.age,
                    p.category,
                    p.subcategory,
                ]
                    .filter(Boolean)
                    .some((v) => v.toLowerCase().includes(q)),
            );
        }

        f = f.filter((p) => {
            const price = getMin(p.priceMap);
            if (price === null) return false;
            return price >= filters.minPrice && price <= filters.maxPrice;
        });

        const sorted = this.sortProducts(f, sort, getMin);

        const start = (page - 1) * pageSize;
        return { items: sorted.slice(start, start + pageSize), total: f.length };
    }

    async getProductById(id: string) {
        return this.postgres.findProductById(id);
    }

    private sortProducts(list: any[], sort: string, gm: any) {
        switch (sort) {
            case 'price-asc':
                return [...list].sort(
                    (a, b) => (gm(a.priceMap) ?? Infinity) - (gm(b.priceMap) ?? Infinity),
                );
            case 'price-desc':
                return [...list].sort(
                    (a, b) => (gm(b.priceMap) ?? -Infinity) - (gm(a.priceMap) ?? -Infinity),
                );
            case 'name-asc':
                return [...list].sort((a, b) => a.name.localeCompare(b.name));
            case 'name-desc':
                return [...list].sort((a, b) => b.name.localeCompare(a.name));
            case 'newest':
                return [...list].sort(
                    (a, b) =>
                        new Date(b.updatedAt || 0).getTime() -
                        new Date(a.updatedAt || 0).getTime(),
                );
            case 'available-desc':
                return [...list].sort(
                    (a, b) =>
                        Object.values(b.priceMap || {}).filter((p) => p != null).length -
                        Object.values(a.priceMap || {}).filter((p) => p != null).length,
                );
            default:
                return list;
        }
    }
}
