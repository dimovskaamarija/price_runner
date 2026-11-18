import { useQuery } from "@tanstack/react-query";
import { api } from "../utils/api";
import type { WeeklyHours } from "../utils/geo";

export interface StoreLocation {
    id: string;
    store: string;
    name: string;
    address: string | null;
    city: string | null;
    lat: number;
    lng: number;
    approximate: boolean;
    phone: string | null;
    hours: WeeklyHours | null;
    url: string | null;
}

export function useStoreLocations() {
    return useQuery<StoreLocation[]>({
        queryKey: ["store-locations"],
        queryFn: () => api.get<StoreLocation[]>("/stores/locations"),
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 6,
    });
}

/** Marker colour per chain (keys are offers' store names). */
export const CHAIN_COLORS: Record<string, string> = {
    "Sport Vision MK": "#dc2626",
    "Sport Reality MK": "#2563eb",
    "Buzz Sneakers MK": "#111827",
    "Sizeer MK": "#16a34a",
    "Sport M": "#f59e0b",
    "D Sport": "#7c3aed",
    "Intersport MK": "#0e7490",
};
export const chainColor = (store: string) => CHAIN_COLORS[store] || "#6b7280";
