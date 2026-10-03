-- Project Control Center v1
-- Tenant-scoped project governance model for modules, stages, evidence and blockers.
-- Progress is derived from stage state; no manual percentage is stored.

insert into permissions (code, description)
values
  ('project:read', 'Read TMS Project Control Center'),
  ('project:manage', 'Manage TMS Project Control Center')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'admin'
  and p.code in ('project:read', 'project:manage')
on conflict do nothing;

create table if not exists project_control_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module_key text not null,
  name text not null,
  description text,
  status text not null default 'planned'
    check (status in ('planned','in_progress','blocked','completed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_key)
);

create table if not exists project_control_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module_id uuid not null,
  stage_key text not null,
  name text not null,
  phase text not null
    check (phase in ('discover','analyze','classify','correct','test','evidence','next')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','blocked','completed')),
  weight integer not null default 1 check (weight > 0),
  evidence_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_id, stage_key),
  foreign key (tenant_id, module_id)
    references project_control_modules(tenant_id, id)
    on delete cascade
);

create table if not exists project_control_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module_id uuid,
  stage_id uuid,
  evidence_code text not null,
  title text not null,
  kind text not null default 'runtime',
  status text not null default 'pending'
    check (status in ('pending','valid','invalid','expired')),
  source text,
  reference text,
  captured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, module_id)
    references project_control_modules(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, stage_id)
    references project_control_stages(tenant_id, id)
    on delete set null,
  unique (tenant_id, evidence_code)
);

create table if not exists project_control_blockers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  module_id uuid,
  stage_id uuid,
  blocker_code text not null,
  title text not null,
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','investigating','fixing','testing','resolved')),
  description text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (tenant_id, module_id)
    references project_control_modules(tenant_id, id)
    on delete cascade,
  foreign key (tenant_id, stage_id)
    references project_control_stages(tenant_id, id)
    on delete set null,
  unique (tenant_id, blocker_code)
);

create index if not exists project_control_modules_tenant_order_idx
  on project_control_modules (tenant_id, sort_order);

create index if not exists project_control_stages_tenant_module_idx
  on project_control_stages (tenant_id, module_id, phase);

create index if not exists project_control_evidence_tenant_status_idx
  on project_control_evidence (tenant_id, status, captured_at desc);

create index if not exists project_control_blockers_tenant_status_idx
  on project_control_blockers (tenant_id, status, severity);

alter table project_control_modules enable row level security;
alter table project_control_modules force row level security;
alter table project_control_stages enable row level security;
alter table project_control_stages force row level security;
alter table project_control_evidence enable row level security;
alter table project_control_evidence force row level security;
alter table project_control_blockers enable row level security;
alter table project_control_blockers force row level security;

drop policy if exists project_control_modules_tenant_isolation on project_control_modules;
create policy project_control_modules_tenant_isolation on project_control_modules
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

drop policy if exists project_control_stages_tenant_isolation on project_control_stages;
create policy project_control_stages_tenant_isolation on project_control_stages
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

drop policy if exists project_control_evidence_tenant_isolation on project_control_evidence;
create policy project_control_evidence_tenant_isolation on project_control_evidence
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

drop policy if exists project_control_blockers_tenant_isolation on project_control_blockers;
create policy project_control_blockers_tenant_isolation on project_control_blockers
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);

create or replace function project_control_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_control_modules_updated_at on project_control_modules;
create trigger project_control_modules_updated_at
before update on project_control_modules
for each row execute function project_control_set_updated_at();

drop trigger if exists project_control_stages_updated_at on project_control_stages;
create trigger project_control_stages_updated_at
before update on project_control_stages
for each row execute function project_control_set_updated_at();

drop trigger if exists project_control_blockers_updated_at on project_control_blockers;
create trigger project_control_blockers_updated_at
before update on project_control_blockers
for each row execute function project_control_set_updated_at();

-- Seed the current TMS tenant(s) with the first control-center baseline.
insert into project_control_modules
  (tenant_id, module_key, name, description, status, sort_order)
select
  t.id,
  v.module_key,
  v.name,
  v.description,
  v.status,
  v.sort_order
