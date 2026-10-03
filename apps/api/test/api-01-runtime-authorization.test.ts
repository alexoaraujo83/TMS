import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { TMS_EMAIL_CLAIM, TMS_TENANT_ID_CLAIM } from "@tms/auth";
import { AuthGuard } from "../src/common/auth.guard.ts";
import { PermissionGuard, REQUIRED_PERMISSION } from "../src/common/permission.guard.ts";
import { FreightController } from "../src/modules/freight/freight.controller.ts";

const ISSUER = "https://tenant.example.auth0.com";
const AUDIENCE = "urn:tms:api:development";
const JWKS_URL = "https://jwks.example.test/.well-known/jwks.json";
const SUBJECT = "auth0|api-01-runtime-user";
const EMAIL = "api-01@example.test";
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
      keys: [{ ...jwk, kty: "RSA", use: "sig", alg: "RS256", kid: "api-01-test" }],
    }),
    { headers: { "content-type": "application/json" } },
  );

function httpContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

async function token(tenantId = TENANT_A) {
  return new SignJWT({
    [TMS_TENANT_ID_CLAIM]: tenantId,
    [TMS_EMAIL_CLAIM]: EMAIL,
  })
    .setProtectedHeader({ alg: "RS256", kid: "api-01-test", typ: "JWT" })
    .setSubject(SUBJECT)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

function membershipPool(
  permissions: readonly string[],
  options: { active?: boolean; tenantId?: string } = {},
) {
  return {
    query: async () => ({
      rows: [
        {
          userId: USER_ID,
          tenantId: options.tenantId ?? TENANT_A,
          role: "operator",
          permissions: [...permissions],
          active: options.active ?? true,
        },
      ],
    }),
  };
}

async function authenticate(
  permissions: readonly string[],
  options: { tenantId?: string; headerTenantId?: string; active?: boolean } = {},
) {
  const jwt = await token(options.tenantId ?? TENANT_A);
  const request = {
    headers: {
      authorization: `Bearer ${jwt}`,
      ...(options.headerTenantId ? { "x-tenant-id": options.headerTenantId } : {}),
    },
  };
  const result = await new AuthGuard(
    membershipPool(permissions, {
      active: options.active,
      tenantId: options.tenantId ?? TENANT_A,
    }) as never,
  ).canActivate(httpContext(request));
  assert.equal(result, true);
  return request;
}

function permissionGuardFor(permission: string) {
  return new PermissionGuard({
    getAllAndOverride: () => permission,
  } as never);
}

const routePermissions: Record<string, string> = {
  create: "freight:create",
  list: "freight:read",
  runtimeContext: "ops:diagnostics",
  runtimeDbContext: "ops:diagnostics",
  runtimeRlsIsolation: "ops:diagnostics",
  runtimeRlsEvidence: "ops:diagnostics",
  runtimeAuthClaims: "ops:diagnostics",
  update: "freight:update",
  remove: "freight:delete",
  get: "freight:read",
  statusEvents: "freight:read",
  matches: "matching:read",
  assign: "matching:assign",
  replayStatusChangedEvent: "freight:replay",
  updateStatus: "freight:update",
};

test("API-01 runtime matrix: every FreightController permission allows its authorized context", async () => {
  for (const [method, permission] of Object.entries(routePermissions)) {
    const request = await authenticate([permission]);
    const handler = (FreightController.prototype as Record<string, unknown>)[method];
    assert.equal(
      Reflect.getMetadata(REQUIRED_PERMISSION, handler),
      permission,
      `route metadata mismatch for ${method}`,
    );

    const guard = permissionGuardFor(permission);
    const result = guard.canActivate({
      switchToHttp: () => ({ getRequest: () => request }),
    } as never);

    assert.equal(result, true, `authorized permission rejected for ${method}`);
  }
});

test("API-01 runtime matrix: missing route permission is denied", async () => {
  for (const [method, requiredPermission] of Object.entries(routePermissions)) {
    const request = await authenticate(["freight:read"]);
    const handler = (FreightController.prototype as Record<string, unknown>)[method];
    const declared = Reflect.getMetadata(REQUIRED_PERMISSION, handler);
    assert.equal(declared, requiredPermission);

    if (requiredPermission === "freight:read") continue;

    assert.throws(
      () =>
        permissionGuardFor(requiredPermission).canActivate({
          switchToHttp: () => ({ getRequest: () => request }),
        } as never),
      (error: unknown) =>
        error instanceof Error && error.message === "Insufficient permission",
      `unexpected authorization for ${method}`,
    );
  }
});

test("API-01 runtime matrix: wildcard permission remains explicitly authorized", async () => {
  for (const [method, requiredPermission] of Object.entries(routePermissions)) {
    const request = await authenticate(["*"]);
    const handler = (FreightController.prototype as Record<string, unknown>)[method];
    assert.equal(Reflect.getMetadata(REQUIRED_PERMISSION, handler), requiredPermission);

    assert.equal(
      permissionGuardFor(requiredPermission).canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as never),
      true,
    );
  }
});

test("API-01 negative auth: missing bearer is rejected before authorization", async () => {
  const request = { headers: {} };

  await assert.rejects(
    () =>
      new AuthGuard(membershipPool(["freight:read"]) as never).canActivate(
        httpContext(request),
      ),
    (error: unknown) =>
      error instanceof Error && error.message === "Authentication required",
  );
});

test("API-01 negative auth: tenant header mismatch is rejected", async () => {
  const jwt = await token(TENANT_A);
  const request = {
    headers: {
      authorization: `Bearer ${jwt}`,
      "x-tenant-id": TENANT_B,
    },
  };

  await assert.rejects(
    () =>
      new AuthGuard(
        membershipPool(["freight:read"], { tenantId: TENANT_A }) as never,
      ).canActivate(httpContext(request)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Tenant header does not match the authenticated tenant claim",
  );
});

test("API-01 negative auth: inactive membership is rejected", async () => {
  const jwt = await token(TENANT_A);
  const request = {
    headers: { authorization: `Bearer ${jwt}` },
  };

  await assert.rejects(
    () =>
      new AuthGuard(
        membershipPool(["freight:read"], { tenantId: TENANT_A, active: false }) as never,
      ).canActivate(httpContext(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Active tenant membership required",
  );
});
