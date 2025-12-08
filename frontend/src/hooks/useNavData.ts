import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

type MenuGroup = {
    shoes: string[];
    clothes: string[];
    equipment: string[];
};

export type NavData = {
    menu: {
        men: MenuGroup;
        women: MenuGroup;
        kids: MenuGroup;
    };
    equipment: {
        dodatoci: string[];
        sports: string[];
    };
    brands: {
        top: { name: string; count: number }[];
        all: Record<string, string[]>;
    };
    filters: {
        categories: string[];
        subcategories: string[];
        brands: string[];
        ages: string[];
        genders: string[];
        colors: string[];
    };
};

export function useNavData() {
    return useQuery<NavData>({
        queryKey: ['nav-data'],
        queryFn: async () => {
            return api.get<NavData>('/products/nav-data');
        },
        staleTime: 1000 * 60 * 15, // 15 minutes - nav data changes rarely
        gcTime: 1000 * 60 * 60, // 1 hour
    });
}
