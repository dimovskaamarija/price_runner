import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Product } from '../postgres/entities/product.entity';
import { ProductsService } from '../services/product.service.ts';
import { ProductController } from '../controllers/product.controller';

import { PostgresModule } from '../postgres/postgres.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Product]),
        PostgresModule,  
    ],
    controllers: [ProductController],
    providers: [ProductsService],
    exports: [ProductsService],
})
export class ProductModule { }
