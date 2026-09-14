create table if not exists durable_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  lease_token uuid,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists durable_jobs_pending_idx
  on durable_jobs (tenant_id, status, available_at, created_at)
  where status = 'pending';

create index if not exists durable_jobs_lease_idx
  on durable_jobs (tenant_id, status, available_at)
  where status = 'running';

alter table durable_jobs enable row level security;
alter table durable_jobs force row level security;

drop policy if exists durable_jobs_tenant_isolation on durable_jobs;
create policy durable_jobs_tenant_isolation on durable_jobs
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

create trigger durable_jobs_updated_at
before update on durable_jobs
for each row execute function set_updated_at();
