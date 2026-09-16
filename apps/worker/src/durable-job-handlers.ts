import type { DurableJob } from "./durable-jobs-worker.js";
import { WebhookPublisher } from "./webhook-publisher.js";

export interface DurableWebhookJobPayload {
  aggregateType: string;
  aggregateId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
}

export function createDurableWebhookHandler(
  publisher: WebhookPublisher,
): (job: DurableJob) => Promise<void> {
  return async (job) => {
    const payload = job.payload as Partial<DurableWebhookJobPayload>;
    if (typeof payload.aggregateType !== "string" || !payload.aggregateType) {
      throw new Error("DURABLE_WEBHOOK_AGGREGATE_TYPE_REQUIRED");
    }
    if (typeof payload.eventType !== "string" || !payload.eventType) {
      throw new Error("DURABLE_WEBHOOK_EVENT_TYPE_REQUIRED");
    }
    if (
      payload.aggregateId !== null &&
      payload.aggregateId !== undefined &&
      typeof payload.aggregateId !== "string"
    ) {
      throw new Error("DURABLE_WEBHOOK_AGGREGATE_ID_INVALID");
    }
    if (!payload.payload || typeof payload.payload !== "object") {
      throw new Error("DURABLE_WEBHOOK_PAYLOAD_REQUIRED");
    }

    await publisher.publish({
      id: job.id,
      tenantId: job.tenantId,
      aggregateType: payload.aggregateType,
      aggregateId: payload.aggregateId ?? null,
      eventType: payload.eventType,
      payload: payload.payload,
    });
  };
}
