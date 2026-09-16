import assert from "node:assert/strict";
import test from "node:test";
import {
  DurableJobProcessor,
  type DurableJob,
  type DurableJobStore,
  type DurableJobTelemetryEvent,
  retryDelayMs,
} from "./durable-jobs-worker.js";

function job(overrides: Partial<DurableJob> = {}): DurableJob {
  return {
    id: crypto.randomUUID(),
    tenantId: "00000000-0000-0000-0000-000000000001",
    jobType: "test.job",
    payload: {},
    status: "running",
    attempts: 1,
    maxAttempts: 5,
    availableAt: new Date(),
    leaseToken: crypto.randomUUID(),
    lastError: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeStore implements DurableJobStore {
  completed: Array<[string, string, string]> = [];
  failed: Array<[string, string, string, string, Date]> = [];
  renewed: Array<[string, string, string, number | undefined]> = [];

  constructor(private readonly jobs: DurableJob[]) {}

  async claimPending(): Promise<DurableJob[]> {
    return this.jobs;
  }

  async renewLease(
    tenantId: string,
    id: string,
    leaseToken: string,
    leaseMs?: number,
  ): Promise<DurableJob> {
    this.renewed.push([tenantId, id, leaseToken, leaseMs]);
    return job({ id, tenantId, leaseToken, status: "running" });
  }

  async complete(
    tenantId: string,
    id: string,
    leaseToken: string,
  ): Promise<DurableJob> {
    this.completed.push([tenantId, id, leaseToken]);
    return job({ id, tenantId, leaseToken, status: "completed" });
  }

  async fail(
    tenantId: string,
    id: string,
    leaseToken: string,
    error: string,
    retryAt: Date,
  ): Promise<DurableJob> {
    this.failed.push([tenantId, id, leaseToken, error, retryAt]);
    const current = this.jobs.find((candidate) => candidate.id === id);
    const terminal = current ? current.attempts >= current.maxAttempts : true;
    return job({
      id,
      tenantId,
      leaseToken,
      status: terminal ? "failed" : "pending",
      attempts: current?.attempts ?? 1,
      maxAttempts: current?.maxAttempts ?? 1,
    });
  }
}

test("retry delay doubles and is capped", () => {
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(2), 2000);
  assert.equal(retryDelayMs(3), 4000);
  assert.equal(retryDelayMs(20), 300000);
});

test("successful jobs complete with their lease token", async () => {
  const first = job();
  const second = job();
  const store = new FakeStore([first, second]);
  const handled: string[] = [];
  const processor = new DurableJobProcessor(
    store,
    new Map([
      [
        "test.job",
        async (current) => {
          handled.push(current.id);
        },
      ],
    ]),
  );

  const result = await processor.process(first.tenantId, 50);

  assert.deepEqual(result, { claimed: 2, completed: 2, failed: 0 });
  assert.deepEqual(handled, [first.id, second.id]);
  assert.deepEqual(store.completed, [
    [first.tenantId, first.id, first.leaseToken!],
    [second.tenantId, second.id, second.leaseToken!],
  ]);
});

test("lease heartbeat renews before finalization", async () => {
  const current = job({ id: "heartbeat" });
  const store = new FakeStore([current]);
  let heartbeat: (() => void) | undefined;
  const processor = new DurableJobProcessor(
    store,
    new Map([
      [
        "test.job",
        async () => {
          heartbeat?.();
          await Promise.resolve();
        },
      ],
    ]),
    {
      leaseMs: 300_000,
      heartbeatMs: 100_000,
      setInterval: (callback) => {
        heartbeat = callback;
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval: () => undefined,
    },
  );

  const result = await processor.process(current.tenantId, 1);

  assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
  assert.deepEqual(store.renewed, [
    [current.tenantId, current.id, current.leaseToken!, 300_000],
  ]);
});

test("heartbeat loss fails closed and never finalizes the job", async () => {
  const current = job({ id: "lease-lost" });
  const events: DurableJobTelemetryEvent[] = [];
  const store = new FakeStore([current]);
  store.renewLease = async () => {
    throw new Error("renewal unavailable");
  };
  let heartbeat: (() => void) | undefined;
  const processor = new DurableJobProcessor(
    store,
    new Map([
      [
        "test.job",
        async () => {
          heartbeat?.();
          await Promise.resolve();
        },
      ],
    ]),
    {
      leaseMs: 300_000,
      heartbeatMs: 100_000,
      setInterval: (callback) => {
        heartbeat = callback;
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval: () => undefined,
      onTelemetry: (event) => events.push(event),
    },
  );

  const result = await processor.process(current.tenantId, 1);

  assert.deepEqual(result, { claimed: 1, completed: 0, failed: 0 });
  assert.equal(store.completed.length, 0);
  assert.equal(store.failed.length, 0);
  assert.equal(
    events.filter((event) => event.event === "durable_job.lease_lost").length,
    1,
  );
});

test("one failing job does not stop the batch", async () => {
  const first = job({ id: "job-fails", maxAttempts: 5 });
  const second = job({ id: "job-succeeds" });
  const store = new FakeStore([first, second]);
  const processor = new DurableJobProcessor(
    store,
    new Map([
      [
        "test.job",
        async (current) => {
          if (current.id === first.id) throw new Error("handler failed");
        },
      ],
    ),
    { now: () => 1_000_000 },
  );

  const result = await processor.process(first.tenantId, 50);

  assert.deepEqual(result, { claimed: 2, completed: 1, failed: 1 });
  assert.equal(store.failed[0]?.[3], "handler failed");
  assert.equal(store.failed[0]?.[4].getTime(), 1_001_000);
  assert.equal(store.completed[0]?.[1], second.id);
});

test("unknown job types are failed and do not abort later jobs", async () => {
  const unknown = job({ id: "unknown", jobType: "missing.job" });
  const known = job({ id: "known" });
  const store = new FakeStore([unknown, known]);
  const processor = new DurableJobProcessor(
    store,
    new Map([["test.job", async () => undefined]]),
  );

  const result = await processor.process(unknown.tenantId, 50);

  assert.deepEqual(result, { claimed: 2, completed: 1, failed: 1 });
  assert.equal(
    store.failed[0]?.[3],
    "DURABLE_JOB_HANDLER_NOT_FOUND:missing.job",
  );
  assert.equal(store.completed[0]?.[1], known.id);
});

test("long non-Error failures are truncated before persistence", async () => {
  const current = job();
  const store = new FakeStore([current]);
  const processor = new DurableJobProcessor(
    store,
    new Map([
      [
        "test.job",
        async () => {
          throw "x".repeat(5000);
        },
      ],
    ]),
  );

  await processor.process(current.tenantId, 50);

  assert.equal(store.failed[0]?.[3].length, 4000);
});

test("empty batches are a no-op", async () => {
  const store = new FakeStore([]);
  const processor = new DurableJobProcessor(store, new Map());

  assert.deepEqual(
    await processor.process("00000000-0000-0000-0000-000000000001"),
    {
      claimed: 0,
      completed: 0,
      failed: 0,
    },
  );
});

test("telemetry reports successful job and batch lifecycle", async () => {
  const current = job({ id: "telemetry-success" });
  const store = new FakeStore([current]);
  const events: DurableJobTelemetryEvent[] = [];
  let clock = 10_000;
  const processor = new DurableJobProcessor(
    store,
    new Map([["test.job", async () => undefined]]),
    {
      now: () => clock++,
      onTelemetry: (event) => events.push(event),
    },
  );

  await processor.process(current.tenantId, 10);

  assert.deepEqual(
    events.map((event) => event.event),
    [
      "durable_job.started",
      "durable_job.completed",
      "durable_job.batch_completed",
    ],
  );
  assert.equal(events[1]?.jobId, current.id);
  assert.equal(events[1]?.jobType, current.jobType);
  assert.equal(events[1]?.attempt, current.attempts);
  assert.equal(events[2]?.claimed, 1);
  assert.equal(events[2]?.completed, 1);
  assert.equal(events[2]?.failed, 0);
});

test("telemetry distinguishes retry from terminal failure", async () => {
  const retryJob = job({ id: "retry", attempts: 1, maxAttempts: 3 });
  const terminalJob = job({ id: "terminal", attempts: 3, maxAttempts: 3 });
  const events: DurableJobTelemetryEvent[] = [];
  const store = new FakeStore([retryJob, terminalJob]);
  const processor = new DurableJobProcessor(
    store,
    new Map([
      [
        "test.job",
        async () => {
          throw new Error("boom");
        },
      ],
    ),
    {
      now: () => 2_000_000,
      onTelemetry: (event) => events.push(event),
    },
  );

  await processor.process(retryJob.tenantId, 10);

  assert.equal(
    events.filter((event) => event.event === "durable_job.retry_scheduled")
      .length,
    1,
  );
  assert.equal(
    events.filter((event) => event.event === "durable_job.terminal_failed")
      .length,
    1,
  );
  const retryEvent = events.find(
    (event) => event.event === "durable_job.retry_scheduled",
  );
  assert.equal(retryEvent?.retryAt, new Date(2_001_000).toISOString());
  assert.equal(retryEvent?.error, "boom");
});

test("telemetry finalization errors are isolated from the processor", async () => {
  const current = job({ id: "finalization-error" });
  const events: DurableJobTelemetryEvent[] = [];
  const store: DurableJobStore = {
    async claimPending() {
      return [current];
    },
    async renewLease() {
      return current;
    },
    async complete() {
      throw new Error("complete failed");
    },
    async fail() {
      throw new Error("fail failed");
    },
  };
  const processor = new DurableJobProcessor(
    store,
    new Map([["test.job", async () => undefined]]),
    {
      onTelemetry: (event) => events.push(event),
    },
  );

  const result = await processor.process(current.tenantId, 10);

  assert.deepEqual(result, { claimed: 1, completed: 0, failed: 0 });
  assert.equal(events.at(-2)?.event, "durable_job.finalization_error");
  assert.equal(events.at(-2)?.error, "fail failed");
  assert.equal(events.at(-1)?.event, "durable_job.batch_completed");
});

test("telemetry failures never break job processing", async () => {
  const current = job({ id: "telemetry-failure" });
  const store = new FakeStore([current]);
  const processor = new DurableJobProcessor(
    store,
    new Map([["test.job", async () => undefined]]),
    {
      onTelemetry: () => {
        throw new Error("telemetry unavailable");
      },
    },
  );

  const result = await processor.process(current.tenantId, 10);

  assert.deepEqual(result, { claimed: 1, completed: 1, failed: 0 });
});
