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
    assert.equal(event.leaseToken, null);
    assert.deepEqual(event.payload, { source: "integration-test" });

    const pending = await outbox.listPending(tenantId);
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.id, event.id);

    const claimed = await outbox.claimPending(tenantId, 1);
    assert.equal(claimed[0]?.id, event.id);
    assert.ok(claimed[0]?.leaseToken);

    const published = await outbox.markPublished(
      tenantId,
      event.id,
      claimed[0]!.leaseToken!,
    );
    assert.equal(published.status, "published");
    assert.equal(published.leaseToken, null);
    assert.ok(published.publishedAt instanceof Date);

    await assert.rejects(
      outbox.markPublished(tenantId, event.id, claimed[0]!.leaseToken!),
      /OUTBOX_EVENT_NOT_PUBLISHABLE/,
    );
  });

  it("claims pending events and increments attempts atomically", async () => {
    const first = await outbox.enqueue({
      tenantId,
      aggregateType: "freight",
      eventType: "freight.created",
    });
    const second = await outbox.enqueue({
      tenantId,
      aggregateType: "freight",
      eventType: "freight.updated",
    });

    const claimed = await outbox.claimPending(tenantId, 2);
    assert.deepEqual(
      claimed.map((event) => event.id),
      [first.id, second.id],
    );
    assert.deepEqual(
      claimed.map((event) => event.attempts),
      [1, 1],
    );
    assert.equal(
      claimed.every((event) => event.availableAt.getTime() > Date.now()),
      true,
    );
    assert.equal(claimed.every((event) => Boolean(event.leaseToken)), true);
    assert.deepEqual(await outbox.listPending(tenantId), []);
  });

  it("uses skip-locked claims to avoid duplicate concurrent work", async () => {
    const first = await outbox.enqueue({
      tenantId,
      aggregateType: "freight",
      eventType: "freight.created",
    });
    const second = await outbox.enqueue({
      tenantId,
      aggregateType: "freight",
      eventType: "freight.updated",
    });

    const [claimA, claimB] = await Promise.all([
      outbox.claimPending(tenantId, 1),
      outbox.claimPending(tenantId, 1),
    ]);
    const claimedIds = [claimA[0]?.id, claimB[0]?.id].filter(
      (id): id is string => Boolean(id),
    );

    assert.deepEqual(new Set(claimedIds), new Set([first.id, second.id]));
    assert.notEqual(claimA[0]?.leaseToken, claimB[0]?.leaseToken);
  });

  it("rejects stale lease finalization after an event is reclaimed", async () => {
    const event = await outbox.enqueue({
      tenantId,
      aggregateType: "freight",
      eventType: "freight.created",
    });

    const firstClaim = await outbox.claimPending(tenantId, 1);
    const firstLease = firstClaim[0]?.leaseToken;
    assert.ok(firstLease);

    const client = await pool.connect();
    try {
      await client.query(
        "update outbox_events set available_at = now() where id = $1",
        [event.id],
      );
    } finally {
      client.release();
    }

    const secondClaim = await outbox.claimPending(tenantId, 1);
    const secondLease = secondClaim[0]?.leaseToken;
    assert.ok(secondLease);
    assert.notEqual(firstLease, secondLease);

    await assert.rejects(
      outbox.markPublished(tenantId, event.id, firstLease),
      /OUTBOX_EVENT_NOT_PUBLISHABLE/,
    );
    await assert.rejects(
      outbox.markFailed(tenantId, event.id, firstLease, "stale", {
        maxAttempts: 5,
        retryAt: new Date(),
      }),
      /OUTBOX_EVENT_NOT_FAILABLE/,
    );

    const published = await outbox.markPublished(
      tenantId,
      event.id,
      secondLease,
    );
    assert.equal(published.status, "published");
  });

  it("retries failures and moves an exhausted event to failed", async () => {
    const event = await outbox.enqueue({
      tenantId,
      aggregateType: "finance",
      eventType: "financial_entry.created",
    });

    const claimed = await outbox.claimPending(tenantId, 1);
    assert.equal(claimed[0]?.id, event.id);

    const retry = await outbox.markFailed(
      tenantId,
      event.id,
      claimed[0]!.leaseToken!,
      "temporary",
      {
        maxAttempts: 2,
        retryAt: new Date(),
      },
    );
    assert.equal(retry.status, "pending");
    assert.equal(retry.leaseToken, null);
    assert.equal(retry.lastError, "temporary");
    assert.equal(retry.attempts, 1);

    const claimedAgain = await outbox.claimPending(tenantId, 1);
    assert.equal(claimedAgain[0]?.id, event.id);
    assert.equal(claimedAgain[0]?.attempts, 2);

    const failed = await outbox.markFailed(
      tenantId,
      event.id,
      claimedAgain[0]!.leaseToken!,
      "permanent",
      {
        maxAttempts: 2,
      },
    );
    assert.equal(failed.status, "failed");
    assert.equal(failed.leaseToken, null);
    assert.equal(failed.attempts, 2);
    assert.equal(failed.lastError, "permanent");
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
      outbox.markPublished(otherTenantId, event.id, randomUUID()),
      /OUTBOX_EVENT_NOT_PUBLISHABLE/,
    );
  });
}
