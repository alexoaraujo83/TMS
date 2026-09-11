create or replace function public.check_tenant_membership(p_user_id uuid, p_tenant_id uuid)
returns table (user_id uuid, tenant_id uuid, role text, active boolean)
language sql
security definer
set search_path = public
stable
as $$
  select tm.user_id,
         tm.tenant_id,
         coalesce(r.name, tm.role) as role,
         (u.status = 'active' and t.status = 'active') as active
    from tenant_memberships tm
    join users u on u.id = tm.user_id
    join tenants t on t.id = tm.tenant_id
    left join roles r on r.id = tm.role_id
   where tm.user_id = p_user_id
     and tm.tenant_id = p_tenant_id
   limit 1;
$$;

revoke all on function public.check_tenant_membership(uuid, uuid) from public;

comment on function public.check_tenant_membership(uuid, uuid) is
'Bootstrap-only membership verification. SECURITY DEFINER uses a fixed search_path and accepts both identity and selected tenant explicitly.';
