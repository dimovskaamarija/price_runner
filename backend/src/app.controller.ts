import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    @Get()
    getRoot() {
        return {
            message: 'Price Runner API is running',
            version: '1.0.0',
            endpoints: {
                products: '/products',
                navData: '/products/nav-data',
                filterOptions: '/products/filter-options',
                stores: '/products/stores',
            },
        };
    }
}
