import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export interface Store {
    id: string;
    name: string;
    logo_url?: string;
}

export function useStores() {
    return useQuery<Store[]>({
        queryKey: ['stores'],
        queryFn: async () => {
            return api.get<Store[]>('/products/stores');
        },
        staleTime: 1000 * 60 * 30, // 30 minutes - stores change rarely
        gcTime: 1000 * 60 * 60, // 1 hour
    });
}
