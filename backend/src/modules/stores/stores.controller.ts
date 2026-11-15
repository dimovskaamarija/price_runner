import { Controller, Get, Header, Headers, HttpException, HttpStatus, Post, Query } from '@nestjs/common';
import { StoreLocationsService } from './store-locations.service';

@Controller('stores')
export class StoresController {
    constructor(private readonly locations: StoreLocationsService) {}

    /**
     * All physical shops. Distances are computed in the browser, so the user's location
     * never has to be sent to the server.
     */
    @Get('locations')
    @Header('Cache-Control', 'public, max-age=3600')
    list() {
        return this.locations.list();
    }

    /** Admin: refresh shop locations now (same SCRAPER_TOKEN as the scraper endpoints). */
    @Post('locations/sync')
    async sync(@Headers('authorization') auth?: string, @Query('token') token?: string) {
        const expected = process.env.SCRAPER_TOKEN;
        if (expected && (auth?.replace(/^Bearer\s+/i, '') || token) !== expected) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        return this.locations.sync();
    }
}
