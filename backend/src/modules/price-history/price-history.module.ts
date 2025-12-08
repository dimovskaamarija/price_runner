import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { PriceHistoryService } from './price-history.service';
import { PriceHistoryController } from './price-history.controller';

@Module({
    imports: [TypeOrmModule.forFeature([PriceHistory])],
    providers: [PriceHistoryService],
    controllers: [PriceHistoryController],
    exports: [PriceHistoryService],
})
export class PriceHistoryModule {}
