import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreLocation } from '../../database/entities/store-location.entity';
import { StoreLocationsService } from './store-locations.service';
import { StoresController } from './stores.controller';

@Module({
    imports: [TypeOrmModule.forFeature([StoreLocation])],
    providers: [StoreLocationsService],
    controllers: [StoresController],
    exports: [StoreLocationsService],
})
export class StoresModule {}
