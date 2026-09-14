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
  complete(tenantId: string, id: string, leaseToken: string): Promise<DurableJob>;
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
  now?: () => number;
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
  return Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** Math.max(0, attempts - 1),
  );
}

export class DurableJobProcessor {
  private readonly now: () => number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly onTelemetry: (
    event: DurableJobTelemetryEvent,
  ) => void;

  constructor(
    private readonly store: DurableJobStore,
    private readonly handlers: ReadonlyMap<string, DurableJobHandler>,
    options: DurableJobProcessorOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 300000;
    this.onTelemetry = options.onTelemetry ?? (() => undefined);
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
        await handler(job);
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
