import { withTenantContext } from "./tenant-transaction.js";

export type DurableJobStatus = "pending" | "running" | "completed" | "failed";

export interface DurableJobRecord {
  id: string;
  tenantId: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: DurableJobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  leaseToken: string | null;
  lastError: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueDurableJobInput {
  tenantId: string;
  jobType: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
}

export class DurableJobsRepository {
  constructor(private readonly pool: any) {}

  async enqueue(input: EnqueueDurableJobInput): Promise<DurableJobRecord> {
    return withTenantContext(this.pool, input.tenantId, async (client: any) => {
      const result = await client.query(
        `insert into durable_jobs
          (tenant_id, job_type, payload, available_at, max_attempts)
         values ($1, $2, $3, coalesce($4, now()), coalesce($5, 5))
         returning id, tenant_id, job_type, payload, status, attempts, max_attempts,
           available_at, lease_token, last_error, completed_at, created_at, updated_at`,
        [
          input.tenantId,
          input.jobType,
          JSON.stringify(input.payload ?? {}),
          input.availableAt ?? null,
          input.maxAttempts ?? null,
        ],
      );
      return this.map(result.rows[0]);
    });
  }

  async claimPending(
    tenantId: string,
    limit = 50,
  ): Promise<DurableJobRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query(
        `with claimed as (
           select id, gen_random_uuid() as lease_token
           from durable_jobs
           where tenant_id = $1
             and status in ('pending', 'running')
             and available_at <= now()
             and attempts < max_attempts
             and exists (
               select 1
               from public.tenants
               where id = $1
                 and status = 'active'
             )
           order by created_at asc
           for update skip locked
           limit $2
         )
         update durable_jobs as job
         set status = 'running',
             attempts = job.attempts + 1,
             available_at = now() + interval '5 minutes',
             lease_token = claimed.lease_token,
             updated_at = now()
         from claimed
         where job.id = claimed.id
         returning job.id, job.tenant_id, job.job_type, job.payload, job.status,
           job.attempts, job.max_attempts, job.available_at, job.lease_token,
           job.last_error, job.completed_at, job.created_at, job.updated_at`,
        [tenantId, limit],
      );
      await client.query("commit");
      return result.rows.map((row: any) => this.map(row));
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(
    tenantId: string,
    id: string,
    leaseToken: string,
  ): Promise<DurableJobRecord> {
    return withTenantContext(this.pool, tenantId, async (client: any) => {
      const result = await client.query(
        `update durable_jobs
         set status = 'completed', completed_at = now(), last_error = null,
             lease_token = null, updated_at = now()
         where tenant_id = $1 and id = $2 and status = 'running'
           and lease_token = $3
         returning id, tenant_id, job_type, payload, status, attempts, max_attempts,
           available_at, lease_token, last_error, completed_at, created_at, updated_at`,
        [tenantId, id, leaseToken],
      );
      if (!result.rows[0]) throw new Error("DURABLE_JOB_NOT_COMPLETABLE");
      return this.map(result.rows[0]);
    });
  }

  async fail(
    tenantId: string,
    id: string,
    leaseToken: string,
    error: string,
    retryAt = new Date(Date.now() + 30_000),
  ): Promise<DurableJobRecord> {
    return withTenantContext(this.pool, tenantId, async (client: any) => {
      const result = await client.query(
        `update durable_jobs
         set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
             available_at = case when attempts >= max_attempts then available_at else $4 end,
             last_error = $3, lease_token = null, updated_at = now()
         where tenant_id = $1 and id = $2 and status = 'running'
           and lease_token = $5
         returning id, tenant_id, job_type, payload, status, attempts, max_attempts,
           available_at, lease_token, last_error, completed_at, created_at, updated_at`,
        [tenantId, id, error.slice(0, 4000), retryAt, leaseToken],
      );
      if (!result.rows[0]) throw new Error("DURABLE_JOB_NOT_FAILABLE");
      return this.map(result.rows[0]);
    });
  }

  private map(row: any): DurableJobRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      jobType: row.job_type,
      payload: row.payload,
      status: row.status,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      availableAt: row.available_at,
      leaseToken: row.lease_token,
      lastError: row.last_error,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
