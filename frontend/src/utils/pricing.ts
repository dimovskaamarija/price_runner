export function getMinPrice(priceMap?: Record<string, number | null>): number | null {
    const prices = Object.values(priceMap || {}).filter((p): p is number => p != null);
    return prices.length ? Math.min(...prices) : null;
}

export function formatPrice(price: number | null): string {
    return price != null ? `${price.toLocaleString()} ден` : "Нема цена";
}
