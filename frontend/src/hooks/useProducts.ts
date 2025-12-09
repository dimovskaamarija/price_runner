import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export interface Product {
    id: string;
    name: string;
    image?: string;
    priceMap?: Record<string, number | null>;
    updatedAt?: string;
    popularity?: number;
    brand?: string;
    gender?: string;
    age?: string;
    subcategory?: string;
    category?: string;
    color?: string;
    storeLinks?: Record<string, string>;
}

interface ProductsResponse {
    items: Product[];
    total: number;
}

interface ProductFilters {
    page?: number;
    sort?: string;
    search?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
    age?: string;
    gender?: string;
    color?: string;
    minPrice?: number;
    maxPrice?: number;
}

export function useProducts(filters: ProductFilters) {
    return useQuery<ProductsResponse>({
        queryKey: ['products', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.page) params.set('page', String(filters.page));
            if (filters.sort) params.set('sort', filters.sort);
            if (filters.search) params.set('search', filters.search);
            if (filters.category) params.set('category', filters.category);
            if (filters.subcategory) params.set('subcategory', filters.subcategory);
            if (filters.brand) params.set('brand', filters.brand);
            if (filters.age) params.set('age', filters.age);
            if (filters.gender) params.set('gender', filters.gender);
            if (filters.color) params.set('color', filters.color);
            if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
            if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
            
            return api.get<ProductsResponse>(`/products?${params.toString()}`);
        },
        staleTime: 1000 * 60 * 1, // 1 minute - reduced to show new data faster
        gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
    });
}

export function useProduct(id: string | undefined) {
    return useQuery<Product>({
        queryKey: ['product', id],
        queryFn: async () => {
            if (!id) throw new Error('Product ID is required');
            return api.get<Product>(`/products/${id}`);
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 1, // 1 minute - reduced to show new data faster
        gcTime: 1000 * 60 * 10, // 10 minutes
    });
}

export function useFilterOptions() {
    return useQuery({
        queryKey: ['filter-options'],
        queryFn: async () => {
            return api.get('/products/filter-options');
        },
        staleTime: 1000 * 60 * 10, // 10 minutes - filter options change rarely
        gcTime: 1000 * 60 * 60, // 1 hour
    });
}
