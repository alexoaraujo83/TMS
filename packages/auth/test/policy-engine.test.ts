import { strict as assert } from "node:assert";
import { test } from "node:test";
import { evaluateAccess } from "../src/policy-engine.ts";

const membership = {
  userId: "user-1",
  tenantId: "tenant-a",
  active: true,
  permissions: ["freight:read", "freight:update"],
};

const base = {
  principalUserId: "user-1",
  tenantId: "tenant-a",
  permission: "freight:read",
  membership,
  resourceTenantId: "tenant-a",
};

test("allows an active membership with the exact permission in the same tenant", () => {
  assert.deepEqual(evaluateAccess(base), { allowed: true, reason: "ALLOW" });
});

test("denies when membership is missing", () => {
  assert.deepEqual(evaluateAccess({ ...base, membership: null }), {
    allowed: false,
    reason: "MEMBERSHIP_REQUIRED",
  });
});

test("denies inactive memberships", () => {
  assert.deepEqual(
    evaluateAccess({ ...base, membership: { ...membership, active: false } }),
    { allowed: false, reason: "MEMBERSHIP_INACTIVE" },
  );
});

test("denies tenant and identity mismatches", () => {
  assert.equal(
    evaluateAccess({ ...base, tenantId: "tenant-b" }).reason,
    "TENANT_MISMATCH",
  );
  assert.equal(
    evaluateAccess({ ...base, principalUserId: "user-2" }).reason,
    "IDENTITY_MISMATCH",
  );
});

test("denies a resource owned by another tenant", () => {
  assert.deepEqual(evaluateAccess({ ...base, resourceTenantId: "tenant-b" }), {
    allowed: false,
    reason: "RESOURCE_TENANT_MISMATCH",
  });
});

test("denies missing and wildcard-only permissions by default", () => {
  assert.equal(
    evaluateAccess({ ...base, permission: "freight:delete" }).reason,
    "MISSING_PERMISSION",
  );
  assert.equal(
    evaluateAccess({
      ...base,
      membership: { ...membership, permissions: ["*"] },
    }).reason,
    "MISSING_PERMISSION",
  );
});

test("denies malformed requests", () => {
  assert.deepEqual(evaluateAccess({ ...base, permission: " " }), {
    allowed: false,
    reason: "INVALID_REQUEST",
  });
});
