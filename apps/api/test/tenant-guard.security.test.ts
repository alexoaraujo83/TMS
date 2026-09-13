import assert from "node:assert/strict";
import test from "node:test";
import { TenantGuard } from "../src/common/tenant.guard.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

function guard() {
  return new TenantGuard();
}

test("TenantGuard accepts the authenticated tenant context", () => {
  assert.equal(
    guard().canActivate(
      contextFor({
        headers: {},
        context: {
          requestId: "req-1",
          userId: USER_ID,
          tenantId: TENANT_ID,
          roles: ["operator"],
          permissions: ["freight:read"],
        },
      }),
    ),
    true,
  );
});

test("TenantGuard accepts a matching tenant header", () => {
  assert.equal(
    guard().canActivate(
      contextFor({
        headers: { "x-tenant-id": TENANT_ID },
        context: {
          requestId: "req-1",
          userId: USER_ID,
          tenantId: TENANT_ID,
          roles: ["operator"],
          permissions: [],
        },
      }),
    ),
    true,
  );
});

test("TenantGuard rejects a tenant header that differs from authenticated context", () => {
  assert.throws(
    () =>
      guard().canActivate(
        contextFor({
          headers: { "x-tenant-id": OTHER_TENANT_ID },
          context: {
            requestId: "req-1",
            userId: USER_ID,
            tenantId: TENANT_ID,
            roles: ["operator"],
            permissions: [],
          },
        }),
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        "Tenant context does not match the authenticated context",
  );
});

test("TenantGuard fails closed without authenticated context", () => {
  assert.throws(
    () => guard().canActivate(contextFor({ headers: {} })),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Authenticated tenant context is required",
  );
});
