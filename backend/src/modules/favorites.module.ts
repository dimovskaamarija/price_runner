import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Favorite } from '../postgres/entities/favorite.entity';
import { Product } from '../postgres/entities/product.entity';
import { FavoritesService } from '../services/favorites.service';
import { AuthService } from '../services/auth.service';
import { FavoritesController } from '../controllers/favorites.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Favorite, Product])],
    providers: [FavoritesService, AuthService],
    controllers: [FavoritesController],
    exports: [FavoritesService],
})
export class FavoritesModule {}

