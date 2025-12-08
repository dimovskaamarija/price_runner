import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export interface PriceHistory {
    store: string;
    price: number;
    date: string;
}

export function usePriceHistory(productId: string | undefined) {
    return useQuery<PriceHistory[]>({
        queryKey: ['price-history', productId],
        queryFn: async () => {
            if (!productId) throw new Error('Product ID is required');
            return api.get<PriceHistory[]>(`/products/${productId}/history`);
        },
        enabled: !!productId,
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });
}
