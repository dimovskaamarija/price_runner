import { Controller, Get, Param } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';
import { PriceHistory } from '../../database/entities/price-history.entity';

@Controller('products')
export class PriceHistoryController {
    constructor(private readonly priceHistoryService: PriceHistoryService) {}

    @Get(':id/history')
    async getHistory(@Param('id') id: string): Promise<PriceHistory[]> {
        return this.priceHistoryService.getLast30Days(id);
    }
}
