import { Controller, Get, Logger } from '@nestjs/common';
import { ScraperService } from './services/scraper.service';

@Controller('scraper')
export class ScraperController {
    private readonly log = new Logger(ScraperController.name);

    constructor(private readonly scraperService: ScraperService) {}

    @Get('run-now')
    async runNow() {
        const startTime = new Date();
        this.log.log('=== MANUAL SCRAPER TRIGGER ===');
        this.log.log(`Triggered at: ${startTime.toISOString()}`);
        
        try {
            await this.scraperService.executeScraping();
            
            const endTime = new Date();
            const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
            
            this.log.log(`=== SCRAPING COMPLETED ===`);
            this.log.log(`Duration: ${duration} seconds`);
            
            return { 
                status: 'success',
                message: 'Scraping completed successfully',
                duration: `${duration} seconds`,
                timestamp: endTime.toISOString()
            };
        } catch (error) {
            this.log.error('=== SCRAPING FAILED ===');
            this.log.error(error);
            
            return {
                status: 'error',
                message: 'Scraping failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}
