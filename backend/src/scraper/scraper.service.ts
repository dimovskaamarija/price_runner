import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SportVisionScraper } from './sportvision.scraper';
import { SportRealityScraper } from './sportreality.scraper';
import { BuzzScraper } from './buzz.scraper';
import { DSportScraper } from './dsport.scraper';
import { SizeerScraper } from './sizeer.scraper';
import { SportMScraper } from './sportm.scraper';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class ScraperService {
    private readonly log = new Logger(ScraperService.name);
    private sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    private isRunning = false;

    constructor(
        private readonly sportvision: SportVisionScraper,
        private readonly sportreality: SportRealityScraper,
        private readonly buzz: BuzzScraper,
        private readonly dsport: DSportScraper,
        private readonly sizeer: SizeerScraper,
        private readonly sportm: SportMScraper,
        private readonly db: PostgresService,
    ) {}

    @Cron('0 5 * * *')
    async runAll() {
        this.log.log('Starting SportVision scrape…');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/obuvki', 'Обувки');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/tekstil', 'Текстил');
        await this.sportvision.scrapeCategory('https://www.sportvision.mk/mk/oprema', 'Опрема');
        await this.sleep(2000);

        this.log.log('Starting SportReality scrape…');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/obuvki', 'Обувки');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/tekstil', 'Текстил');
        await this.sportreality.scrapeCategory('https://www.sportreality.mk/mk/oprema', 'Опрема');
        await this.sleep(2000);

        this.log.log('Starting Buzz Sneakers scrape…');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/obuvki', 'Обувки');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/tekstil', 'Текстил');
        await this.buzz.scrapeCategory('https://www.buzzsneakers.mk/mk/oprema', 'Опрема');
        await this.sleep(2000);

        this.log.log('Starting Sizeer scrape…');
        const sizeerSegments = ['51', '52', '53'];
        const sizeerGroups = [
            { grupa: '01', category: 'Обувки' },
            { grupa: '02', category: 'Текстил' },
            { grupa: '03', category: 'Опрема' },
        ];
        this.log.log(`Sizeer: ${sizeerGroups.length} groups × ${sizeerSegments.length} segments = ${sizeerGroups.length * sizeerSegments.length} total scrapes`);
        await this.sleep(2000);
        for (const { grupa, category } of sizeerGroups) {
            for (const segment of sizeerSegments) {
                const url = `https://www.sizeer.com.mk/ProductCatalog?Segment=${segment}&Grupa=${grupa}`;
                this.log.log(`Sizeer: ${category} / Segment ${segment}`);
                try {
                    await this.sizeer.scrapeCategory(url, category);
                    await this.sleep(2000);
                } catch (error) {
                    this.log.error(`Error scraping Sizeer ${category}/${segment}:`, error.message);
                    await this.sleep(2000);
                }
            }
        }
        this.log.log('Sizeer scrape completed');

        this.log.log('Starting Sport-M scrape…');
        try {
            await this.sportm.scrapeAll();
        } catch (error) {
            this.log.error(`Error in Sport-M scrape:`, error.message);
            this.log.error(`Stack trace:`, error.stack);
        }
        await this.sleep(2000);

        this.log.log('Starting D Sport scrape…');
        await this.dsport.scrapeCategory('https://www.dsport.mk/muskarci/obuca', 'Обувки', 'Машки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/zene/obuca', 'Обувки', 'Женски');
        await this.dsport.scrapeCategory('https://www.dsport.mk/deca/obuca', 'Обувки', 'Унисекс');
        await this.sleep(2000);
        await this.dsport.scrapeCategory('https://www.dsport.mk/muskarci/odeca', 'Текстил', 'Машки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/zene/odeca', 'Текстил', 'Женски');
        await this.dsport.scrapeCategory('https://www.dsport.mk/deca/odeca', 'Текстил', 'Унисекс');
        await this.sleep(2000);
        await this.dsport.scrapeCategory('https://www.dsport.mk/oprema', 'Опрема', 'Унисекс');
        await this.dsport.scrapeCategory('https://www.dsport.mk/muskarci/oprema', 'Опрема', 'Машки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/zene/oprema', 'Опрема', 'Женски');
        await this.dsport.scrapeCategory('https://www.dsport.mk/deca/oprema', 'Опрема', 'Унисекс');

    }
}
