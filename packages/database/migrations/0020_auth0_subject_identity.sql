alter table users
  add column if not exists auth0_subject text;

create unique index if not exists users_auth0_subject_uidx
  on users (auth0_subject)
  where auth0_subject is not null;

drop function if exists public.check_tenant_membership(uuid, uuid);
drop function if exists public.check_tenant_membership(text, uuid);

create function public.check_tenant_membership(p_auth0_subject text, p_tenant_id uuid)
returns table (
  user_id uuid,
  tenant_id uuid,
  role text,
  permissions text[],
  active boolean
)
language sql
security definer
set search_path = public, pg_catalog
stable
as E'  SELECT tm.user_id,\n         tm.tenant_id,\n         coalesce(r.name, tm.role) AS role,\n         coalesce(\n           array_agg(distinct p.code) filter (where p.code is not null),\n           \'{}\'::text[]\n         ) AS permissions,\n         (u.status = \'active\' AND t.status = \'active\') AS active\n    FROM tenant_memberships tm\n    JOIN users u ON u.id = tm.user_id\n    JOIN tenants t ON t.id = tm.tenant_id\n    LEFT JOIN roles r ON r.id = tm.role_id\n    LEFT JOIN role_permissions rp ON rp.role_id = r.id\n    LEFT JOIN permissions p ON p.id = rp.permission_id\n   WHERE u.auth0_subject = p_auth0_subject\n     AND tm.tenant_id = p_tenant_id\n   GROUP BY tm.user_id, tm.tenant_id, r.name, tm.role, u.status, t.status\n   LIMIT 1';

revoke all on function public.check_tenant_membership(text, uuid) from public;
grant execute on function public.check_tenant_membership(text, uuid) to current_user;

comment on function public.check_tenant_membership(text, uuid) is
'Authoritative Auth0 subject to internal user and tenant membership resolution. SECURITY DEFINER uses a fixed search_path and never treats the external subject as the internal user UUID.';
