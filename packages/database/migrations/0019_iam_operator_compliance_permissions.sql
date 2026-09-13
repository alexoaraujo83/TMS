-- Extend the canonical tenant IAM baseline with compliance permissions.
-- Keep the routine executor-compatible and preserve tenant-scoped role assignment.

create or replace function public.provision_tenant_iam(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as E'BEGIN\n  INSERT INTO roles (tenant_id, name, description)\n  VALUES (p_tenant_id, \'admin\', \'Full tenant administration\')\n  ON CONFLICT (tenant_id, name) DO UPDATE\n    SET description = excluded.description;\n\n  INSERT INTO roles (tenant_id, name, description)\n  VALUES (p_tenant_id, \'operator\', \'Operational freight, trip and compliance execution\')\n  ON CONFLICT (tenant_id, name) DO UPDATE\n    SET description = excluded.description;\n\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, p.id\n    FROM roles r\n    CROSS JOIN permissions p\n   WHERE r.tenant_id = p_tenant_id\n     AND r.name = \'admin\'\n  ON CONFLICT DO NOTHING;\n\n  INSERT INTO role_permissions (role_id, permission_id)\n  SELECT r.id, p.id\n    FROM roles r\n    CROSS JOIN permissions p\n   WHERE r.tenant_id = p_tenant_id\n     AND r.name = \'operator\'\n     AND p.code IN (\n       \'freight:read\', \'freight:create\', \'freight:update\',\n       \'driver:read\', \'driver:create\', \'driver:update\',\n       \'vehicle:read\', \'vehicle:create\', \'vehicle:update\',\n       \'carrier:read\', \'carrier:create\', \'carrier:update\',\n       \'matching:read\', \'matching:assign\',\n       \'trip:read\', \'trip:create\', \'trip:update\',\n       \'compliance:read\', \'compliance:create\', \'compliance:update\'\n     )\n  ON CONFLICT DO NOTHING;\n\n  RETURN;\nEND;';

revoke all on function public.provision_tenant_iam(uuid) from public;
grant execute on function public.provision_tenant_iam(uuid) to current_user;

comment on function public.provision_tenant_iam(uuid) is
'Creates canonical tenant admin/operator roles and maps effective permissions, including compliance.';
