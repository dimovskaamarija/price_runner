import { Controller, Get, Query, Param, HttpException, HttpStatus } from "@nestjs/common";
import { ProductsService } from "../services/ProductService";
import { PostgresService } from "../postgres/postgres.service";

@Controller("products")
export class ProductController {
    constructor(private readonly postgresService: PostgresService, private readonly productsService: ProductsService) { }

    @Get("filter-options")
    async getFilterOptions() {
        return this.postgresService.getFilterOptions();
    }

    @Get()
    async getProducts(
        @Query("page") page = "1",
        @Query("sort") sort = "price-asc",
        @Query("category") category?: string,
        @Query("subcategory") subcategory?: string,
        @Query("brand") brand?: string,
        @Query("age") age?: string,
        @Query("gender") gender?: string,
        @Query("color") color?: string,
        @Query("minPrice") minPrice = "0",
        @Query("maxPrice") maxPrice = "20000",
        @Query('search') search?: string
    ) {
        const filters = {
            search: search || "",
            category: category ? category.split(",") : [],
            subcategory: subcategory ? subcategory.split(",") : [],
            brand: brand ? brand.split(",") : [],
            age: age ? age.split(",") : [],
            gender: gender ? gender.split(",") : [],
            color: color ? color.split(",") : [],
            minPrice: parseInt(minPrice, 10),
            maxPrice: parseInt(maxPrice, 10),
        };

        const p = Math.max(parseInt(page, 10) || 1, 1);
        const PAGE_SIZE = 24;

        try {
            return this.productsService.getFilteredProducts(p, PAGE_SIZE, sort, filters);
        } catch {
            throw new HttpException("Failed to fetch products", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

   @Get("nav-data")
async getNavData() {
    const navbar = await this.postgresService.getFilterNavBarOptions();

    const filterOptions = await this.postgresService.getFilterOptions();

    const all = await this.productsService.getAllProducts();

    const DODATOCI = [
        "Ранец", "Торби и торбички", "Шалови", "Врвки",
        "Ракавици", "Качкети и капи", "Чорапи", "Бандани"
    ];

    const OPREMA = [
        "Топки", "Опрема за пливање", "Опрема за тренинг",
        "Ролери", "Тротинет", "Шишишта", "Останато"
    ];

    const equipment = {
        dodatoci: [],
        sports: []
    };

    const topBrandCounter: Record<string, number> = {};
    const allBrands: Record<string, string[]> = {};

    const push = (arr: string[], v: string) => {
        if (v && !arr.includes(v)) arr.push(v);
    };

    for (const p of all) {
        const sub = (p.subcategory || "").trim();
        const category = (p.category || "").trim();
        const brand = (p.brand || "").trim();

        if (brand) {
            topBrandCounter[brand] = (topBrandCounter[brand] || 0) + 1;

            const letter = brand[0].toUpperCase();
            if (!allBrands[letter]) allBrands[letter] = [];
            if (!allBrands[letter].includes(brand)) {
                allBrands[letter].push(brand);
            }
        }

        if (category === "Опрема") {
            if (DODATOCI.includes(sub)) push(equipment.dodatoci, sub);
            if (OPREMA.includes(sub)) push(equipment.sports, sub);
        }
    }

    for (const key of Object.keys(allBrands)) {
        allBrands[key].sort((a, b) => a.localeCompare(b));
    }

    const topBrands = Object.entries(topBrandCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    return {
        menu: {
            men: {
                Обувки: navbar.maleShoes,
                Текстил: navbar.maleClothes,
                Опрема: navbar.maleEquipment,
            },
            women: {
                Обувки: navbar.femaleShoes,
                Текстил: navbar.femaleClothes,
                Опрема: navbar.femaleEquipment,
            },
            kids: {
                Обувки: navbar.kidsShoes,
                Текстил: navbar.kidsClothes,
                Опрема: navbar.kidsEquipment,
            }
        },

        equipment,

        brands: {
            top: topBrands,
            all: allBrands
        },

        filters: filterOptions
    };
}

    @Get(":id")
    async getProductById(@Param("id") id: string) {
        const p = await this.productsService.getProductById(id);
        if (!p) throw new HttpException("Product not found", HttpStatus.NOT_FOUND);
        return p;
    }

}
