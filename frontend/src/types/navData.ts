export type CategoryMap = Record<string, string[]>;

export interface NavData {
    menu: {
        men: CategoryMap;
        women: CategoryMap;
        kids: CategoryMap;
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
        genders: string[];
        ages: string[];
        colors: string[];
    };
}
