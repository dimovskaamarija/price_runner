import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { SportVisionScraper } from './sportvision.scraper';
import { SportRealityScraper } from './sportreality.scraper';
import { FirestoreService } from '../firestore/firestore.service';
import { ScraperController } from './scraper.controller';
import { BuzzScraper } from './buzz.scraper';
import { DsportScraper } from './dsport.scraper';

@Module({
    providers: [ScraperService, SportVisionScraper, SportRealityScraper, FirestoreService, BuzzScraper, DsportScraper],
    controllers: [ScraperController],
})
export class ScraperModule { }
