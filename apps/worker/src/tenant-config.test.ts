import { test } from "node:test";
import assert from "node:assert/strict";
import { assertConfiguredTenantsAreActive } from "./tenant-config.js";

function createPool(rowsByTenant: Map<string, Array<{ id: string }>>) {
  const queries: string[] = [];
  const client = {
    query: async (text: string, params?: unknown[]) => {
      queries.push(text);
      if (/^begin|^rollback/.test(text)) return { rows: [] };
      if (/^select set_config/.test(text)) return { rows: [] };
      const tenantId = String(params?.[0]);
      return { rows: rowsByTenant.get(tenantId) ?? [] };
    },
    release: () => undefined,
  };
  return {
    pool: { connect: async () => client } as never,
    queries,
  };
}

test("configured active tenants are validated inside their RLS context", async () => {
  const active = "11111111-1111-4111-8111-111111111111";
  const { pool, queries } = createPool(new Map([[active, [{ id: active }]]]));

  await assertConfiguredTenantsAreActive(pool, [active]);

  assert.ok(queries.some((query) => /set_config\(\$1, \$2, true\)/.test(query)));
  assert.ok(queries.some((query) => /status = 'active'/.test(query)));
});

test("inactive or nonexistent configured tenants fail startup validation", async () => {
  const active = "11111111-1111-4111-8111-111111111111";
  const inactive = "22222222-2222-4222-8222-222222222222";
  const { pool } = createPool(new Map([[active, [{ id: active }]]]));

  await assert.rejects(
    () => assertConfiguredTenantsAreActive(pool, [active, inactive]),
    /INVALID_WORKER_CONFIG:OUTBOX_TENANT_IDS_NOT_ACTIVE:22222222-2222-4222-8222-222222222222/,
  );
});

test("empty tenant configuration does not query for tenant rows", async () => {
  let connected = false;
  const pool = {
    connect: async () => {
      connected = true;
      return {};
    },
  } as never;

  await assertConfiguredTenantsAreActive(pool, []);
  assert.equal(connected, false);
});
