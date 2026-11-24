import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperModule } from './modules/scraper/scraper.module';
import { PostgresModule } from './database/postgres.module';
import { ProductModule } from './modules/product/product.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { StoresModule } from './modules/stores/stores.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AppController } from './app.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        ScheduleModule.forRoot(),
        PostgresModule,
        ScraperModule,
        ProductModule,
        FavoritesModule,
        StoresModule,
        AvailabilityModule,
        AlertsModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
