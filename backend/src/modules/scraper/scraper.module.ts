import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { IngestService } from './ingest.service';

@Module({
    imports: [CatalogModule],
    providers: [ScraperService, IngestService],
    controllers: [ScraperController],
})
export class ScraperModule {}
