create table trip_occurrences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  trip_id uuid not null,
  type text not null check (type in ('delay', 'accident', 'breakdown', 'cargo_damage', 'refusal', 'address_issue', 'other')),
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  description text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, trip_id) references trips(tenant_id, id) on delete cascade
);

create index trip_occurrences_tenant_trip_idx on trip_occurrences (tenant_id, trip_id, occurred_at desc);
create index trip_occurrences_tenant_type_idx on trip_occurrences (tenant_id, type, occurred_at desc);

alter table trip_occurrences enable row level security;
alter table trip_occurrences force row level security;
create policy trip_occurrences_tenant_isolation on trip_occurrences
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));
create trigger trip_occurrences_set_updated_at
before update on trip_occurrences
for each row execute function public.set_updated_at();

create table trip_pods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  trip_id uuid not null,
  recipient_name text not null,
  received_at timestamptz not null,
  document_ref text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, trip_id),
  foreign key (tenant_id, trip_id) references trips(tenant_id, id) on delete cascade
);

create index trip_pods_tenant_trip_idx on trip_pods (tenant_id, trip_id);

alter table trip_pods enable row level security;
alter table trip_pods force row level security;
create policy trip_pods_tenant_isolation on trip_pods
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));
create trigger trip_pods_set_updated_at
before update on trip_pods
for each row execute function public.set_updated_at();
