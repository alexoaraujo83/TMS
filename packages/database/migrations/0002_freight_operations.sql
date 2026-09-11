create table if not exists carriers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  legal_name text not null,
  document_number text,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, document_number)
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  carrier_id uuid references carriers(id) on delete set null,
  name text not null,
  document_number text,
  phone text,
  rntrc text,
  antt_status text not null default 'pending' check (antt_status in ('pending','approved','rejected','expired')),
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, document_number),
  unique (tenant_id, rntrc)
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  driver_id uuid references drivers(id) on delete set null,
  plate text not null,
  vehicle_type text not null,
  body_type text not null,
  capacity_kg numeric(12,2) not null check (capacity_kg > 0),
  free_meters numeric(6,2),
  status text not null default 'available' check (status in ('available','unavailable','maintenance','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, plate)
);

create table if not exists freights (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','open','matching','negotiating','assigned','in_transit','delivered','cancelled')),
  freight_type text not null check (freight_type in ('dedicated','shared','complement','urgent')),
  origin_city text not null,
  origin_state text not null,
  destination_city text not null,
  destination_state text not null,
  cargo_description text not null,
  quantity integer not null check (quantity > 0),
  weight_kg numeric(14,2) not null check (weight_kg > 0),
  volume_m3 numeric(12,3),
  linear_meters numeric(8,3),
  customer_price_cents bigint,
  driver_price_cents bigint,
  currency text not null default 'BRL' check (currency = 'BRL'),
  collection_window_start timestamptz,
  collection_window_end timestamptz,
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_carriers_tenant_status on carriers(tenant_id, status);
create index if not exists idx_drivers_tenant_status on drivers(tenant_id, status);
create index if not exists idx_drivers_tenant_rntrc on drivers(tenant_id, rntrc);
create index if not exists idx_vehicles_tenant_status on vehicles(tenant_id, status);
create index if not exists idx_freights_tenant_status on freights(tenant_id, status);
create index if not exists idx_freights_route on freights(origin_state, destination_state, status);

alter table carriers enable row level security;
alter table carriers force row level security;
alter table drivers enable row level security;
alter table drivers force row level security;
alter table vehicles enable row level security;
alter table vehicles force row level security;
alter table freights enable row level security;
alter table freights force row level security;

create policy carriers_tenant_isolation on carriers using (tenant_id::text = current_setting('app.tenant_id', true));
create policy drivers_tenant_isolation on drivers using (tenant_id::text = current_setting('app.tenant_id', true));
create policy vehicles_tenant_isolation on vehicles using (tenant_id::text = current_setting('app.tenant_id', true));
create policy freights_tenant_isolation on freights using (tenant_id::text = current_setting('app.tenant_id', true));
