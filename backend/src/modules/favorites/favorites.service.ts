import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Favorite } from '../../database/entities/favorite.entity';
import { Product } from '../../database/entities/product.entity';

@Injectable()
export class FavoritesService {
    private readonly log = new Logger(FavoritesService.name);

    constructor(
        @InjectRepository(Favorite)
        private favoriteRepository: Repository<Favorite>,
        @InjectRepository(Product)
        private productRepository: Repository<Product>,
    ) {}

    async addFavorite(userId: number, productId: string): Promise<Favorite> {
        const existing = await this.favoriteRepository.findOne({
            where: { userId, productId },
        });

        if (existing) {
            return existing;
        }

        const favorite = this.favoriteRepository.create({
            userId,
            productId,
        });

        return await this.favoriteRepository.save(favorite);
    }

    async removeFavorite(userId: number, productId: string): Promise<boolean> {
        const result = await this.favoriteRepository.delete({
            userId,
            productId,
        });

        return (result.affected || 0) > 0;
    }

    async isFavorite(userId: number, productId: string): Promise<boolean> {
        const favorite = await this.favoriteRepository.findOne({
            where: { userId, productId },
        });

        return !!favorite;
    }

    async getUserFavorites(userId: number): Promise<Product[]> {
        const favorites = await this.favoriteRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        const productIds = favorites.map((f) => f.productId);

        if (productIds.length === 0) {
            return [];
        }

        const products = await this.productRepository.find({
            where: { id: In(productIds) },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        return favorites
            .map((f) => productMap.get(f.productId))
            .filter((p): p is Product => p !== undefined);
    }
}