import { Controller, Get, Query, Param, HttpException, HttpStatus } from "@nestjs/common";
import { ProductsService } from "../services/ProductService";

@Controller("products")
export class ProductController {
    constructor(private readonly productsService: ProductsService) { }

    @Get("filter-options")
    async getFilterOptions() {
        return this.productsService.getFilterOptions();
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

    @Get(":id")
    async getProductById(@Param("id") id: string) {
        const p = await this.productsService.getProductById(id);
        if (!p) throw new HttpException("Product not found", HttpStatus.NOT_FOUND);
        return p;
    }
}
