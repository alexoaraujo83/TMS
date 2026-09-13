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
set search_path = public
stable
as $$
  select tm.user_id,
         tm.tenant_id,
         coalesce(r.name, tm.role) as role,
         coalesce(
           array_agg(distinct p.code) filter (where p.code is not null),
           '{}'::text[]
         ) as permissions,
         (u.status = 'active' and t.status = 'active') as active
    from tenant_memberships tm
    join users u on u.id = tm.user_id
    join tenants t on t.id = tm.tenant_id
    left join roles r on r.id = tm.role_id
    left join role_permissions rp on rp.role_id = r.id
    left join permissions p on p.id = rp.permission_id
   where u.auth0_subject = p_auth0_subject
     and tm.tenant_id = p_tenant_id
   group by tm.user_id, tm.tenant_id, r.name, tm.role, u.status, t.status
   limit 1;
$$;

revoke all on function public.check_tenant_membership(text, uuid) from public;
grant execute on function public.check_tenant_membership(text, uuid) to current_user;

comment on function public.check_tenant_membership(text, uuid) is
'Authoritative Auth0 subject to internal user and tenant membership resolution. SECURITY DEFINER uses a fixed search_path and never treats the external subject as the internal user UUID.';
