const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.FRONTEND_URL = "https://frontend.example/";
process.env.JWT_SECRET = "test-secret";
process.env.WORKOS_CLIENT_ID = "client_test";

const { pool } = require("../src/services/db");
const { workos } = require("../src/workos");
const authRouter = require("../src/routes/auth").default;

const originalAuthenticateWithCode =
    workos.userManagement.authenticateWithCode.bind(workos.userManagement);
const originalQuery = pool.query.bind(pool);

let baseUrl;
let server;

before(async () => {
    const app = express();
    app.use("/auth", authRouter);

    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    workos.userManagement.authenticateWithCode = originalAuthenticateWithCode;
    pool.query = originalQuery;
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
});

async function request(path, options = {}) {
    return fetch(`${baseUrl}${path}`, {
        redirect: "manual",
        ...options,
    });
}

test("callback rejects a request without an authorization code", async () => {
    const response = await request("/auth/callback");

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Missing code" });
});

test("callback creates a session token and redirects to the frontend", async () => {
    workos.userManagement.authenticateWithCode = async () => ({
        user: {
            id: "user_01",
            email: "buyer@example.com",
            firstName: "Buyer",
        },
        sealedSession: "unused-session",
    });
    pool.query = async () => ({
        rows: [{
            id: 42,
            authkit_id: "user_01",
            email: "buyer@example.com",
            name: "Buyer",
        }],
    });

    const response = await request("/auth/callback?code=authorization-code");

    assert.equal(response.status, 302);
    const redirect = new URL(response.headers.get("location"));
    assert.equal(redirect.origin + redirect.pathname, "https://frontend.example/callback");
    assert.equal(redirect.searchParams.get("auth"), "success");
    const decoded = jwt.verify(redirect.searchParams.get("token"), "test-secret");
    assert.equal(decoded.userId, 42);
    assert.equal(decoded.authkitId, "user_01");
    assert.equal(decoded.email, "buyer@example.com");
    assert.equal(typeof decoded.iat, "number");
    assert.equal(typeof decoded.exp, "number");
});

test("session returns null when no bearer token is supplied", async () => {
    const response = await request("/auth/me");

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
});

test("session returns the database user for a valid bearer token", async () => {
    const user = {
        id: 42,
        authkit_id: "user_01",
        email: "buyer@example.com",
        name: "Buyer",
    };
    pool.query = async () => ({ rows: [user] });
    const token = jwt.sign({
        userId: user.id,
        authkitId: user.authkit_id,
        email: user.email,
    }, "test-secret");

    const response = await request("/auth/me", {
        headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), user);
});

test("logout redirects to the frontend without a trailing slash", async () => {
    const response = await request("/auth/logout");

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://frontend.example");
});
