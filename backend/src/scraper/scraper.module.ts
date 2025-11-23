import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { SportVisionScraper } from './sportvision.scraper';
import { SportRealityScraper } from './sportreality.scraper';
import { PostgresModule } from '../postgres/postgres.module';
import { ScraperController } from './scraper.controller';
import { BuzzScraper } from './buzz.scraper';
import { DSportScraper } from './dsport.scraper';
import { SizeerScraper } from './sizeer.scraper';
import { SportMScraper } from './sportm.scraper';

@Module({
    imports: [PostgresModule],
    providers: [ScraperService, SportVisionScraper, SportRealityScraper, BuzzScraper, DSportScraper, SizeerScraper, SportMScraper],
    controllers: [ScraperController],
})
export class ScraperModule {}
