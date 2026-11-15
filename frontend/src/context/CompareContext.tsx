import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CompareContext, MAX_COMPARE, type CompareContextValue, type CompareItem } from "./compare";

const STORAGE_KEY = "compare";

function load(): CompareItem[] {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(raw) ? raw.filter((i) => i && typeof i.id === "string").slice(0, MAX_COMPARE) : [];
    } catch {
        return [];
    }
}

function save(items: CompareItem[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        /* private mode / storage full: the list still works for this tab */
    }
}

export function CompareProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CompareItem[]>(load);

    useEffect(() => save(items), [items]);

    // Keep several open tabs in sync.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setItems(load());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

    const toggle = useCallback((item: CompareItem) => {
        setItems((prev) => {
            if (prev.some((i) => i.id === item.id)) return prev.filter((i) => i.id !== item.id);
            if (prev.length >= MAX_COMPARE) return prev;
            return [...prev, { id: item.id, name: item.name, image: item.image }];
        });
    }, []);

    const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
    const clear = useCallback(() => setItems([]), []);
    const replace = useCallback((next: CompareItem[]) => setItems(next.slice(0, MAX_COMPARE)), []);

    const value = useMemo<CompareContextValue>(
        () => ({
            items,
            ids: items.map((i) => i.id),
            isFull: items.length >= MAX_COMPARE,
            has,
            toggle,
            remove,
            clear,
            replace,
        }),
        [items, has, toggle, remove, clear, replace],
    );

    return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}
