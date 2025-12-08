import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../database/entities/product.entity';
import { ProductsService } from './product.service';
import { ProductController } from './product.controller';
import { PostgresModule } from '../../database/postgres.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Product]),PostgresModule,
    ],
    controllers: [ProductController],
    providers: [ProductsService],
    exports: [ProductsService],
})
export class ProductModule {}
