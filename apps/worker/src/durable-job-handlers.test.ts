import assert from "node:assert/strict";
import test from "node:test";
import type { DurableJob } from "./durable-jobs-worker.js";
import { createDurableWebhookHandler } from "./durable-job-handlers.js";

function job(overrides: Partial<DurableJob> = {}): DurableJob {
  return {
    id: "job-123", tenantId: "tenant-123", jobType: "external.webhook",
    payload: { aggregateType: "freight", aggregateId: "freight-123", eventType: "freight.created", payload: { reference: "ABC-123" } },
    status: "running", attempts: 1, maxAttempts: 5, availableAt: new Date(), leaseToken: "lease-123",
    lastError: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
}

test("uses durable job id as the external idempotency key", async () => {
  const published: Array<Record<string, unknown>> = [];
  const publisher = { publish: async (event: Record<string, unknown>) => { published.push(event); } };
  await createDurableWebhookHandler(publisher as never)(job());
  assert.equal(published[0]?.id, "job-123");
  assert.equal(published[0]?.tenantId, "tenant-123");
});

test("rejects malformed durable webhook payloads", async () => {
  const handler = createDurableWebhookHandler({ publish: async () => undefined } as never);
  await assert.rejects(handler(job({ payload: { eventType: "freight.created", payload: {} } })), /DURABLE_WEBHOOK_AGGREGATE_TYPE_REQUIRED/);
  await assert.rejects(handler(job({ payload: { aggregateType: "freight", payload: {} } })), /DURABLE_WEBHOOK_EVENT_TYPE_REQUIRED/);
});
