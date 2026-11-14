/** Public product shape returned by the API (kept compatible with the existing frontend). */
export interface ProductDto {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    gender?: string;
    age?: string;
    color?: string;
    image?: string | null;
    /** store -> current price */
    priceMap: Record<string, number | null>;
    /** store -> product page URL */
    storeLinks: Record<string, string>;
    minPrice?: number | null;
    storeCount?: number;
    productUrl?: string;
    currency?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ProductFilters {
    search: string;
    category: string[];
    subcategory: string[];
    brand: string[];
    age: string[];
    gender: string[];
    color: string[];
    minPrice: number;
    maxPrice: number;
}
