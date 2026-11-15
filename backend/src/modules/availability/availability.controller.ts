import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

@Controller('products')
export class AvailabilityController {
    constructor(private readonly availability: AvailabilityService) {}

    /**
     * In-store availability. Without `size`: the sizes each chain has. With `size`: also the
     * shops (with location, hours, phone) that have that size right now.
     */
    @Get(':id/availability')
    @Header('Cache-Control', 'public, max-age=300')
    get(@Param('id') id: string, @Query('size') size?: string) {
        return this.availability.forProduct(id, size?.slice(0, 20));
    }
}
