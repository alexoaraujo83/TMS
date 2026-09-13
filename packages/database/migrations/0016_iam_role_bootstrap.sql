-- Establish deterministic tenant roles so memberships can resolve effective permissions.
-- Admin receives every permission; operator receives operational freight/master-data,
-- matching and trip permissions. Existing tenants and memberships are backfilled.

create or replace function public.provision_tenant_iam(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  INSERT INTO roles (tenant_id, name, description)\n  VALUES (p_tenant_id, \'admin\', \'Full tenant administration\')\n  ON CONFLICT (tenant_id, name) DO UPDATE\n    SET description = excluded.description;\n\n  INSERT INTO roles (tenant_id, name, description)\n  VALUES (p_tenant_id, \'operator\', \'Operational freight and trip execution\')\n  ON CONFLICT (tenant_id, name) DO UPDATE\n    SET description = excluded.description;\n\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p\n   WHERE r.tenant_id = p_tenant_id AND r.name = \'admin\'\n  ON CONFLICT DO NOTHING;\n\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, p.id FROM roles r CROSS JOIN permissions p\n   WHERE r.tenant_id = p_tenant_id AND r.name = \'operator\'\n     AND p.code IN (\n       \'freight:read\', \'freight:create\', \'freight:update\',\n       \'driver:read\', \'driver:create\', \'driver:update\',\n       \'vehicle:read\', \'vehicle:create\', \'vehicle:update\',\n       \'carrier:read\', \'carrier:create\', \'carrier:update\',\n       \'matching:read\', \'matching:assign\',\n       \'trip:read\', \'trip:create\', \'trip:update\'\n     )\n  ON CONFLICT DO NOTHING;\n\n  RETURN;\nEND;';

revoke all on function public.provision_tenant_iam(uuid) from public;
grant execute on function public.provision_tenant_iam(uuid) to current_user;

-- Existing tenants receive the same deterministic role baseline.
-- The executor-compatible E-string above avoids embedded PL/pgSQL dollar-quote
-- delimiters and semicolons being split by the migration runner.

create or replace function public.resolve_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  IF NEW.role_id IS NULL THEN\n    SELECT id INTO NEW.role_id\n      FROM roles\n     WHERE tenant_id = NEW.tenant_id\n       AND name = NEW.role;\n  END IF;\n  RETURN NEW;\nEND;';

revoke all on function public.resolve_membership_role() from public;
grant execute on function public.resolve_membership_role() to current_user;

drop trigger if exists tenant_memberships_resolve_role on tenant_memberships;
create trigger tenant_memberships_resolve_role
before insert or update of role, role_id on tenant_memberships
for each row execute function public.resolve_membership_role();

-- Any newly introduced permission is automatically granted to tenant admins.
create or replace function public.grant_new_permission_to_admins()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, NEW.id\n    FROM roles r\n   WHERE r.name = \'admin\'\n  ON CONFLICT DO NOTHING;\n  RETURN NEW;\nEND;';

revoke all on function public.grant_new_permission_to_admins() from public;
grant execute on function public.grant_new_permission_to_admins() to current_user;

drop trigger if exists permissions_grant_to_admins on permissions;
create trigger permissions_grant_to_admins
after insert on permissions
for each row execute function public.grant_new_permission_to_admins();

comment on function public.provision_tenant_iam(uuid) is
'Creates canonical tenant admin/operator roles and maps effective permissions.';
