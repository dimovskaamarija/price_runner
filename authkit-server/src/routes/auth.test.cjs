const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");

process.env.FRONTEND_URL = "https://frontend.example/";
process.env.JWT_SECRET = "test-secret";

let query;
let authenticateWithCode;
let signedPayload;
let verifyToken;

const dbPath = require.resolve("../services/db");
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
        pool: {
            query: (...args) => query(...args),
        },
    },
};

const workosPath = require.resolve("../workos");
require.cache[workosPath] = {
    id: workosPath,
    filename: workosPath,
    loaded: true,
    exports: {
        workos: {
            userManagement: {
                authenticateWithCode: (...args) => authenticateWithCode(...args),
            },
        },
    },
};

const jwtPath = path.join(__dirname, "jsonwebtoken.mock.cjs");
require.cache[jwtPath] = {
    id: jwtPath,
    filename: jwtPath,
    loaded: true,
    exports: {
        sign: (payload) => {
            signedPayload = payload;
            return "signed-test-token";
        },
        verify: (...args) => verifyToken(...args),
    },
};

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
    return request === "jsonwebtoken"
        ? jwtPath
        : resolveFilename.call(this, request, ...args);
};
const authRouter = require("./auth").default;
Module._resolveFilename = resolveFilename;
const app = express();
app.use("/auth", authRouter);

let server;
let baseUrl;
const originalLog = console.log;
const originalError = console.error;

before(async () => {
    console.log = () => {};
    console.error = () => {};
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    console.log = originalLog;
    console.error = originalError;
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

beforeEach(() => {
    query = async () => ({ rows: [] });
    authenticateWithCode = async () => {
        throw new Error("Unexpected WorkOS call");
    };
    signedPayload = undefined;
    verifyToken = () => {
        throw new Error("Unexpected token verification");
    };
});

test("callback rejects a request without an authorization code", async () => {
    const response = await fetch(`${baseUrl}/auth/callback`, { redirect: "manual" });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Missing code" });
});

test("callback authenticates the user and redirects with a signed token", async () => {
    authenticateWithCode = async ({ clientId, code }) => {
        assert.equal(clientId, undefined);
        assert.equal(code, "authorization-code");
        return {
            user: {
                id: "authkit-user",
                email: "user@example.com",
                firstName: "Test",
            },
            sealedSession: "unused-session",
        };
    };
    query = async (sql, values) => {
        assert.match(sql, /SELECT \* FROM users WHERE authkit_id/);
        assert.deepEqual(values, ["authkit-user"]);
        return { rows: [{ id: 42, email: "user@example.com" }] };
    };

    const response = await fetch(
        `${baseUrl}/auth/callback?code=authorization-code`,
        { redirect: "manual" }
    );

    assert.equal(response.status, 302);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.origin, "https://frontend.example");
    assert.equal(location.pathname, "/callback");
    assert.equal(location.searchParams.get("auth"), "success");
    assert.equal(location.searchParams.get("token"), "signed-test-token");
    assert.deepEqual(signedPayload, {
        userId: 42,
        authkitId: "authkit-user",
        email: "user@example.com",
    });
});

test("session returns null without a bearer token", async () => {
    const response = await fetch(`${baseUrl}/auth/me`);

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
});

test("session returns the database user for a valid bearer token", async () => {
    const user = { id: 42, email: "user@example.com", name: "Test" };
    query = async (sql, values) => {
        assert.match(sql, /SELECT \* FROM users WHERE id/);
        assert.deepEqual(values, [42]);
        return { rows: [user] };
    };
    verifyToken = (token, secret) => {
        assert.equal(token, "valid-token");
        assert.equal(secret, "test-secret");
        return { userId: 42, authkitId: "authkit-user", email: user.email };
    };

    const response = await fetch(`${baseUrl}/auth/me`, {
        headers: { authorization: "Bearer valid-token" },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), user);
});

test("logout redirects to the configured frontend", async () => {
    const response = await fetch(`${baseUrl}/auth/logout`, { redirect: "manual" });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://frontend.example");
});
