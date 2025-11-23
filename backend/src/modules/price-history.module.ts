import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceHistory } from '../postgres/entities/price-history.entity';
import { PriceHistoryService } from '../services/price-history.service';
import { PriceHistoryController } from '../controllers/price-history.controller';

@Module({
    imports: [TypeOrmModule.forFeature([PriceHistory])],
    providers: [PriceHistoryService],
    controllers: [PriceHistoryController],
    exports: [PriceHistoryService],
})
export class PriceHistoryModule {}
