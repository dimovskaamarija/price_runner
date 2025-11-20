import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperModule } from './scraper/scraper.module';
import { PostgresModule } from './postgres/postgres.module';
import { ProductModule } from './modules/product.module'
import { PriceHistoryModule } from './modules/price-history.module'
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
        PriceHistoryModule
    ],
})
export class AppModule { }
