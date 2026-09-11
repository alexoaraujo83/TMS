drop function if exists public.check_tenant_membership(uuid, uuid);

create function public.check_tenant_membership(p_user_id uuid, p_tenant_id uuid)
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
   where tm.user_id = p_user_id
     and tm.tenant_id = p_tenant_id
   group by tm.user_id, tm.tenant_id, r.name, tm.role, u.status, t.status
   limit 1;
$$;

revoke all on function public.check_tenant_membership(uuid, uuid) from public;

comment on function public.check_tenant_membership(uuid, uuid) is
'Bootstrap-only authoritative tenant membership and effective permission lookup. SECURITY DEFINER uses a fixed search_path and accepts identity and selected tenant explicitly.';
