import { Controller, Get, Post, Delete, Param, Body, HttpException, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';
import { FavoritesService } from './favorites.service';
import { AuthService } from '../auth/auth.service';

@Controller('favorites')
export class FavoritesController {
    constructor(
        private readonly favoritesService: FavoritesService,
        private readonly authService: AuthService,
    ) {}

    private extractAuthFromRequest(req: Request): { token?: string; cookies?: string } {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
        
        // Fallback: try to get cookies for backward compatibility
        const cookieHeader = req.headers.cookie || '';
        const parsedCookies = (req as any).cookies || {};
        const cookies = parsedCookies['wos-session'] 
            ? `wos-session=${parsedCookies['wos-session']}` 
            : cookieHeader;
        
        return { token, cookies };
    }

    @Post()
    async addFavorite(@Req() req: Request, @Body() body: { productId: string }) {
        if (!body.productId) {
            throw new HttpException('productId is required', HttpStatus.BAD_REQUEST);
        }

        const { token, cookies } = this.extractAuthFromRequest(req);
        console.log(`[Favorites] POST - Token present: ${!!token}`);
            
        const user = await this.authService.getCurrentUser(token, cookies);

        if (!user) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
        }

        // Log the request URL for production debugging
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        console.log(`[Favorites] POST request received at: ${fullUrl} (user: ${user.id}, productId: ${body.productId})`);

        try {
            return await this.favoritesService.addFavorite(user.id, body.productId);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to add favorite',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get()
    async getUserFavorites(@Req() req: Request) {
        const { token, cookies } = this.extractAuthFromRequest(req);
        const user = await this.authService.getCurrentUser(token, cookies);

        if (!user) {
            return [];
        }

        try {
            const products = await this.favoritesService.getUserFavorites(user.id);
            return products.map((p) => ({
                id: p.id,
                name: p.name,
                brand: p.brand,
                category: p.category,
                subcategory: p.subcategory,
                gender: p.gender,
                age: p.age,
                color: p.color,
                image: p.image,
                priceMap: p.priceMap || {},
                storeLinks: p.storeLinks || {},
                productUrl: p.productUrl,
                currency: p.currency,
                createdAt: p.createdAt,
                updatedAt: p.updatedAt,
            }));
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to get favorites',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get(':productId')
    async isFavorite(@Req() req: Request, @Param('productId') productId: string) {
        const { token, cookies } = this.extractAuthFromRequest(req);
        const user = await this.authService.getCurrentUser(token, cookies);

        if (!user) {
            return { isFavorite: false };
        }

        try {
            const isFav = await this.favoritesService.isFavorite(user.id, productId);
            return { isFavorite: isFav };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to check favorite',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete(':productId')
    async removeFavorite(@Req() req: Request, @Param('productId') productId: string) {
        const { token, cookies } = this.extractAuthFromRequest(req);
        console.log(`[Favorites] DELETE - Token present: ${!!token}`);
        const user = await this.authService.getCurrentUser(token, cookies);

        if (!user) {
            throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
        }

        // Log the request URL for production debugging
        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        console.log(`[Favorites] DELETE request received at: ${fullUrl} (user: ${user.id}, productId: ${productId})`);

        try {
            const success = await this.favoritesService.removeFavorite(user.id, productId);
            return { success };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to remove favorite',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}