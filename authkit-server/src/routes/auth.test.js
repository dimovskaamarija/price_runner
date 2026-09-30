const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

const { pool } = require("../../dist/services/db");
const { workos } = require("../../dist/workos");
const authRouter = require("../../dist/routes/auth").default;

let baseUrl;
let server;

before(async () => {
  const app = express();
  app.use("/auth", authRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
  await pool.end();
});

test("callback rejects requests without an authorization code", async () => {
  const response = await fetch(`${baseUrl}/auth/callback`);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Missing code" });
});

test("callback forwards provider errors to the frontend", async () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.FRONTEND_URL = "https://example.test/";

  try {
    const response = await fetch(
      `${baseUrl}/auth/callback?error=access_denied&error_description=Cancelled`,
      { redirect: "manual" }
    );

    assert.equal(response.status, 302);
    assert.equal(
      response.headers.get("location"),
      "https://example.test/callback?auth=error&error=access_denied"
    );
  } finally {
    restoreEnv("FRONTEND_URL", previousFrontendUrl);
  }
});

test("callback authenticates the user and returns an application token", async () => {
  const originalAuthenticate = workos.userManagement.authenticateWithCode;
  const originalQuery = pool.query;
  const previousClientId = process.env.WORKOS_CLIENT_ID;
  const previousFrontendUrl = process.env.FRONTEND_URL;
  process.env.WORKOS_CLIENT_ID = "client_test";
  process.env.FRONTEND_URL = "https://example.test";

  workos.userManagement.authenticateWithCode = async (request) => {
    assert.deepEqual(request, { clientId: "client_test", code: "valid-code" });
    return {
      user: {
        id: "user_123",
        email: "person@example.test",
        firstName: "Test",
      },
      sealedSession: "unused",
    };
  };
  pool.query = async () => ({
    rows: [{ id: 42, authkit_id: "user_123", email: "person@example.test" }],
  });

  try {
    const response = await fetch(`${baseUrl}/auth/callback?code=valid-code`, {
      redirect: "manual",
    });

    assert.equal(response.status, 302);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.origin + location.pathname, "https://example.test/callback");
    assert.equal(location.searchParams.get("auth"), "success");
    const payload = jwt.verify(
      location.searchParams.get("token"),
      process.env.JWT_SECRET || "your-secret-key-change-in-production"
    );
    assert.equal(payload.userId, 42);
    assert.equal(payload.authkitId, "user_123");
    assert.equal(payload.email, "person@example.test");
  } finally {
    workos.userManagement.authenticateWithCode = originalAuthenticate;
    pool.query = originalQuery;
    restoreEnv("WORKOS_CLIENT_ID", previousClientId);
    restoreEnv("FRONTEND_URL", previousFrontendUrl);
  }
});

test("me returns null for an invalid bearer token without querying the database", async () => {
  const originalQuery = pool.query;
  let queried = false;
  pool.query = async () => {
    queried = true;
    return { rows: [] };
  };

  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: "Bearer not-a-valid-token" },
    });

    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
    assert.equal(queried, false);
  } finally {
    pool.query = originalQuery;
  }
});

test("login reports missing WorkOS client configuration", async () => {
  const previousClientId = process.env.WORKOS_CLIENT_ID;
  delete process.env.WORKOS_CLIENT_ID;

  try {
    const response = await fetch(`${baseUrl}/auth/login`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "WORKOS_CLIENT_ID is not configured",
    });
  } finally {
    restoreEnv("WORKOS_CLIENT_ID", previousClientId);
  }
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
