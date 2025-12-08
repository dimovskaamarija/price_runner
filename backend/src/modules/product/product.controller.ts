import { Controller, Get, Query, Param, HttpException, HttpStatus } from "@nestjs/common";
import { ProductsService } from "./product.service";
import { PostgresService } from "../../database/postgres.service";

@Controller("products")
export class ProductController {
    constructor(
        private readonly postgresService: PostgresService,
        private readonly productsService: ProductsService,
    ) {}

    @Get('filter-options')
    async getFilterOptions() {
        return this.postgresService.getFilterOptions();
    }

    @Get()
    async getProducts(
        @Query('page') page = '1',
        @Query('sort') sort = 'price-asc',
        @Query('category') category?: string,
        @Query('subcategory') subcategory?: string,
        @Query('brand') brand?: string,
        @Query('age') age?: string,
        @Query('gender') gender?: string,
        @Query('color') color?: string,
        @Query('minPrice') minPrice = '0',
        @Query('maxPrice') maxPrice = '20000',
        @Query('search') search?: string,
    ) {
        const filters = {
            search: search || '',
            category: category ? category.split(',') : [],
            subcategory: subcategory ? subcategory.split(',') : [],
            brand: brand ? brand.split(',') : [],
            age: age ? age.split(',') : [],
            gender: gender ? gender.split(',') : [],
            color: color ? color.split(',') : [],
            minPrice: parseInt(minPrice, 10),
            maxPrice: parseInt(maxPrice, 10),
        };

        const p = Math.max(parseInt(page, 10) || 1, 1);
        const PAGE_SIZE = 24;

        try {
            return this.productsService.getFilteredProducts(p, PAGE_SIZE, sort, filters);
        } catch {
            throw new HttpException('Failed to fetch products', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('nav-data')
    async getNavData() {
    const navbar = await this.postgresService.getFilterNavBarOptions();

    const filterOptions = await this.postgresService.getFilterOptions();

    const all = await this.productsService.getAllProducts();

    const DODATOCI = [
        'Ранец',
        'Торби и торбички',
        'Шалови',
        'Врвки',
        'Ракавици',
        'Качкети и капи',
        'Чорапи',
        'Бандани',
    ];

    const OPREMA = [
        'Топки',
        'Опрема за пливање',
        'Опрема за тренинг',
        'Ролери',
        'Тротинет',
        'Шишишта',
        'Останато',
    ];

    const equipment = {
        dodatoci: [],
        sports: [],
    };

    const allBrands: Record<string, string[]> = {};

    const push = (arr: string[], v: string) => {
        if (v && !arr.includes(v)) arr.push(v);
    };

    const capitalizeBrand = (brand: string): string => {
        if (!brand) return brand;
        return brand
            .split(' ')
            .map((word) => {
                if (!word) return word;
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    };

    const brandMap = new Map<string, { normalized: string; count: number }>();

    for (const p of all) {
        const sub = (p.subcategory || "").trim();
        const category = (p.category || "").trim();
        const brand = (p.brand || "").trim();

        if (brand) {
            const normalized = capitalizeBrand(brand);
            const lowerKey = brand.toLowerCase();
            
            if (brandMap.has(lowerKey)) {
                brandMap.get(lowerKey)!.count++;
            } else {
                brandMap.set(lowerKey, { normalized, count: 1 });
            }
        }

        if (category === 'Опрема') {
            if (DODATOCI.includes(sub)) push(equipment.dodatoci, sub);
            if (OPREMA.includes(sub)) push(equipment.sports, sub);
        }
    }

    for (const [lowerKey, { normalized }] of brandMap) {
        const letter = normalized[0].toUpperCase();
        if (!allBrands[letter]) allBrands[letter] = [];
        if (!allBrands[letter].includes(normalized)) {
            allBrands[letter].push(normalized);
        }
    }

    for (const key of Object.keys(allBrands)) {
        allBrands[key].sort((a, b) => a.localeCompare(b));
    }

    const topBrands = Array.from(brandMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ normalized, count }) => ({ name: normalized, count }));

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
            },
        },

        equipment,

        brands: {
            top: topBrands,
            all: allBrands,
        },

        filters: filterOptions,
    };
}

    @Get('stores')
    async getStores() {
        return this.postgresService.getAllStores();
    }

    @Get(':id')
    async getProductById(@Param('id') id: string) {
        const p = await this.productsService.getProductById(id);
        if (!p) throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
        return p;
    }
}
