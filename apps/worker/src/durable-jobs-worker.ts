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

export interface DurableJobProcessorOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  now?: () => number;
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

  constructor(
    private readonly store: DurableJobStore,
    private readonly handlers: ReadonlyMap<string, DurableJobHandler>,
    options: DurableJobProcessorOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 300000;
  }

  async process(
    tenantId: string,
    limit = 50,
  ): Promise<DurableJobProcessResult> {
    const jobs = await this.store.claimPending(tenantId, limit);
    let completed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        const handler = this.handlers.get(job.jobType);
        if (!handler) {
          throw new Error(`DURABLE_JOB_HANDLER_NOT_FOUND:${job.jobType}`);
        }
        await handler(job);
        await this.store.complete(tenantId, job.id, this.requireLease(job));
        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryAt = new Date(
          this.now() +
            retryDelayMs(job.attempts, this.baseDelayMs, this.maxDelayMs),
        );

        try {
          await this.store.fail(
            tenantId,
            job.id,
            this.requireLease(job),
            message.slice(0, 4000),
            retryAt,
          );
          failed += 1;
        } catch (finalizationError) {
          console.error(
            JSON.stringify({
              event: "durable_job.finalization_error",
              jobId: job.id,
              jobType: job.jobType,
              tenantId,
              error:
                finalizationError instanceof Error
                  ? finalizationError.message
                  : String(finalizationError),
            }),
          );
        }
      }
    }

    return { claimed: jobs.length, completed, failed };
  }

  private requireLease(job: DurableJob): string {
    if (!job.leaseToken) {
      throw new Error("DURABLE_JOB_LEASE_REQUIRED");
    }
    return job.leaseToken;
  }
}
