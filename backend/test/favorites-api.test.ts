import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { AddressInfo } from 'node:net';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AuthService } from '../src/modules/auth/auth.service';
import { FavoritesController } from '../src/modules/favorites/favorites.controller';
import { FavoritesService } from '../src/modules/favorites/favorites.service';

const user = { id: 42, authkit_id: 'authkit-user' };
const calls = {
    tokens: [] as string[],
    add: [] as Array<[number, string]>,
    list: [] as number[],
    check: [] as Array<[number, string]>,
    remove: [] as Array<[number, string]>,
};

const authService = {
    async getCurrentUser(token: string) {
        calls.tokens.push(token);
        return token === 'valid-token' ? user : null;
    },
};

const favorite = { id: 7, userId: user.id, productId: 'product-1' };
const product = {
    id: 'product-1',
    name: 'Running shoe',
    brand: 'Example',
    category: 'Shoes',
    priceMap: { shop: 120 },
    storeLinks: { shop: 'https://example.test/product-1' },
};
const favoritesService = {
    async addFavorite(userId: number, productId: string) {
        calls.add.push([userId, productId]);
        return favorite;
    },
    async getUserFavorites(userId: number) {
        calls.list.push(userId);
        return [product];
    },
    async isFavorite(userId: number, productId: string) {
        calls.check.push([userId, productId]);
        return true;
    },
    async removeFavorite(userId: number, productId: string) {
        calls.remove.push([userId, productId]);
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
class FavoritesApiTestModule {}

describe('authenticated favorites API', () => {
    let app: INestApplication;
    let baseUrl: string;

    before(async () => {
        app = await NestFactory.create(FavoritesApiTestModule, { logger: false });
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
        const response = await request('/favorites', {
            method: 'POST',
            body: JSON.stringify({ productId: 'product-1' }),
        });

        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), favorite);
        assert.deepEqual(calls.tokens, ['valid-token']);
        assert.deepEqual(calls.add, [[user.id, 'product-1']]);
    });

    it('lists the authenticated user favorites', async () => {
        const response = await request('/favorites');

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), [product]);
        assert.deepEqual(calls.list, [user.id]);
    });

    it('checks whether a product is an authenticated user favorite', async () => {
        const response = await request('/favorites/product-1');

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { isFavorite: true });
        assert.deepEqual(calls.check, [[user.id, 'product-1']]);
    });

    it('removes a favorite for the authenticated user', async () => {
        const response = await request('/favorites/product-1', { method: 'DELETE' });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true });
        assert.deepEqual(calls.remove, [[user.id, 'product-1']]);
    });

    function request(path: string, init: RequestInit = {}) {
        return fetch(`${baseUrl}${path}`, {
            ...init,
            headers: {
                Authorization: 'Bearer valid-token',
                'Content-Type': 'application/json',
                ...init.headers,
            },
        });
    }
});
