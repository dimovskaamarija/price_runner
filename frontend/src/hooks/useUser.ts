import { useQuery } from "@tanstack/react-query";
import type { User } from "../types/user";
import { api } from "../utils/api";

export function useUser() {
    const { data: user, refetch: refreshUser } = useQuery<User | null>({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                return await api.auth.get<User>('/auth/me');
            } catch (error) {
                return null;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 15, // 15 minutes
    });

    return { user: user ?? null, refreshUser };
}
