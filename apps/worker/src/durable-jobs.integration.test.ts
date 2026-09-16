import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { createDurableWebhookHandler } from "./durable-job-handlers.js";
import { PgDurableJobStore } from "./durable-jobs-store.js";
import { WebhookPublisher } from "./webhook-publisher.js";

const integrationEnabled = process.env.RUN_DB_INTEGRATION === "true";

test("durable job real PostgreSQL path claims, publishes and finalizes", { skip: !integrationEnabled }, async (t) => {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const runtimeUrl = process.env.DATABASE_URL ?? process.env.RUNTIME_DATABASE_URL;

  assert.ok(adminUrl, "DATABASE_ADMIN_URL must be configured when RUN_DB_INTEGRATION=true");
  assert.ok(runtimeUrl, "DATABASE_URL or RUNTIME_DATABASE_URL must be configured when RUN_DB_INTEGRATION=true");

  const admin = new Pool({ connectionString: adminUrl });
  const runtime = new Pool({ connectionString: runtimeUrl });
  const tenantId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const requests: Array<{ idempotencyKey: string | null; body: string }> = [];

  t.after(async () => {
    await admin.query("delete from durable_jobs where id = $1", [jobId]);
    await admin.query("delete from tenants where id = $1", [tenantId]);
    await runtime.end();
    await admin.end();
  });

  await admin.query(
    "insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')",
    [tenantId, "Durable Jobs Integration", `durable-jobs-${tenantId}`],
  );
  await admin.query(
    `insert into durable_jobs (id, tenant_id, job_type, payload, status, attempts, max_attempts)
     values ($1, $2, 'external.webhook', $3::jsonb, 'pending', 0, 3)`,
    [
      jobId,
      tenantId,
      JSON.stringify({
        aggregateType: "integration",
        aggregateId: tenantId,
        eventType: "durable_job.integration",
        payload: { probe: true },
      }),
    ],
  );

  const publisher = new WebhookPublisher(["https://receiver.example.test/webhook"], {
    secret: "integration-test-secret",
    fetchImpl: async (_url, init) => {
      requests.push({
        idempotencyKey: init?.headers instanceof Headers
          ? init.headers.get("idempotency-key")
          : Array.isArray(init?.headers)
            ? init.headers.find(([key]) => key.toLowerCase() === "idempotency-key")?.[1] ?? null
            : init?.headers
              ? String((init.headers as Record<string, string>)["idempotency-key"] ?? null)
              : null,
        body: String(init?.body ?? ""),
      });
      return new Response(null, { status: 204 });
    },
  });

  const store = new PgDurableJobStore(runtime);
  const job = (await store.claimPending(tenantId, 1))[0];
  assert.ok(job);
  assert.equal(job.id, jobId);
  assert.equal(job.status, "running");
  assert.equal(job.attempts, 1);
  assert.ok(job.leaseToken);

  const handler = createDurableWebhookHandler(publisher);
  await handler(job);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.idempotencyKey, jobId);
  assert.match(requests[0]?.body ?? "", new RegExp(jobId));

  const completed = await store.complete(tenantId, job.id, job.leaseToken!);
  assert.equal(completed.status, "completed");
  assert.equal(completed.leaseToken, null);

  const persisted = await admin.query(
    "select status, attempts, lease_token, completed_at from durable_jobs where id = $1",
    [jobId],
  );
  assert.equal(persisted.rows[0]?.status, "completed");
  assert.equal(Number(persisted.rows[0]?.attempts), 1);
  assert.equal(persisted.rows[0]?.lease_token, null);
  assert.ok(persisted.rows[0]?.completed_at);
});
