import { Controller, Get } from '@nestjs/common';
import { ScraperService } from './services/scraper.service';
//scrape
@Controller('scraper')
export class ScraperController {
    constructor(private readonly scraperService: ScraperService) {}

    @Get('run-now')
    async runNow() {
        await this.scraperService.runAll();
        return { status: 'Scraping started' };
    }
}
