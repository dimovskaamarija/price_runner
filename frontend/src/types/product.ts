export interface Product {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    gender?: string;
    age?: string;
    color?: string;
    image?: string;
    priceMap?: Record<string, number | null>;
    storeLinks?: Record<string, string>;
    productUrl?: string;
    currency?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

