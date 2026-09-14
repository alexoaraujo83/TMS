import type { Pool } from "pg";
import { withTenantTransaction } from "./tenant-context.js";
import type { DurableJob, DurableJobStore } from "./durable-jobs-worker.js";

export class PgDurableJobStore implements DurableJobStore {
  constructor(private readonly pool: Pool) {}

  async claimPending(tenantId: string, limit: number): Promise<DurableJob[]> {
    return withTenantTransaction(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `with claimed as (
           select id, gen_random_uuid() as lease_token
           from durable_jobs
           where tenant_id = $1
             and status in ('pending', 'running')
             and available_at <= now()
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
         returning id, tenant_id, job_type, payload, status, attempts, max_attempts,
           available_at, lease_token, last_error, completed_at, created_at, updated_at`,
        [tenantId, limit],
      );
      return result.rows.map(mapJob);
    });
  }

  async complete(
    tenantId: string,
    id: string,
    leaseToken: string,
  ): Promise<DurableJob> {
    return this.updateWithLease(
      tenantId,
      id,
      leaseToken,
      `set status = 'completed', completed_at = now(), last_error = null,
           lease_token = null, updated_at = now()`,
      [],
      "DURABLE_JOB_NOT_COMPLETABLE",
    );
  }

  async fail(
    tenantId: string,
    id: string,
    leaseToken: string,
    error: string,
    retryAt: Date,
  ): Promise<DurableJob> {
    return this.updateWithLease(
      tenantId,
      id,
      leaseToken,
      `set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
           available_at = case when attempts >= max_attempts then available_at else $4 end,
           last_error = $3, lease_token = null, updated_at = now()`,
      [error.slice(0, 4000), retryAt],
      "DURABLE_JOB_NOT_FAILABLE",
    );
  }

  private async updateWithLease(
    tenantId: string,
    id: string,
    leaseToken: string,
    setClause: string,
    extraParams: unknown[],
    errorCode: string,
  ): Promise<DurableJob> {
    return withTenantTransaction(this.pool, tenantId, async (client) => {
      const result = await client.query(
        `update durable_jobs
         ${setClause}
         where tenant_id = $1 and id = $2 and status = 'running'
           and lease_token = $${extraParams.length + 3}
         returning id, tenant_id, job_type, payload, status, attempts, max_attempts,
           available_at, lease_token, last_error, completed_at, created_at, updated_at`,
        [tenantId, id, ...extraParams, leaseToken],
      );
      if (!result.rows[0]) throw new Error(errorCode);
      return mapJob(result.rows[0]);
    });
  }
}

function mapJob(row: Record<string, unknown>): DurableJob {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    jobType: String(row.job_type),
    payload: row.payload as Record<string, unknown>,
    status: row.status as DurableJob["status"],
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    availableAt: row.available_at as Date,
    leaseToken: row.lease_token ? String(row.lease_token) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    completedAt: row.completed_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
