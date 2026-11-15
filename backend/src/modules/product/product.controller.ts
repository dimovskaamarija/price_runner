import { Controller, Get, Header, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { CatalogReadService } from '../catalog/catalog-read.service';
import { ProductFilters } from '../catalog/product.dto';

const PAGE_SIZE = 24;
const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

@Controller('products')
export class ProductController {
    constructor(private readonly catalog: CatalogReadService) {}

    @Get('filter-options')
    @Header('Cache-Control', 'public, max-age=300')
    getFilterOptions() {
        return this.catalog.getFilterOptions();
    }

    @Get('nav-data')
    @Header('Cache-Control', 'public, max-age=300')
    getNavData() {
        return this.catalog.getNavData();
    }

    @Get('stores')
    @Header('Cache-Control', 'public, max-age=3600')
    getStores() {
        return this.catalog.getStores();
    }

    @Get()
    @Header('Cache-Control', 'public, max-age=60')
    async getProducts(
        @Query('page') page = '1',
        @Query('sort') sort = 'available-desc',
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
        const filters: ProductFilters = {
            search: (search || '').trim(),
            category: list(category),
            subcategory: list(subcategory),
            brand: list(brand),
            age: list(age),
            gender: list(gender),
            color: list(color),
            minPrice: parseInt(minPrice, 10) || 0,
            maxPrice: parseInt(maxPrice, 10) || 20000,
        };
        const p = Math.min(Math.max(parseInt(page, 10) || 1, 1), 1000);
        try {
            return await this.catalog.listProducts(p, PAGE_SIZE, sort, filters);
        } catch {
            throw new HttpException('Failed to fetch products', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /** `?range=1m` (default) | `3m` | `all` */
    @Get(':id/history')
    @Header('Cache-Control', 'public, max-age=600')
    getHistory(@Param('id') id: string, @Query('range') range = '1m') {
        const days = range === 'all' ? null : range === '3m' ? 90 : 30;
        return this.catalog.getPriceHistory(id, days);
    }

    @Get(':id')
    async getProductById(@Param('id') id: string) {
        const p = await this.catalog.getProduct(id);
        if (!p) throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
        return p;
    }
}
