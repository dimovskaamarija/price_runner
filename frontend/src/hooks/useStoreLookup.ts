import { useMemo } from "react";
import { useStores, type Store } from "./useStores";

/** Chains that aren't in the stores table get a readable name here. */
const CHAIN_LABELS: Record<string, string> = {
    // Intersport shops come from Sport M's "find in store" (same company group).
    "Intersport MK": "Sport M - Intersport",
};

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
                // Prefix match only ("Sport Vision MK" -> "Sport Vision"); a substring match would wrongly
                // turn "Intersport MK" into "Sport M".
                stores.find((s) => s.name.toLowerCase().startsWith(lower) || lower.startsWith(s.name.toLowerCase()))
            );
        };

        /** Name to show for a chain (offers' store name -> display name). */
        const chainName = (storeName: string): string => CHAIN_LABELS[storeName] || getStore(storeName)?.name || storeName;

        return { storesMap, getStore, chainName };
    }, [stores]);
}
