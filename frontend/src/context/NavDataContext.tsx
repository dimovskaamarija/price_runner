import {createContext, useContext, useEffect, useState} from "react";
import type { ReactNode } from "react";
import { api } from "../utils/api";

type MenuGroup = {
    shoes: string[];
    clothes: string[];
    equipment: string[];
};

type NavData = {
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

type NavDataContextType = {
    navData: NavData | null;
    loading: boolean;
};

const NavDataContext = createContext<NavDataContextType>({
    navData: null,
    loading: true,
});

export function NavDataProvider({ children }: { children: ReactNode }) {
    const [navData, setNavData] = useState<NavData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.get<NavData>("/products/nav-data");
                setNavData(data);
            } catch (err) {
                console.error("Failed to load nav-data:", err);
            }
            setLoading(false);
        };

        load();
    }, []);

    return (
        <NavDataContext.Provider value={{ navData, loading }}>
            {children}
        </NavDataContext.Provider>
    );
}

export function useNavData() {
    return useContext(NavDataContext);
}
