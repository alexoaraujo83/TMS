import { test } from "node:test";
import assert from "node:assert/strict";
import { assertConfiguredTenantsAreActive } from "./tenant-config.js";

function createPool(rows: Array<{ id: string }>) {
  return {
    query: async () => ({ rows }),
  } as never;
}

test("configured tenants must all be active", async () => {
  const active = "11111111-1111-4111-8111-111111111111";

  await assertConfiguredTenantsAreActive(createPool([{ id: active }]), [active]);
});

test("inactive or nonexistent configured tenants fail startup validation", async () => {
  const active = "11111111-1111-4111-8111-111111111111";
  const inactive = "22222222-2222-4222-8222-222222222222";

  await assert.rejects(
    () =>
      assertConfiguredTenantsAreActive(createPool([{ id: active }]), [
        active,
        inactive,
      ]),
    /INVALID_WORKER_CONFIG:OUTBOX_TENANT_IDS_NOT_ACTIVE:22222222-2222-4222-8222-222222222222/,
  );
});

test("empty tenant configuration does not query for tenant rows", async () => {
  let queried = false;
  const pool = {
    query: async () => {
      queried = true;
      return { rows: [] };
    },
  } as never;

  await assertConfiguredTenantsAreActive(pool, []);
  assert.equal(queried, false);
});
