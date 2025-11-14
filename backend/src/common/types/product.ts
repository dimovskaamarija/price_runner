export interface Product {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    gender?: string;
    age?: string;
    color?: string;
    image?: string | null;
    priceMap?: Record<string, number | null>;
    storeLinks?: Record<string, string>;
    priceHistory?: Record<string, Record<string, number>>;
    productUrl?: string;
    currency?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
