import { Controller, Get, Headers, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { ScraperService } from './scraper.service';

/**
 * Admin endpoints. If SCRAPER_TOKEN is set, requests must send
 * `Authorization: Bearer <token>` or `?token=<token>`.
 */
@Controller('scraper')
export class ScraperController {
    constructor(private readonly scraper: ScraperService) {}

    private authorize(auth?: string, token?: string) {
        const expected = process.env.SCRAPER_TOKEN;
        if (!expected) return;
        const provided = auth?.replace(/^Bearer\s+/i, '') || token;
        if (provided !== expected) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    /**
     * Starts a full run in the background and returns immediately.
     * `?wait=true` keeps the old behaviour of responding when the run finishes.
     * `?stores=Sport M,Sizeer MK` limits the run to some stores.
     */
    @Get('run-now')
    async runNow(
        @Headers('authorization') auth?: string,
        @Query('token') token?: string,
        @Query('wait') wait?: string,
        @Query('stores') stores?: string,
    ) {
        this.authorize(auth, token);
        const alreadyRunning = this.scraper.isRunning;
        const run = this.scraper.run(stores ? stores.split(',').map((s) => s.trim()) : undefined);
        if (wait === 'true') return { status: 'success', summary: await run };
        run.catch(() => undefined); // errors are logged and recorded in lastRun
        return { status: alreadyRunning ? 'already-running' : 'started', statusUrl: '/scraper/status' };
    }

    @Get('status')
    status(@Headers('authorization') auth?: string, @Query('token') token?: string) {
        this.authorize(auth, token);
        return { running: this.scraper.isRunning, lastRun: this.scraper.lastRun };
    }

    /** Re-run classification/clustering/maintenance without scraping. `?reclassify=true` re-labels everything. */
    @Post('process')
    async process(@Headers('authorization') auth?: string, @Query('token') token?: string, @Query('reclassify') reclassify?: string) {
        this.authorize(auth, token);
        if (this.scraper.isRunning) throw new HttpException('A scrape run is in progress', HttpStatus.CONFLICT);
        return this.scraper.processCatalog({ reclassify: reclassify === 'true' });
    }

    /** ML model quality: holdout + leave-one-store-out metrics per field. */
    @Get('ml/metrics')
    async mlMetrics(@Headers('authorization') auth?: string, @Query('token') token?: string) {
        this.authorize(auth, token);
        const m = await this.scraper.mlMetrics();
        if (!m) throw new HttpException('ML service not configured or no model trained yet', HttpStatus.SERVICE_UNAVAILABLE);
        return m;
    }

    /** Unsupervised clustering report: natural product groups, outliers, suggested new categories. */
    @Get('clusters')
    async clusters(@Headers('authorization') auth?: string, @Query('token') token?: string, @Query('k') k?: string) {
        this.authorize(auth, token);
        const report = await this.scraper.clusterReport(k ? parseInt(k, 10) : undefined);
        if (!report) throw new HttpException('ML service not configured or unavailable', HttpStatus.SERVICE_UNAVAILABLE);
        return report;
    }

    /** Dry-run a site config: scrapes a few products, saves nothing, shows extracted fields + rule classification. */
    @Get('preview')
    async preview(
        @Headers('authorization') auth?: string,
        @Query('token') token?: string,
        @Query('store') store?: string,
        @Query('limit') limit = '5',
    ) {
        this.authorize(auth, token);
        try {
            return await this.scraper.preview(store || '', Math.min(parseInt(limit, 10) || 5, 50));
        } catch (e) {
            throw new HttpException((e as Error).message, HttpStatus.BAD_REQUEST);
        }
    }
}
