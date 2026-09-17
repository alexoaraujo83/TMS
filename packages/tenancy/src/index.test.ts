import test from "node:test";
import assert from "node:assert/strict";

import { assertSameTenant, assertTenantContext } from "./index.ts";

test("accepts a complete tenant context", () => {
  const context = { tenantId: "tenant-1", userId: "user-1", roles: [] };
  assert.doesNotThrow(() => assertTenantContext(context));
});

test("rejects an incomplete tenant context", () => {
  assert.throws(
    () => assertTenantContext({ tenantId: "", userId: "user-1", roles: [] }),
    /Tenant context is required/,
  );
});

test("allows access within the same tenant", () => {
  assert.doesNotThrow(() => assertSameTenant("tenant-1", "tenant-1"));
});

test("rejects cross-tenant resource access", () => {
  assert.throws(
    () => assertSameTenant("tenant-1", "tenant-2"),
    /Cross-tenant resource access denied/,
  );
});
