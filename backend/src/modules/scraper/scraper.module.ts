import { Module } from '@nestjs/common';
import { ScraperService } from './services/scraper.service';
import { SportVisionScraper } from './services/sportvision.scraper';
import { SportRealityScraper } from './services/sportreality.scraper';
import { PostgresModule } from '../../database/postgres.module';
import { ScraperController } from './scraper.controller';
import { BuzzScraper } from './services/buzz.scraper';
import { DSportScraper } from './services/dsport.scraper';
import { SizeerScraper } from './services/sizeer.scraper';
import { SportMScraper } from './services/sportm.scraper';

@Module({
    imports: [PostgresModule],
    providers: [ScraperService, SportVisionScraper, SportRealityScraper, BuzzScraper, DSportScraper, SizeerScraper, SportMScraper],
    controllers: [ScraperController],
})
export class ScraperModule {}
