import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import { AuthGuard } from "../src/common/auth.guard.ts";

const SECRET = "test-secret-for-auth-guard-only";
const ISSUER = "tms";
const AUDIENCE = "tms-api";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

process.env.JWT_SECRET = SECRET;
process.env.JWT_ISSUER = ISSUER;
process.env.JWT_AUDIENCE = AUDIENCE;

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    tenantId: TENANT_A,
    roles: ["admin"],
    permissions: ["*"],
    ...overrides,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(SECRET));
}

function guard(rows: readonly unknown[]) {
  return new AuthGuard({
    query: async () => ({ rows }),
  } as never);
}

test("AuthGuard uses database membership for the selected tenant, not JWT permissions", async () => {
  const request = {
    headers: {
      authorization: `Bearer ${await token({ permissions: ["iam:manage"] })}`,
      "x-tenant-id": TENANT_B,
    },
  };

  const result = await guard([
    {
      userId: USER_ID,
      tenantId: TENANT_B,
      role: "operator",
      permissions: ["freight:read"],
      active: true,
    },
  ]).canActivate(contextFor(request));

  assert.equal(result, true);
  assert.deepEqual(request.context, {
    requestId: "",
    userId: USER_ID,
    tenantId: TENANT_B,
    roles: ["operator"],
    permissions: ["freight:read"],
  });
});

test("AuthGuard rejects a forged tenant selection when membership does not exist", async () => {
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
      error.message === "Active tenant membership required",
  );
});

test("AuthGuard rejects an inactive tenant membership", async () => {
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

test("AuthGuard rejects missing authentication", async () => {
  const request = { headers: {} };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Authentication required",
  );
});

test("AuthGuard rejects a token with an invalid issuer", async () => {
  const invalid = await new SignJWT({ tenantId: TENANT_A })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setIssuer("attacker")
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(SECRET));

  const request = { headers: { authorization: `Bearer ${invalid}` } };

  await assert.rejects(
    () => guard([]).canActivate(contextFor(request)),
    (error: unknown) => error instanceof Error && error.message === "Invalid access token",
  );
});
