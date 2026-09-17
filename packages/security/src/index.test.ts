import test from "node:test";
import assert from "node:assert/strict";

import {
  SECURITY_HEADERS,
  assertSafeIdentifier,
  hasPermission,
  requirePermission,
} from "./index.ts";

const context = {
  userId: "user-1",
  tenantId: "tenant-1",
  roles: ["dispatcher"],
  permissions: ["freight:read"],
};

test("defines baseline security headers", () => {
  assert.equal(SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
  assert.equal(SECURITY_HEADERS["X-Frame-Options"], "DENY");
  assert.equal(SECURITY_HEADERS["Referrer-Policy"], "strict-origin-when-cross-origin");
});

test("checks explicit permissions and wildcard access", () => {
  assert.equal(hasPermission(context, "freight:read"), true);
  assert.equal(hasPermission(context, "freight:write"), false);
  assert.equal(
    hasPermission({ ...context, permissions: ["*"] }, "anything"),
    true,
  );
});

test("rejects missing permissions", () => {
  assert.throws(() => requirePermission(context, "freight:write"), /Forbidden/);
});

test("accepts safe identifiers and rejects unsafe values", () => {
  assert.equal(assertSafeIdentifier("tenant_123"), "tenant_123");
  assert.throws(() => assertSafeIdentifier("tenant/123"), /Invalid identifier/);
  assert.throws(() => assertSafeIdentifier(""), /Invalid identifier/);
});
