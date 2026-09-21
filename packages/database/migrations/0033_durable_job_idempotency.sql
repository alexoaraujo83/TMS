alter table durable_jobs
  add column if not exists idempotency_key text;

create unique index if not exists durable_jobs_idempotency_idx
  on durable_jobs (tenant_id, job_type, idempotency_key)
  where idempotency_key is not null;
