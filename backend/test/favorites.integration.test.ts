import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';
import { FavoritesController } from '../src/modules/favorites/favorites.controller';
import { FavoritesService } from '../src/modules/favorites/favorites.service';

const calls = {
    tokens: [] as string[],
    added: [] as Array<[number, string]>,
    listed: [] as number[],
    checked: [] as Array<[number, string]>,
    removed: [] as Array<[number, string]>,
};

const authService = {
    async getCurrentUser(token: string) {
        calls.tokens.push(token);
        return token === 'valid-token' ? { id: 42, authkit_id: 'authkit-user' } : null;
    },
};

const favoriteProduct = {
    id: 'product-1',
    name: 'Running shoe',
    brand: 'Runner',
    priceMap: { store: 2999 },
    storeLinks: { store: 'https://example.com/product-1' },
    currency: 'MKD',
};

const favoritesService = {
    async addFavorite(userId: number, productId: string) {
        calls.added.push([userId, productId]);
        return { id: 7, userId, productId };
    },
    async getUserFavorites(userId: number) {
        calls.listed.push(userId);
        return [favoriteProduct];
    },
    async isFavorite(userId: number, productId: string) {
        calls.checked.push([userId, productId]);
        return true;
    },
    async removeFavorite(userId: number, productId: string) {
        calls.removed.push([userId, productId]);
        return true;
    },
};

@Module({
    controllers: [FavoritesController],
    providers: [
        { provide: AuthService, useValue: authService },
        { provide: FavoritesService, useValue: favoritesService },
    ],
})
class FavoritesTestModule {}

describe('authenticated favorites API', () => {
    let app: INestApplication;
    let baseUrl: string;

    before(async () => {
        app = await NestFactory.create(FavoritesTestModule, { logger: false });
        await app.listen(0, '127.0.0.1');
        const address = app.getHttpServer().address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    beforeEach(() => {
        Object.values(calls).forEach((entries) => entries.splice(0));
    });

    after(async () => {
        await app.close();
    });

    it('adds a favorite for the bearer-token user', async () => {
        const response = await fetch(`${baseUrl}/favorites`, {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid-token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: 'product-1' }),
        });

        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), {
            id: 7,
            userId: 42,
            productId: 'product-1',
        });
        assert.deepEqual(calls.tokens, ['valid-token']);
        assert.deepEqual(calls.added, [[42, 'product-1']]);
    });

    it('lists and checks favorites for the authenticated user', async () => {
        const headers = { Authorization: 'Bearer valid-token' };
        const listResponse = await fetch(`${baseUrl}/favorites`, { headers });
        const checkResponse = await fetch(`${baseUrl}/favorites/product-1`, { headers });

        assert.equal(listResponse.status, 200);
        assert.deepEqual(await listResponse.json(), [favoriteProduct]);
        assert.equal(checkResponse.status, 200);
        assert.deepEqual(await checkResponse.json(), { isFavorite: true });
        assert.deepEqual(calls.tokens, ['valid-token', 'valid-token']);
        assert.deepEqual(calls.listed, [42]);
        assert.deepEqual(calls.checked, [[42, 'product-1']]);
    });

    it('removes a favorite for the bearer-token user', async () => {
        const response = await fetch(`${baseUrl}/favorites/product-1`, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer valid-token' },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true });
        assert.deepEqual(calls.tokens, ['valid-token']);
        assert.deepEqual(calls.removed, [[42, 'product-1']]);
    });
});
