create table if not exists outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outbox_events_pending_idx
  on outbox_events (tenant_id, status, available_at, created_at);

create index if not exists outbox_events_aggregate_idx
  on outbox_events (tenant_id, aggregate_type, aggregate_id, created_at);

create or replace function public.touch_outbox_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger outbox_events_updated_at
before update on outbox_events
for each row execute function public.touch_outbox_events_updated_at();

alter table outbox_events enable row level security;
alter table outbox_events force row level security;

drop policy if exists outbox_events_tenant_isolation on outbox_events;
create policy outbox_events_tenant_isolation on outbox_events
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));
