import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { TMS_TENANT_ID_CLAIM } from "@tms/auth";
import { AuthGuard } from "../src/common/auth.guard.ts";

const ISSUER = "https://tenant.example.auth0.com";
const AUDIENCE = "urn:tms:api:development";
const JWKS_URL = "https://jwks.example.test/.well-known/jwks.json";
const AUTH0_SUBJECT = "auth0|user-1";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
process.env.AUTH0_ISSUER_BASE_URL = ISSUER;
process.env.AUTH0_AUDIENCE = AUDIENCE;
process.env.AUTH0_JWKS_URL = JWKS_URL;

globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      keys: [
        {
          ...jwk,
          kty: "RSA",
          use: "sig",
          alg: "RS256",
          kid: "test-key",
        },
      ],
    }),
    { headers: { "content-type": "application/json" } },
  );

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

async function token(
  overrides: Record<string, unknown> = {},
  options: { audience?: string; issuer?: string; expiresAt?: number } = {},
) {
  return new SignJWT({
    [TMS_TENANT_ID_CLAIM]: TENANT_A,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT" })
    .setSubject(AUTH0_SUBJECT)
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? "5m")
    .sign(privateKey);
}

function guard(rows: readonly unknown[]) {
  return new AuthGuard({
    query: async () => ({ rows }),
  } as never);
}

test("uses DB membership instead of JWT permissions", async () => {
  const request = {
    headers: {
      authorization: `Bearer ${await token({ permissions: ["iam:manage"] })}`,
      "x-tenant-id": TENANT_A,
    },
  };

  const result = await guard([
    {
      userId: USER_ID,
      tenantId: TENANT_A,
      role: "operator",
      permissions: ["freight:read"],
      active: true,
    },
  ]).canActivate(contextFor(request));

  assert.equal(result, true);
  assert.deepEqual(request.context, {
    requestId: "",
    userId: USER_ID,
    tenantId: TENANT_A,
    roles: ["operator"],
    permissions: ["freight:read"],
  });
});

test("rejects a tenant header that differs from the authenticated claim", async () => {
  const request = {
    headers: {
      authorization: `Bearer ${await token()}`,
      "x-tenant-id": TENANT_B,
    },
  };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        "Tenant header does not match the authenticated tenant claim",
  );
});

test("rejects a forged tenant without membership", async () => {
  const request = {
    headers: {
      authorization: `Bearer ${await token()}`,
      "x-tenant-id": TENANT_A,
    },
  };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Active tenant membership required",
  );
});

test("rejects an inactive tenant membership", async () => {
  const request = {
    headers: {
      authorization: `Bearer ${await token()}`,
      "x-tenant-id": TENANT_A,
    },
  };

  await assert.rejects(
    () =>
      guard([
        {
          userId: USER_ID,
          tenantId: TENANT_A,
          role: "operator",
          permissions: [],
          active: false,
        },
      ]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Active tenant membership required",
  );
});

test("rejects missing authentication", async () => {
  const request = { headers: {} };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Authentication required",
  );
});

test("rejects a token with an invalid issuer", async () => {
  const invalid = await token({}, { issuer: "https://attacker.example.com" });
  const request = { headers: { authorization: `Bearer ${invalid}` } };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Invalid access token",
  );
});

test("rejects a token with an invalid audience", async () => {
  const invalid = await token({}, { audience: "wrong-audience" });
  const request = { headers: { authorization: `Bearer ${invalid}` } };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Invalid access token",
  );
});

test("rejects an expired token", async () => {
  const expired = await token(
    {},
    {
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    },
  );
  const request = { headers: { authorization: `Bearer ${expired}` } };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) => error instanceof Error && error.message === "Invalid access token",
  );
});

test("requires tenant selection without a tenant claim", async () => {
  const noTenant = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT" })
    .setSubject(AUTH0_SUBJECT)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const request = { headers: { authorization: `Bearer ${noTenant}` } };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Tenant claim is required",
  );
});
