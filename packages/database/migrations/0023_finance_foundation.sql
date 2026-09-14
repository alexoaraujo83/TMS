insert into permissions (code, description) values
  ('finance:read', 'Read financial records'),
  ('finance:create', 'Create financial records'),
  ('finance:update', 'Update financial records')
on conflict (code) do nothing;

create table financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  freight_id uuid not null,
  assignment_id uuid,
  trip_id uuid,
  direction text not null check (direction in ('receivable', 'payable')),
  entry_type text not null check (entry_type in ('freight', 'carrier', 'driver', 'fee', 'commission', 'adjustment')),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'BRL' check (currency = upper(currency) and length(currency) = 3),
  status text not null default 'pending' check (status in ('pending', 'settled', 'cancelled')),
  due_at timestamptz,
  settled_at timestamptz,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check ((status = 'settled') = (settled_at is not null)),
  foreign key (tenant_id, freight_id) references freights(tenant_id, id) on delete cascade,
  foreign key (tenant_id, assignment_id) references freight_assignments(tenant_id, id) on delete set null,
  foreign key (tenant_id, trip_id) references trips(tenant_id, id) on delete set null
);

create index financial_entries_tenant_status_idx on financial_entries (tenant_id, status, due_at, created_at desc);
create index financial_entries_freight_idx on financial_entries (tenant_id, freight_id, created_at desc);
create unique index financial_entries_external_reference_uidx on financial_entries (tenant_id, external_reference) where external_reference is not null;

create trigger financial_entries_set_updated_at
before update on financial_entries
for each row execute function public.set_updated_at();

alter table financial_entries enable row level security;
alter table financial_entries force row level security;
create policy financial_entries_tenant_isolation on financial_entries
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));
