import { useMemo } from "react";
import { useStores, type Store } from "./useStores";

/**
 * Offers use scraper store names ("Sport Vision MK") while the stores table may use
 * shorter ones ("Sport Vision"); this resolves either to the store record (name + logo).
 */
export function useStoreLookup() {
    const { data: stores = [] } = useStores();

    return useMemo(() => {
        const storesMap: Record<string, Store | undefined> = {};
        for (const s of stores) {
            storesMap[s.id] = s;
            storesMap[s.id.toLowerCase()] = s;
            storesMap[s.name] = s;
            storesMap[s.name.toLowerCase()] = s;
        }

        const getStore = (storeName: string): Store | undefined => {
            const lower = storeName.toLowerCase();
            return (
                storesMap[storeName] ||
                storesMap[lower] ||
                stores.find((s) => s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase()))
            );
        };

        return { storesMap, getStore };
    }, [stores]);
}
