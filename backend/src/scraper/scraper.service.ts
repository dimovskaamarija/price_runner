import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SportVisionScraper } from './sportvision.scraper';
import { SportRealityScraper } from './sportreality.scraper';
import { BuzzScraper } from './buzz.scraper';
import { DsportScraper } from './dsport.scraper';

@Injectable()
export class ScraperService {
    private readonly log = new Logger(ScraperService.name);

    constructor(
        private readonly sportvision: SportVisionScraper,
        private readonly sportreality: SportRealityScraper,
        private readonly buzz: BuzzScraper,
        private readonly dsport: DsportScraper,
    ) { }

    @Cron('0 5 * * *') // run every day at 5am
    async runAll() {
        this.log.log('Starting SportVision scrape…');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/obuvki', 'Обувки');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/tekstil', 'Текстил');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/oprema', 'Опрема');

        this.log.log('Starting SportReality scrape…');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/obuvki', 'Обувки');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/tekstil', 'Текстил');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/oprema', 'Опрема');

        this.log.log('Starting Buzz Sneakers scrape…');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/obuvki', 'Обувки');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/tekstil', 'Текстил');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/oprema', 'Опрема');

        this.log.log('Starting D Sport scrape…');
        await this.dsport.scrapeCategory('https://www.dsport.mk/obuca', 'Обувки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/odeca', 'Текстил');
        await this.dsport.scrapeCategory('https://www.dsport.mk/oprema', 'Опрема');

        this.log.log('All scrapers finished ✅');
    }
}
