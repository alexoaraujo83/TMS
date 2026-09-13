insert into permissions (code, description) values
  ('compliance:read', 'Read compliance and risk management records'),
  ('compliance:create', 'Create compliance and risk management records'),
  ('compliance:update', 'Update compliance and risk management records')
on conflict (code) do nothing;

create table if not exists compliance_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  freight_id uuid not null,
  assignment_id uuid,
  check_type text not null,
  status text not null default 'pending',
  provider text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_checks_status_check
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  constraint compliance_checks_timestamps_check
    check (
      (status = 'pending' and checked_at is null)
      or (status in ('approved', 'rejected', 'expired') and checked_at is not null)
    ),
  unique (tenant_id, id)
);

create table if not exists gr_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  freight_id uuid not null,
  assignment_id uuid,
  status text not null default 'pending',
  provider text,
  protocol text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gr_requests_status_check
    check (status in ('pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled')),
  constraint gr_requests_timestamps_check
    check (
      (status = 'pending' and submitted_at is null and approved_at is null and rejected_at is null)
      or (status = 'submitted' and submitted_at is not null and approved_at is null and rejected_at is null)
      or (status = 'approved' and submitted_at is not null and approved_at is not null and rejected_at is null)
      or (status = 'rejected' and submitted_at is not null and approved_at is null and rejected_at is not null)
      or (status in ('expired', 'cancelled') and rejected_at is null)
    ),
  unique (tenant_id, id)
);

-- Replace legacy constraint names safely before installing the canonical
-- tenant-scoped composite foreign keys.
alter table compliance_checks
  drop constraint if exists compliance_checks_freight_fk;
alter table compliance_checks
  drop constraint if exists compliance_checks_assignment_fk;
alter table gr_requests
  drop constraint if exists gr_requests_freight_fk;
alter table gr_requests
  drop constraint if exists gr_requests_assignment_fk;

alter table compliance_checks
  add constraint compliance_checks_freight_fk
  foreign key (tenant_id, freight_id)
  references freights (tenant_id, id)
  on delete cascade;

alter table compliance_checks
  add constraint compliance_checks_assignment_fk
  foreign key (tenant_id, assignment_id)
  references freight_assignments (tenant_id, id)
  on delete set null;

alter table gr_requests
  add constraint gr_requests_freight_fk
  foreign key (tenant_id, freight_id)
  references freights (tenant_id, id)
  on delete cascade;

alter table gr_requests
  add constraint gr_requests_assignment_fk
  foreign key (tenant_id, assignment_id)
  references freight_assignments (tenant_id, id)
  on delete set null;

create index if not exists compliance_checks_tenant_status_idx
  on compliance_checks (tenant_id, status, created_at desc);
create index if not exists compliance_checks_freight_idx
  on compliance_checks (tenant_id, freight_id, created_at desc);
create index if not exists gr_requests_tenant_status_idx
  on gr_requests (tenant_id, status, created_at desc);
create index if not exists gr_requests_freight_idx
  on gr_requests (tenant_id, freight_id, created_at desc);

drop trigger if exists compliance_checks_set_updated_at on compliance_checks;
create trigger compliance_checks_set_updated_at
before update on compliance_checks
for each row execute function public.set_updated_at();

drop trigger if exists gr_requests_set_updated_at on gr_requests;
create trigger gr_requests_set_updated_at
before update on gr_requests
for each row execute function public.set_updated_at();

alter table compliance_checks enable row level security;
alter table compliance_checks force row level security;
drop policy if exists compliance_checks_tenant_isolation on compliance_checks;
create policy compliance_checks_tenant_isolation on compliance_checks
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));

alter table gr_requests enable row level security;
alter table gr_requests force row level security;
drop policy if exists gr_requests_tenant_isolation on gr_requests;
create policy gr_requests_tenant_isolation on gr_requests
  using (tenant_id::text = current_setting('app.tenant_id', true))
  with check (tenant_id::text = current_setting('app.tenant_id', true));

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.code in ('compliance:read', 'compliance:create', 'compliance:update')
where r.name in ('admin', 'operator')
on conflict do nothing;
