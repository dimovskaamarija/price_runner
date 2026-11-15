import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export interface PriceHistory {
    store: string;
    price: number;
    date: string;
}

export type HistoryRange = '1m' | '3m' | 'all';

export function usePriceHistory(productId: string | undefined, range: HistoryRange = '1m') {
    return useQuery<PriceHistory[]>({
        queryKey: ['price-history', productId, range],
        queryFn: async () => {
            if (!productId) throw new Error('Product ID is required');
            return api.get<PriceHistory[]>(`/products/${productId}/history?range=${range}`);
        },
        placeholderData: keepPreviousData, // keep the chart while switching ranges
        enabled: !!productId,
        staleTime: 1000 * 60 * 10, // 10 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
    });
}
