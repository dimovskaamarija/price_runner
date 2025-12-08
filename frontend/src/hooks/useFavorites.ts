import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { Product } from './useProducts';

export function useFavorites(user: any) {
    const queryClient = useQueryClient();
    
    const query = useQuery<Product[]>({
        queryKey: ['favorites', user?.id],
        queryFn: async () => {
            if (user) {
                return api.get<Product[]>('/favorites');
            } else {
                const favoriteIds = JSON.parse(localStorage.getItem('favorites') || '[]');
                if (favoriteIds.length === 0) return [];
                
                const productPromises = favoriteIds.map(async (id: string) => {
                    try {
                        return await api.get<Product>(`/products/${id}`);
                    } catch (error) {
                        console.error(`Error fetching product ${id}:`, error);
                        return null;
                    }
                });
                
                const fetchedProducts = await Promise.all(productPromises);
                return fetchedProducts.filter((p): p is Product => p !== null);
            }
        },
        enabled: true,
        staleTime: 1000 * 60 * 2, // 2 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
    });
    
    const addFavorite = useMutation({
        mutationFn: async (productId: string) => {
            if (user) {
                return api.post('/favorites', { productId });
            } else {
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                if (!favorites.includes(productId)) {
                    favorites.push(productId);
                    localStorage.setItem('favorites', JSON.stringify(favorites));
                }
                return { success: true };
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['favorites'] });
            queryClient.invalidateQueries({ queryKey: ['favorite-status'] });
        },
    });
    
    const removeFavorite = useMutation({
        mutationFn: async (productId: string) => {
            if (user) {
                return api.delete(`/favorites/${productId}`);
            } else {
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                const updated = favorites.filter((id: string) => id !== productId);
                localStorage.setItem('favorites', JSON.stringify(updated));
                return { success: true };
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['favorites'] });
            queryClient.invalidateQueries({ queryKey: ['favorite-status'] });
        },
    });
    
    return {
        ...query,
        addFavorite: addFavorite.mutate,
        removeFavorite: removeFavorite.mutate,
        isAdding: addFavorite.isPending,
        isRemoving: removeFavorite.isPending,
    };
}

export function useFavoriteStatus(productId: string | undefined, user: any) {
    return useQuery<{ isFavorite: boolean }>({
        queryKey: ['favorite-status', productId, user?.id],
        queryFn: async () => {
            if (!productId) return { isFavorite: false };
            
            if (user) {
                try {
                    return await api.get<{ isFavorite: boolean }>(`/favorites/${productId}`);
                } catch (error) {
                    return { isFavorite: false };
                }
            } else {
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                return { isFavorite: favorites.includes(productId) };
            }
        },
        enabled: !!productId,
        staleTime: 1000 * 60 * 2, // 2 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
    });
}
