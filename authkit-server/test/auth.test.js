const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
process.env.WORKOS_CLIENT_ID = "client_test";
process.env.FRONTEND_URL = "http://frontend.test/";
process.env.WORKOS_REDIRECT_URI = "http://auth.test//auth/callback/";

const { pool } = require("../dist/services/db");
const { workos } = require("../dist/workos");
const authRouter = require("../dist/routes/auth").default;

let server;
let baseUrl;

before(async () => {
    const app = express();
    app.use("/auth", authRouter);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
}));

test("login redirects to the AuthKit sign-in URL", async () => {
    let authorizationOptions;
    workos.userManagement.getAuthorizationUrl = (options) => {
        authorizationOptions = options;
        return "https://auth.test/sign-in";
    };

    const response = await fetch(`${baseUrl}/auth/login`, { redirect: "manual" });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://auth.test/sign-in");
    assert.deepEqual(authorizationOptions, {
        provider: "authkit",
        redirectUri: "http://auth.test/auth/callback",
        clientId: "client_test",
        screenHint: "sign-in",
    });
});

test("callback rejects a request without an authorization code", async () => {
    const response = await fetch(`${baseUrl}/auth/callback`);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Missing code" });
});

test("callback authenticates, creates a new user, and returns a signed token", async () => {
    workos.userManagement.authenticateWithCode = async (options) => {
        assert.deepEqual(options, { clientId: "client_test", code: "code_test" });
        return {
            user: { id: "user_workos", email: "user@example.com", firstName: "Ada" },
            sealedSession: "unused",
        };
    };
    const queries = [];
    pool.query = async (text, values) => {
        queries.push({ text, values });
        if (text.startsWith("INSERT")) return { rows: [] };
        if (queries.length === 1) return { rows: [] };
        return { rows: [{ id: 42, email: "user@example.com" }] };
    };

    const response = await fetch(`${baseUrl}/auth/callback?code=code_test`, { redirect: "manual" });

    assert.equal(response.status, 302);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.origin + location.pathname, "http://frontend.test/callback");
    assert.equal(location.searchParams.get("auth"), "success");
    const payload = jwt.verify(location.searchParams.get("token"), "test-secret");
    assert.equal(payload.userId, 42);
    assert.equal(payload.authkitId, "user_workos");
    assert.equal(payload.email, "user@example.com");
    assert.equal(typeof payload.iat, "number");
    assert.equal(typeof payload.exp, "number");
    assert.equal(queries.length, 3);
    assert.deepEqual(queries[1].values, ["user_workos", "user@example.com", "Ada"]);
});

test("session returns null when no bearer token is supplied", async () => {
    const response = await fetch(`${baseUrl}/auth/me`);

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
});

test("session returns the database user for a valid bearer token", async () => {
    const user = { id: 42, email: "user@example.com", name: "Ada" };
    pool.query = async (text, values) => {
        assert.equal(text, "SELECT * FROM users WHERE id = $1");
        assert.deepEqual(values, [42]);
        return { rows: [user] };
    };
    const token = jwt.sign(
        { userId: 42, authkitId: "user_workos", email: user.email },
        "test-secret",
    );

    const response = await fetch(`${baseUrl}/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), user);
});

test("session returns null for an invalid bearer token", async () => {
    const response = await fetch(`${baseUrl}/auth/me`, {
        headers: { authorization: "Bearer not-a-token" },
    });

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
});

test("logout redirects to the frontend without a trailing slash", async () => {
    const response = await fetch(`${baseUrl}/auth/logout`, { redirect: "manual" });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "http://frontend.test");
});
