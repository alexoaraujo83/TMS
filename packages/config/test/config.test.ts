import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../dist/index.js";

const baseEnv = {
  APP_ENV: "development",
  APP_URL: "http://localhost:3000",
  API_URL: "http://localhost:3001",
  DATABASE_URL: "postgres://app",
  DATABASE_DIRECT_URL: "postgres://direct",
  AUTH0_DOMAIN: "tenant.example.auth0.com",
  AUTH0_CLIENT_ID: "client-id",
  AUTH0_CLIENT_SECRET: "client-secret",
  AUTH0_AUDIENCE: "urn:tms:api:development",
  AUTH0_ISSUER_BASE_URL: "https://tenant.example.auth0.com",
  AUTH0_JWKS_URL: "https://tenant.example.auth0.com/.well-known/jwks.json",
};

test("loads the current Auth0 and worker environment contract", () => {
  const config = loadConfig(baseEnv);

  assert.equal(config.appEnv, "development");
  assert.equal(config.databaseDirectUrl, "postgres://direct");
  assert.equal(config.auth0Audience, "urn:tms:api:development");
  assert.equal(config.tenantHeader, "x-tenant-id");
  assert.equal(config.workerEnabled, false);
  assert.equal(config.workerConcurrency, 5);
});

test("rejects obsolete or invalid worker configuration", () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, WORKER_ENABLED: "yes" }),
    /Invalid WORKER_ENABLED/,
  );
  assert.throws(
    () => loadConfig({ ...baseEnv, WORKER_CONCURRENCY: "0" }),
    /Invalid WORKER_CONCURRENCY/,
  );
});

test("requires the current Auth0 contract", () => {
  const env = { ...baseEnv };
  delete env.AUTH0_AUDIENCE;
  assert.throws(() => loadConfig(env), /Missing required environment variable: AUTH0_AUDIENCE/);
});
