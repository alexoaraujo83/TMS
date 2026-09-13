-- Establish deterministic tenant roles so memberships can resolve effective permissions.
-- Admin receives every permission; operator receives operational freight/master-data,
-- matching, trip and compliance permissions. Existing tenants and memberships are backfilled.

create or replace function public.provision_tenant_iam(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  INSERT INTO roles (tenant_id, name, description)\n  VALUES (p_tenant_id, \x27admin\x27, \x27Full tenant administration\x27)\n  ON CONFLICT (tenant_id, name) DO UPDATE SET description = excluded.description\x3B\n\n  INSERT INTO roles (tenant_id, name, description)\n  VALUES (p_tenant_id, \x27operator\x27, \x27Operational freight and trip execution\x27)\n  ON CONFLICT (tenant_id, name) DO UPDATE SET description = excluded.description\x3B\n\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p\n   WHERE r.tenant_id = p_tenant_id AND r.name = \x27admin\x27\n  ON CONFLICT DO NOTHING\x3B\n\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p\n   WHERE r.tenant_id = p_tenant_id AND r.name = \x27operator\x27\n     AND p.code IN (\x27freight:read\', \x27freight:create\', \x27freight:update\',\n       \x27driver:read\', \x27driver:create\', \x27driver:update\',\n       \x27vehicle:read\', \x27vehicle:create\', \x27vehicle:update\',\n       \x27carrier:read\', \x27carrier:create\', \x27carrier:update\',\n       \x27matching:read\', \x27matching:assign\',\n       \x27trip:read\', \x27trip:create\', \x27trip:update\',\n       \x27compliance:read\', \x27compliance:create\', \x27compliance:update\')\n  ON CONFLICT DO NOTHING\x3B\n  RETURN\x3B\nEND\x3B';

revoke all on function public.provision_tenant_iam(uuid) from public;
grant execute on function public.provision_tenant_iam(uuid) to current_user;

-- Backfill deterministic roles and permissions for every existing tenant.
select public.provision_tenant_iam(id) from tenants;

create or replace function public.resolve_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  SELECT id INTO NEW.role_id\n    FROM roles\n   WHERE tenant_id = NEW.tenant_id\n     AND name = NEW.role\x3B\n\n  IF NEW.role_id IS NULL THEN\n    RAISE EXCEPTION \x27Unknown tenant role: %\x27, NEW.role\x3B\n  END IF\x3B\n\n  RETURN NEW\x3B\nEND\x3B';

revoke all on function public.resolve_membership_role() from public;
grant execute on function public.resolve_membership_role() to current_user;

drop trigger if exists tenant_memberships_resolve_role on tenant_memberships;
create trigger tenant_memberships_resolve_role
before insert or update of role, role_id, tenant_id on tenant_memberships
for each row execute function public.resolve_membership_role();

-- Backfill existing memberships and fail closed if a membership references an unknown role.
update tenant_memberships tm
   set role_id = r.id
  from roles r
 where r.tenant_id = tm.tenant_id
   and r.name = tm.role
   and tm.role_id is distinct from r.id;

create or replace function public.grant_new_permission_to_admins()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, NEW.id FROM roles r WHERE r.name = \x27admin\x27\n  ON CONFLICT DO NOTHING\x3B\n  RETURN NEW\x3B\nEND\x3B';

revoke all on function public.grant_new_permission_to_admins() from public;
grant execute on function public.grant_new_permission_to_admins() to current_user;

drop trigger if exists permissions_grant_to_admins on permissions;
create trigger permissions_grant_to_admins
after insert on permissions
for each row execute function public.grant_new_permission_to_admins();

comment on function public.provision_tenant_iam(uuid) is
\x27Creates canonical tenant admin/operator roles and maps effective permissions.\x27;
