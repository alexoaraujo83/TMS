import assert from "node:assert/strict";
import test from "node:test";
import {
  OutboxProcessor,
  type OutboxEvent,
  type OutboxStore,
  retryDelayMs,
} from "./outbox-worker.js";

function event(id: string, attempts = 1): OutboxEvent {
  return {
    id,
    tenantId: "tenant-1",
    aggregateType: "freight",
    aggregateId: `freight-${id}`,
    eventType: "freight.created",
    payload: { id },
    attempts,
  };
}

class MemoryStore implements OutboxStore {
  readonly published: string[] = [];
  readonly failed: Array<{
    id: string;
    error: string;
    retryAt: Date;
  }> = [];

  constructor(private readonly events: OutboxEvent[]) {}

  async claimPending(_tenantId: string, limit: number): Promise<OutboxEvent[]> {
    return this.events.slice(0, limit);
  }

  async markPublished(_tenantId: string, id: string): Promise<void> {
    this.published.push(id);
  }

  async markFailed(
    _tenantId: string,
    id: string,
    error: string,
    retryAt: Date,
  ): Promise<void> {
    this.failed.push({ id, error, retryAt });
  }
}

test("retryDelayMs uses exponential backoff and caps the delay", () => {
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(2), 2000);
  assert.equal(retryDelayMs(3), 4000);
  assert.equal(retryDelayMs(20), 300000);
});

test("processor publishes every successfully handled event", async () => {
  const store = new MemoryStore([event("1"), event("2")]);
  const handled: string[] = [];
  const processor = new OutboxProcessor(store, async (outboxEvent) => {
    handled.push(outboxEvent.id);
  });

  const result = await processor.process("tenant-1", 50);

  assert.deepEqual(result, { claimed: 2, published: 2, failed: 0 });
  assert.deepEqual(handled, ["1", "2"]);
  assert.deepEqual(store.published, ["1", "2"]);
  assert.equal(store.failed.length, 0);
});

test("processor marks a failed handler for retry and continues the batch", async () => {
  const store = new MemoryStore([event("1", 2), event("2", 1)]);
  const processor = new OutboxProcessor(store, async (outboxEvent) => {
    if (outboxEvent.id === "1") {
      throw new Error("broker unavailable");
    }
  });
  const before = Date.now();

  const result = await processor.process("tenant-1", 50);

  assert.deepEqual(result, { claimed: 2, published: 1, failed: 1 });
  assert.deepEqual(store.published, ["2"]);
  assert.equal(store.failed.length, 1);
  assert.equal(store.failed[0]?.id, "1");
  assert.equal(store.failed[0]?.error, "broker unavailable");
  assert.ok(store.failed[0]?.retryAt.getTime() >= before + 1990);
  assert.ok(store.failed[0]?.retryAt.getTime() <= Date.now() + 2100);
});

test("processor truncates non-Error failure messages before persisting", async () => {
  const store = new MemoryStore([event("1")]);
  const processor = new OutboxProcessor(store, async () => {
    throw "x".repeat(5000);
  });

  const result = await processor.process("tenant-1", 50);

  assert.deepEqual(result, { claimed: 1, published: 0, failed: 1 });
  assert.equal(store.failed[0]?.error.length, 4000);
});

test("processor returns an empty result when no events are claimed", async () => {
  const store = new MemoryStore([]);
  let handled = false;
  const processor = new OutboxProcessor(store, async () => {
    handled = true;
  });

  const result = await processor.process("tenant-1", 50);

  assert.deepEqual(result, { claimed: 0, published: 0, failed: 0 });
  assert.equal(handled, false);
});
