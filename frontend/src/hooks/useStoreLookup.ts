import { useMemo } from "react";
import { useStores, type Store } from "./useStores";

/** Display names for chains that aren't in the stores table (none at the moment). */
const CHAIN_LABELS: Record<string, string> = {};

/** Logos for chains that aren't in the stores table, as files in /public/logos (none at the moment). */
const CHAIN_LOGOS: Record<string, string> = {};

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

        /** Logo to show for a chain, or undefined. */
        const chainLogo = (storeName: string): string | undefined => CHAIN_LOGOS[storeName] || getStore(storeName)?.logo_url;

        return { storesMap, getStore, chainName, chainLogo };
    }, [stores]);
}
