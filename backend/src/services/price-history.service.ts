import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PriceHistory } from '../postgres/entities/price-history.entity';

@Injectable()
export class PriceHistoryService {
    constructor(
        @InjectRepository(PriceHistory)
        private readonly repo: Repository<PriceHistory>,
    ) {}

    async getLast30Days(productId: string): Promise<PriceHistory[]> {
        const today = new Date();
        const monthAgo = new Date();
        monthAgo.setDate(today.getDate() - 30);

        return await this.repo.find({
            where: {
                productId,
                date: Between(monthAgo, today),
            },
            order: {
                date: 'ASC',
            },
        });
    }
}
