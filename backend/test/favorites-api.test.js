require("reflect-metadata");
require("ts-node/register/transpile-only");

const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, test } = require("node:test");
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { AuthService } = require("../src/modules/auth/auth.service");

// The controller only needs the service token; keep database modules out of this
// HTTP integration test so it can run without a PostgreSQL connection.
class FavoritesService {}
const favoritesServicePath = require.resolve(
  "../src/modules/favorites/favorites.service",
);
require.cache[favoritesServicePath] = {
  id: favoritesServicePath,
  filename: favoritesServicePath,
  loaded: true,
  exports: { FavoritesService },
};

const {
  FavoritesController,
} = require("../src/modules/favorites/favorites.controller");

const authenticatedUser = { id: 42, authkit_id: "user_42" };
const product = {
  id: "product-1",
  name: "Test product",
  brand: "Test brand",
  category: "Test category",
  priceMap: { store: 100 },
  storeLinks: { store: "https://example.com/product-1" },
};

let favorites;
let favoriteCalls;
let receivedTokens;

const authService = {
  async getCurrentUser(token) {
    receivedTokens.push(token);
    return token === "valid-token" ? authenticatedUser : null;
  },
};

const favoritesService = {
  async addFavorite(userId, productId) {
    favoriteCalls.push(["add", userId, productId]);
    favorites.add(productId);
    return { id: 1, userId, productId };
  },
  async getUserFavorites(userId) {
    favoriteCalls.push(["list", userId]);
    return favorites.has(product.id) ? [product] : [];
  },
  async isFavorite(userId, productId) {
    favoriteCalls.push(["status", userId, productId]);
    return favorites.has(productId);
  },
  async removeFavorite(userId, productId) {
    favoriteCalls.push(["remove", userId, productId]);
    return favorites.delete(productId);
  },
};

class TestModule {}
Module({
  controllers: [FavoritesController],
  providers: [
    { provide: AuthService, useValue: authService },
    { provide: FavoritesService, useValue: favoritesService },
  ],
})(TestModule);

describe("Favorites API", () => {
  let app;
  let baseUrl;

  before(async () => {
    app = await NestFactory.create(TestModule, { logger: false });
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => {
    favorites = new Set();
    favoriteCalls = [];
    receivedTokens = [];
  });

  test("adds a favorite for an authenticated user", async () => {
    const response = await request("/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: product.id }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: 1,
      userId: authenticatedUser.id,
      productId: product.id,
    });
    assert.deepEqual(receivedTokens, ["valid-token"]);
    assert.deepEqual(favoriteCalls, [
      ["add", authenticatedUser.id, product.id],
    ]);
    assert.equal(favorites.has(product.id), true);
  });

  test("lists favorites for an authenticated user", async () => {
    favorites.add(product.id);

    const response = await request("/favorites");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      {
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        priceMap: product.priceMap,
        storeLinks: product.storeLinks,
      },
    ]);
    assert.deepEqual(receivedTokens, ["valid-token"]);
    assert.deepEqual(favoriteCalls, [["list", authenticatedUser.id]]);
  });

  test("returns favorite status for an authenticated user", async () => {
    favorites.add(product.id);

    const response = await request(`/favorites/${product.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { isFavorite: true });
    assert.deepEqual(receivedTokens, ["valid-token"]);
    assert.deepEqual(favoriteCalls, [
      ["status", authenticatedUser.id, product.id],
    ]);
  });

  test("removes a favorite for an authenticated user", async () => {
    favorites.add(product.id);

    const response = await request(`/favorites/${product.id}`, {
      method: "DELETE",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.deepEqual(receivedTokens, ["valid-token"]);
    assert.deepEqual(favoriteCalls, [
      ["remove", authenticatedUser.id, product.id],
    ]);
    assert.equal(favorites.has(product.id), false);
  });

  function request(path, options = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  }
});
