-- Extend the canonical tenant IAM baseline with compliance permissions.
-- Keep the routine executor-compatible and preserve tenant-scoped role assignment.

insert into roles (tenant_id, name, description)
select t.id, r.name, r.description
from tenants t
cross join (values
  ('admin', 'Full tenant administration'),
  ('operator', 'Operational freight, trip and compliance execution')
) as r(name, description)
on conflict (tenant_id, name) do update
set description = excluded.description;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'admin'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'operator'
  and p.code in (
    'freight:read', 'freight:create', 'freight:update',
    'driver:read', 'driver:create', 'driver:update',
    'vehicle:read', 'vehicle:create', 'vehicle:update',
    'carrier:read', 'carrier:create', 'carrier:update',
    'matching:read', 'matching:assign',
    'trip:read', 'trip:create', 'trip:update',
    'compliance:read', 'compliance:create', 'compliance:update'
  )
on conflict do nothing;

update tenant_memberships tm
set role_id = r.id
from roles r
where r.tenant_id = tm.tenant_id
  and r.name = tm.role
  and tm.role_id is distinct from r.id;
