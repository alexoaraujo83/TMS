-- Add finance permissions required by the Finance API authorization boundary.
insert into permissions (code, description) values
  ('finance:read', 'Read financial entries'),
  ('finance:create', 'Create financial entries'),
  ('finance:update', 'Settle and update financial entries')
on conflict (code) do nothing;

-- Administrators retain the canonical full-tenant permission set.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'admin'
  and p.code in ('finance:read', 'finance:create', 'finance:update')
on conflict do nothing;

-- Operators may execute the financial workflow exposed by the API.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'operator'
  and p.code in ('finance:read', 'finance:create', 'finance:update')
on conflict do nothing;
