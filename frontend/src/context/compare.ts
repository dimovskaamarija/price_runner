import { createContext, useContext } from "react";

export const MAX_COMPARE = 4;

/** Minimal product info kept in the compare list, enough to render the tray without a request. */
export interface CompareItem {
    id: string;
    name: string;
    image?: string | null;
}

export interface CompareContextValue {
    items: CompareItem[];
    ids: string[];
    isFull: boolean;
    has: (id: string) => boolean;
    toggle: (item: CompareItem) => void;
    remove: (id: string) => void;
    clear: () => void;
    replace: (items: CompareItem[]) => void;
}

export const CompareContext = createContext<CompareContextValue | null>(null);

export function useCompare() {
    const ctx = useContext(CompareContext);
    if (!ctx) throw new Error("useCompare must be used inside <CompareProvider>");
    return ctx;
}
