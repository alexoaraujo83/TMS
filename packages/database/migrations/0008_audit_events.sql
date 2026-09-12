create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_tenant_created_idx
  on audit_events (tenant_id, created_at desc);

create index if not exists audit_events_entity_idx
  on audit_events (tenant_id, entity_type, entity_id, created_at desc);

alter table audit_events enable row level security;
alter table audit_events force row level security;

create policy audit_events_tenant_isolation on audit_events
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));