from tenants t
cross join (
  values
    ('repository','Repository','Canonical GitHub repository and source-of-truth baseline','completed',10),
    ('monorepo','Monorepo','Workspace, apps and shared packages','completed',20),
    ('web','Web','Next.js web application and production surface','in_progress',30),
    ('api','API','NestJS API, authorization and runtime contracts','in_progress',40),
    ('auth0','Auth0','Identity, claims, application and runtime validation','in_progress',50),
    ('tenancy','Tenancy & RLS','TenantContext, membership, RBAC and PostgreSQL isolation','in_progress',60),
    ('worker','Worker & Outbox','Outbox, durable jobs, worker and event processing','blocked',70),
    ('observability','Observability & Audit','Structured logs, audit trail and telemetry','in_progress',80),
    ('backup','Backup / DR','Backup, restore and disaster-recovery controls','in_progress',90),
    ('cicd','CI/CD','Build, tests, deployment and environment reconciliation','in_progress',100)
) as v(module_key,name,description,status,sort_order)
on conflict (tenant_id, module_key) do update
set name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    sort_order = excluded.sort_order;

insert into project_control_stages
  (tenant_id, module_id, stage_key, name, phase, status, weight, evidence_required)
select
  m.tenant_id,
  m.id,
  p.stage_key,
  p.name,
  p.phase,
  case
    when m.status = 'completed' then 'completed'
    when m.status = 'blocked' and p.sort_order <= 3 then 'completed'
    when m.status = 'blocked' then 'blocked'
    when m.status = 'in_progress' and p.sort_order <= 4 then 'completed'
    when m.status = 'in_progress' and p.sort_order = 5 then 'in_progress'
    else 'pending'
  end,
  1,
  p.sort_order >= 5
from project_control_modules m
cross join (
  values
    (1,'discover','Discover','discover'),
    (2,'analyze','Analyze','analyze'),
    (3,'classify','Classify','classify'),
    (4,'correct','Correct','correct'),
    (5,'test','Test','test'),
    (6,'evidence','Evidence','evidence'),
    (7,'next','Next','next')
) as p(sort_order,stage_key,name,phase)
on conflict (tenant_id, module_id, stage_key) do update
set name = excluded.name,
    phase = excluded.phase,
    status = excluded.status,
    weight = excluded.weight,
    evidence_required = excluded.evidence_required;

insert into project_control_evidence
  (tenant_id, module_id, evidence_code, title, kind, status, source, reference, captured_at, metadata)
select
  m.tenant_id,
  m.id,
  v.evidence_code,
  v.title,
  v.kind,
  v.status,
  v.source,
  v.reference,
  now(),
  v.metadata::jsonb
from project_control_modules m
cross join (
  values
    ('EVID-REPO-001','Canonical repository baseline','repository','valid','GitHub','alexoaraujo83/TMS@main','{"environment":"source-control"}'),
    ('EVID-API-001','Production API health endpoint','runtime','valid','Vercel','GET /health','{"environment":"production"}')
) as v(evidence_code,title,kind,status,source,reference,metadata)
where m.module_key = case when v.evidence_code like 'EVID-REPO-%' then 'repository' else 'api' end
on conflict (tenant_id, evidence_code) do nothing;

insert into project_control_blockers
  (tenant_id, module_id, blocker_code, title, severity, status, description, next_action)
select
  m.tenant_id,
  m.id,
  'BLK-WORKER-01',
  'Prova E4 do fluxo outbox → durable jobs → handler ainda pendente',
  'critical',
  'open',
  'A cadeia fonte-controlada existe, mas a evidência de um evento real de produção percorrendo o fluxo completo ainda precisa ser reconciliada com runtime.',
  'Executar evento real freight.status_changed e registrar event_id/idempotency_key do outbox ao handler, audit e telemetry.'
from project_control_modules m
where m.module_key = 'worker'
on conflict (tenant_id, blocker_code) do update
set title = excluded.title,
    severity = excluded.severity,
    status = excluded.status,
    description = excluded.description,
    next_action = excluded.next_action;
