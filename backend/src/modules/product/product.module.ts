import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ProductController } from './product.controller';

@Module({
    imports: [CatalogModule],
    controllers: [ProductController],
})
export class ProductModule {}
