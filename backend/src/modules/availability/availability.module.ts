import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreLocation } from '../../database/entities/store-location.entity';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
    imports: [TypeOrmModule.forFeature([StoreLocation])],
    providers: [AvailabilityService],
    controllers: [AvailabilityController],
})
export class AvailabilityModule {}
