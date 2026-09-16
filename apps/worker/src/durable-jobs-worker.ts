export interface DurableJob {
  id: string;
  tenantId: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  leaseToken: string | null;
  lastError: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DurableJobHandler = (job: DurableJob) => Promise<void>;

export interface DurableJobStore {
  claimPending(tenantId: string, limit: number): Promise<DurableJob[]>;
  renewLease(
    tenantId: string,
    id: string,
    leaseToken: string,
    leaseMs?: number,
  ): Promise<DurableJob>;
  complete(
    tenantId: string,
    id: string,
    leaseToken: string,
  ): Promise<DurableJob>;
  fail(
    tenantId: string,
    id: string,
    leaseToken: string,
    error: string,
    retryAt: Date,
  ): Promise<DurableJob>;
}

export interface DurableJobTelemetryEvent {
  event:
    | "durable_job.started"
    | "durable_job.lease_renewed"
    | "durable_job.lease_lost"
    | "durable_job.completed"
    | "durable_job.retry_scheduled"
    | "durable_job.terminal_failed"
    | "durable_job.finalization_error"
    | "durable_job.batch_completed";
  tenantId: string;
  jobId?: string;
  jobType?: string;
  attempt?: number;
  maxAttempts?: number;
  durationMs?: number;
  retryAt?: string;
  error?: string;
  claimed?: number;
  completed?: number;
  failed?: number;
}

export interface DurableJobProcessorOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  leaseMs?: number;
  heartbeatMs?: number;
  now?: () => number;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  onTelemetry?: (event: DurableJobTelemetryEvent) => void;
}

export interface DurableJobProcessResult {
  claimed: number;
  completed: number;
  failed: number;
}

export function retryDelayMs(
  attempts: number,
  baseDelayMs = 1000,
  maxDelayMs = 300000,
): number {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempts - 1));
}

export class DurableJobProcessor {
  private readonly now: () => number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly leaseMs: number;
  private readonly heartbeatMs: number;
  private readonly setIntervalFn: typeof setInterval;
  private readonly clearIntervalFn: typeof clearInterval;
  private readonly onTelemetry: (event: DurableJobTelemetryEvent) => void;

  constructor(
    private readonly store: DurableJobStore,
    private readonly handlers: ReadonlyMap<string, DurableJobHandler>,
    options: DurableJobProcessorOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 300000;
    this.leaseMs = options.leaseMs ?? 300000;
    this.heartbeatMs = options.heartbeatMs ?? Math.max(1000, Math.floor(this.leaseMs / 3));
    this.setIntervalFn = options.setInterval ?? setInterval;
    this.clearIntervalFn = options.clearInterval ?? clearInterval;
    this.onTelemetry = options.onTelemetry ?? (() => undefined);

    if (this.leaseMs <= 0) throw new Error("DURABLE_JOB_LEASE_INVALID");
    if (this.heartbeatMs <= 0 || this.heartbeatMs >= this.leaseMs) {
      throw new Error("DURABLE_JOB_HEARTBEAT_INVALID");
    }
  }

  async process(
    tenantId: string,
    limit = 50,
  ): Promise<DurableJobProcessResult> {
    const batchStartedAt = this.now();
    const jobs = await this.store.claimPending(tenantId, limit);
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      const jobStartedAt = this.now();
      this.emitTelemetry({
        event: "durable_job.started",
        tenantId,
        jobId: job.id,
        jobType: job.jobType,
        attempt: job.attempts,
        maxAttempts: job.maxAttempts,
      });

      try {
        const handler = this.handlers.get(job.jobType);
        if (!handler) {
          throw new Error(`DURABLE_JOB_HANDLER_NOT_FOUND:${job.jobType}`);
        }

        await this.runWithLeaseHeartbeat(job, handler);
        await this.store.complete(tenantId, job.id, this.requireLease(job));
        completed += 1;
        this.emitTelemetry({
          event: "durable_job.completed",
          tenantId,
          jobId: job.id,
          jobType: job.jobType,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          durationMs: this.now() - jobStartedAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (message === "DURABLE_JOB_LEASE_LOST") {
          this.emitTelemetry({
            event: "durable_job.lease_lost",
            tenantId,
            jobId: job.id,
            jobType: job.jobType,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            durationMs: this.now() - jobStartedAt,
            error: message,
          });
          continue;
        }

        const retryAt = new Date(
          this.now() +
            retryDelayMs(job.attempts, this.baseDelayMs, this.maxDelayMs),
        );

        try {
          const failedJob = await this.store.fail(
            tenantId,
            job.id,
            this.requireLease(job),
            message.slice(0, 4000),
            retryAt,
          );
          failed += 1;
          const terminal = failedJob.status === "failed";
          this.emitTelemetry({
            event: terminal
              ? "durable_job.terminal_failed"
              : "durable_job.retry_scheduled",
            tenantId,
            jobId: job.id,
            jobType: job.jobType,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            durationMs: this.now() - jobStartedAt,
            retryAt: terminal ? undefined : retryAt.toISOString(),
            error: message.slice(0, 4000),
          });
        } catch (finalizationError) {
          this.emitTelemetry({
            event: "durable_job.finalization_error",
            tenantId,
            jobId: job.id,
            jobType: job.jobType,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            durationMs: this.now() - jobStartedAt,
            error:
              finalizationError instanceof Error
                ? finalizationError.message.slice(0, 4000)
                : String(finalizationError).slice(0, 4000),
          });
        }
      }
    }

    const result = { claimed: jobs.length, completed, failed };
    this.emitTelemetry({
      event: "durable_job.batch_completed",
      tenantId,
      durationMs: this.now() - batchStartedAt,
      ...result,
    });
    return result;
  }

  private async runWithLeaseHeartbeat(
    job: DurableJob,
    handler: DurableJobHandler,
  ): Promise<void> {
    const leaseToken = this.requireLease(job);
    let leaseError: Error | null = null;

    const heartbeat = async (): Promise<void> => {
      if (leaseError) return;
      try {
        await this.store.renewLease(
          job.tenantId,
          job.id,
          leaseToken,
          this.leaseMs,
        );
        this.emitTelemetry({
          event: "durable_job.lease_renewed",
          tenantId: job.tenantId,
          jobId: job.id,
          jobType: job.jobType,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
        });
      } catch (error) {
        leaseError =
          error instanceof Error
            ? error
            : new Error(String(error));
      }
    };

    const timer = this.setIntervalFn(() => {
      void heartbeat();
    }, this.heartbeatMs);

    try {
      await handler(job);
      if (leaseError) throw new Error("DURABLE_JOB_LEASE_LOST");
    } finally {
      this.clearIntervalFn(timer);
    }
  }

  private emitTelemetry(event: DurableJobTelemetryEvent): void {
    try {
      this.onTelemetry(event);
    } catch {
      // Telemetry must never break job processing.
    }
  }

  private requireLease(job: DurableJob): string {
    if (!job.leaseToken) {
      throw new Error("DURABLE_JOB_LEASE_REQUIRED");
    }
    return job.leaseToken;
  }
}
