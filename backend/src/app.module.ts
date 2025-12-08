import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperModule } from './modules/scraper/scraper.module';
import { PostgresModule } from './database/postgres.module';
import { ProductModule } from './modules/product/product.module';
import { PriceHistoryModule } from './modules/price-history/price-history.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
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
        PriceHistoryModule,
        FavoritesModule,
    ],
    controllers: [AppController],
})
export class AppModule {}
