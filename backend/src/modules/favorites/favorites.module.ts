import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from '../../database/entities/favorite.entity';
import { Product } from '../../database/entities/product.entity';
import { FavoritesService } from './favorites.service';
import { AuthService } from '../auth/auth.service';
import { FavoritesController } from './favorites.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Favorite, Product])],
    providers: [FavoritesService, AuthService],
    controllers: [FavoritesController],
    exports: [FavoritesService],
})
export class FavoritesModule {}

