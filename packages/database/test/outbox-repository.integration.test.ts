import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { OutboxRepository } from "../src/outbox-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("Outbox repository integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const outbox = new OutboxRepository(pool);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("alter table outbox_events disable row level security");
      await client.query("alter table tenants disable row level security");
      for (const [id, suffix] of [
        [tenantId, "outbox-a"],
        [otherTenantId, "outbox-b"],
      ]) {
        await client.query(
          "insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')",
          [id, `Outbox Test ${suffix}`, `${suffix}-${id}`],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("alter table outbox_events disable row level security");
      await client.query("alter table tenants disable row level security");
      await client.query(
        "delete from outbox_events where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query("delete from tenants where id in ($1, $2)", [
        tenantId,
        otherTenantId,
      ]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  it("enqueues, lists and publishes an event", async () => {
    const event = await outbox.enqueue({
      tenantId,
      aggregateType: "freight",
      aggregateId: randomUUID(),
      eventType: "freight.created",
      payload: { source: "integration-test" },
    });

    assert.equal(event.tenantId, tenantId);
    assert.equal(event.status, "pending");
    assert.equal(event.attempts, 0);
    assert.deepEqual(event.payload, { source: "integration-test" });

    const pending = await outbox.listPending(tenantId);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.id, event.id);

    const published = await outbox.markPublished(tenantId, event.id);
    assert.equal(published.status, "published");
    assert.ok(published.publishedAt instanceof Date);

    await assert.rejects(outbox.markPublished(tenantId, event.id), /OUTBOX_EVENT_NOT_PUBLISHABLE/);
  });

  it("isolates events by tenant", async () => {
    const event = await outbox.enqueue({
      tenantId,
      aggregateType: "finance",
      eventType: "financial_entry.created",
      payload: { amountCents: 1000 },
    });

    assert.deepEqual(await outbox.listPending(otherTenantId), []);
    await assert.rejects(
      outbox.markPublished(otherTenantId, event.id),
      /OUTBOX_EVENT_NOT_PUBLISHABLE/,
    );
  });
}
