import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SportVisionScraper } from './sportvision.scraper';
import { SportRealityScraper } from './sportreality.scraper';
import { BuzzScraper } from './buzz.scraper';
import { DSportScraper } from './dsport.scraper';
import { SizeerScraper } from './sizeer.scraper';
import { SportMScraper } from './sportm.scraper';
import { PostgresService } from '../../../database/postgres.service';

@Injectable()
export class ScraperService {
    private readonly log = new Logger(ScraperService.name);

    constructor(
        private readonly sportvision: SportVisionScraper,
        private readonly sportreality: SportRealityScraper,
        private readonly buzz: BuzzScraper,
        private readonly dsport: DSportScraper,
        private readonly sizeer: SizeerScraper,
        private readonly sportm: SportMScraper,
        private readonly db: PostgresService,
    ) {}

    @Cron('0 3 * * *') 
    async runAll() {
        const startTime = new Date();
        this.log.log('=== SCRAPER CRON JOB STARTED ===');
        this.log.log(`Start Time: ${startTime.toISOString()}`);
        this.log.log(`Server Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        this.log.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        
        try {
            if (process.env.ENABLE_SCRAPER_CRON === 'false') {
                this.log.log('Cron disabled via ENABLE_SCRAPER_CRON=false');
                return;
            }

            await this.executeScraping();

            const endTime = new Date();
            const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
            this.log.log(`=== SCRAPER CRON JOB COMPLETED SUCCESSFULLY ===`);
            this.log.log(`Duration: ${duration} seconds`);
        } catch (error) {
            this.log.error('=== SCRAPER CRON JOB FAILED ===');
            this.log.error(`Error: ${error.message}`);
            this.log.error(error.stack);
            throw error; // Re-throw so caller knows it failed
        }
    }

    async executeScraping() {
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

        this.log.log('Starting Sizeer scrape…');
        const sizeerSegments = ['51', '52', '53'];
        const sizeerGroups = [
            { grupa: '01', category: 'Обувки' },
            { grupa: '02', category: 'Текстил' },
            { grupa: '03', category: 'Опрема' },
        ];
        for (const { grupa, category } of sizeerGroups) {
            for (const segment of sizeerSegments) {
                const url = `https://www.sizeer.com.mk/ProductCatalog?Segment=${segment}&Grupa=${grupa}`;
                await this.sizeer.scrapeCategory(url, category);
            }
        }

        this.log.log('Starting Sport-M scrape…');
        await this.sportm.scrapeAll();
       
        this.log.log('Starting D Sport scrape…');
        await this.dsport.scrapeCategory('https://www.dsport.mk/muskarci/obuca', 'Обувки', 'Машки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/zene/obuca', 'Обувки', 'Женски');
        await this.dsport.scrapeCategory('https://www.dsport.mk/deca/obuca', 'Обувки', 'Унисекс');
        await this.dsport.scrapeCategory('https://www.dsport.mk/muskarci/odeca', 'Текстил', 'Машки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/zene/odeca', 'Текстил', 'Женски');
        await this.dsport.scrapeCategory('https://www.dsport.mk/deca/odeca', 'Текстил', 'Унисекс');
        await this.dsport.scrapeCategory('https://www.dsport.mk/oprema', 'Опрема', 'Унисекс');
        await this.dsport.scrapeCategory('https://www.dsport.mk/muskarci/oprema', 'Опрема', 'Машки');
        await this.dsport.scrapeCategory('https://www.dsport.mk/zene/oprema', 'Опрема', 'Женски');
        await this.dsport.scrapeCategory('https://www.dsport.mk/deca/oprema', 'Опрема', 'Унисекс');
    }
}
