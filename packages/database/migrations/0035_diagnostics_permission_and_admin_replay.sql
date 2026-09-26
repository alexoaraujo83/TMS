-- Isolate operational diagnostics from business freight-read access.
-- Keep manual replay and diagnostics available to tenant admins while
-- preventing the default operator role from receiving either permission.

insert into permissions (code, description)
values ('ops:diagnostics', 'Read authenticated runtime diagnostics')
on conflict (code) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'admin'
  and p.code in ('freight:replay', 'ops:diagnostics')
on conflict do nothing;
