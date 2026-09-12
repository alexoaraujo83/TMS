-- Matching assignments must enforce tenant ownership at the FK boundary.
-- PostgreSQL requires the referenced composite keys to be backed by a
-- primary key or unique constraint/index. The base tables use id as their
-- primary key, so add tenant-scoped unique indexes before declaring the FKs.
create unique index if not exists uq_freights_tenant_id on freights (tenant_id, id);
create unique index if not exists uq_vehicles_tenant_id on vehicles (tenant_id, id);
create unique index if not exists uq_drivers_tenant_id on drivers (tenant_id, id);

create table if not exists freight_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  freight_id uuid not null,
  driver_id uuid not null,
  vehicle_id uuid not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, freight_id) references freights(tenant_id, id),
  foreign key (tenant_id, driver_id) references drivers(tenant_id, id),
  foreign key (tenant_id, vehicle_id) references vehicles(tenant_id, id),
  unique (tenant_id, id),
  check ((status = 'active' and completed_at is null and cancelled_at is null)
      or (status = 'completed' and completed_at is not null and cancelled_at is null)
      or (status = 'cancelled' and cancelled_at is not null and completed_at is null))
);

create unique index if not exists uq_freight_assignments_active_freight
  on freight_assignments (tenant_id, freight_id)
  where status = 'active';

create unique index if not exists uq_freight_assignments_active_driver
  on freight_assignments (tenant_id, driver_id)
  where status = 'active';

create unique index if not exists uq_freight_assignments_active_vehicle
  on freight_assignments (tenant_id, vehicle_id)
  where status = 'active';

create index if not exists idx_freight_assignments_tenant_status
  on freight_assignments (tenant_id, status, assigned_at desc);

alter table freight_assignments enable row level security;
alter table freight_assignments force row level security;

create policy freight_assignments_tenant_isolation on freight_assignments
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));

insert into permissions (code, description) values
  ('matching:read', 'Read freight matching candidates'),
  ('matching:assign', 'Assign a matched driver and vehicle to freight')
on conflict (code) do nothing;
