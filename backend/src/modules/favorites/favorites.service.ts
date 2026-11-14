import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from '../../database/entities/favorite.entity';
import { CatalogReadService } from '../catalog/catalog-read.service';
import { ProductDto } from '../catalog/product.dto';

@Injectable()
export class FavoritesService {
    constructor(
        @InjectRepository(Favorite)
        private readonly favoriteRepository: Repository<Favorite>,
        private readonly catalog: CatalogReadService,
    ) {}

    async addFavorite(userId: number, productId: string): Promise<Favorite> {
        await this.favoriteRepository
            .createQueryBuilder()
            .insert()
            .into(Favorite)
            .values({ userId, productId })
            .orIgnore()
            .execute();
        return this.favoriteRepository.findOneOrFail({ where: { userId, productId } });
    }

    async removeFavorite(userId: number, productId: string): Promise<boolean> {
        const result = await this.favoriteRepository.delete({ userId, productId });
        return (result.affected || 0) > 0;
    }

    async isFavorite(userId: number, productId: string): Promise<boolean> {
        return this.favoriteRepository.exists({ where: { userId, productId } });
    }

    async getUserFavorites(userId: number): Promise<ProductDto[]> {
        const favorites = await this.favoriteRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
        return this.catalog.getProductsByIds(favorites.map((f) => f.productId));
    }
}
