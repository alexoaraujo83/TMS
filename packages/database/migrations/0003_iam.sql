create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table tenant_memberships add column if not exists role_id uuid references roles(id) on delete set null;

alter table roles enable row level security;
alter table roles force row level security;
alter table role_permissions enable row level security;
alter table role_permissions force row level security;

create policy roles_tenant_isolation on roles
  using (tenant_id::text = current_setting('app.tenant_id', true));

create policy role_permissions_tenant_isolation on role_permissions
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and r.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );

create index if not exists idx_roles_tenant on roles(tenant_id);
create index if not exists idx_role_permissions_permission on role_permissions(permission_id);
create index if not exists idx_memberships_role on tenant_memberships(role_id);

insert into permissions (code, description) values
  ('freight:read', 'Read freight records'),
  ('freight:create', 'Create freight records'),
  ('freight:update', 'Update freight records'),
  ('freight:delete', 'Delete freight records'),
  ('driver:read', 'Read driver records'),
  ('driver:create', 'Create driver records'),
  ('driver:update', 'Update driver records'),
  ('vehicle:read', 'Read vehicle records'),
  ('vehicle:create', 'Create vehicle records'),
  ('vehicle:update', 'Update vehicle records'),
  ('carrier:read', 'Read carrier records'),
  ('carrier:create', 'Create carrier records'),
  ('carrier:update', 'Update carrier records'),
  ('iam:manage', 'Manage tenant IAM')
 on conflict (code) do nothing;
