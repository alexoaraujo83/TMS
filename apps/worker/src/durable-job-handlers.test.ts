import assert from "node:assert/strict";
import test from "node:test";
import type { DurableJob } from "./durable-jobs-worker.js";
import { createDurableWebhookHandler } from "./durable-job-handlers.js";

function job(overrides: Partial<DurableJob> = {}): DurableJob {
  return {
    id: "job-123",
    tenantId: "tenant-123",
    jobType: "external.webhook",
    payload: {
      aggregateType: "freight",
      aggregateId: "freight-123",
      eventType: "freight.created",
      payload: { reference: "ABC-123" },
    },
    status: "running",
    attempts: 1,
    maxAttempts: 5,
    availableAt: new Date(),
    leaseToken: "lease-123",
    lastError: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("uses durable job id as the external idempotency key", async () => {
  const published: Array<Record<string, unknown>> = [];
  const publisher = {
    publish: async (event: Record<string, unknown>) => {
      published.push(event);
    },
  };

  await createDurableWebhookHandler(publisher as never)(job());

  assert.deepEqual(published, [
    {
      id: "job-123",
      tenantId: "tenant-123",
      aggregateType: "freight",
      aggregateId: "freight-123",
      eventType: "freight.created",
      payload: { reference: "ABC-123" },
    },
  ]);
});

test("rejects malformed durable webhook payloads", async () => {
  const publisher = { publish: async () => undefined };
  const handler = createDurableWebhookHandler(publisher as never);

  await assert.rejects(
    handler(job({ payload: { eventType: "freight.created", payload: {} } })),
    /DURABLE_WEBHOOK_AGGREGATE_TYPE_REQUIRED/,
  );
  await assert.rejects(
    handler(job({ payload: { aggregateType: "freight", payload: {} } })),
    /DURABLE_WEBHOOK_EVENT_TYPE_REQUIRED/,
  );
  await assert.rejects(
    handler(
      job({
        payload: {
          aggregateType: "freight",
          eventType: "freight.created",
          aggregateId: 123,
          payload: {},
        },
      }),
    ),
    /DURABLE_WEBHOOK_AGGREGATE_ID_INVALID/,
  );
  await assert.rejects(
    handler(
      job({
        payload: {
          aggregateType: "freight",
          eventType: "freight.created",
          payload: undefined,
        },
      }),
    ),
    /DURABLE_WEBHOOK_PAYLOAD_REQUIRED/,
  );
});
