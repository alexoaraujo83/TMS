create table trips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  freight_id uuid not null,
  assignment_id uuid not null,
  status text not null default 'planned'
    check (status in ('planned', 'in_transit', 'delivered', 'cancelled')),
  started_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, assignment_id),
  foreign key (tenant_id, freight_id)
    references freights(tenant_id, id),
  foreign key (tenant_id, assignment_id)
    references freight_assignments(tenant_id, id),
  check (
    (status = 'planned' and started_at is null and delivered_at is null and cancelled_at is null)
    or (status = 'in_transit' and started_at is not null and delivered_at is null and cancelled_at is null)
    or (status = 'delivered' and started_at is not null and delivered_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and delivered_at is null)
  )
);

create index idx_trips_tenant_status on trips (tenant_id, status);
create index idx_trips_tenant_freight on trips (tenant_id, freight_id);
create index idx_trips_tenant_assignment on trips (tenant_id, assignment_id);

alter table trips enable row level security;
alter table trips force row level security;

create policy trips_tenant_isolation on trips
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));

create trigger trips_set_updated_at
before update on trips
for each row execute function public.set_updated_at();
