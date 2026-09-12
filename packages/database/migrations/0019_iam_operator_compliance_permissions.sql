create or replace function public.provision_tenant_iam(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role_id uuid;
  operator_role_id uuid;
begin
  insert into roles (tenant_id, name, description)
  values (p_tenant_id, 'admin', 'Full tenant administration')
  on conflict (tenant_id, name) do update
    set description = excluded.description
  returning id into admin_role_id;

  if admin_role_id is null then
    select id into admin_role_id from roles where tenant_id = p_tenant_id and name = 'admin';
  end if;

  insert into roles (tenant_id, name, description)
  values (p_tenant_id, 'operator', 'Operational freight, trip and compliance execution')
  on conflict (tenant_id, name) do update
    set description = excluded.description
  returning id into operator_role_id;

  if operator_role_id is null then
    select id into operator_role_id from roles where tenant_id = p_tenant_id and name = 'operator';
  end if;

  insert into role_permissions (role_id, permission_id)
  select admin_role_id, p.id from permissions p
  on conflict do nothing;

  insert into role_permissions (role_id, permission_id)
  select operator_role_id, p.id
    from permissions p
   where p.code in (
     'freight:read', 'freight:create', 'freight:update',
     'driver:read', 'driver:create', 'driver:update',
     'vehicle:read', 'vehicle:create', 'vehicle:update',
     'carrier:read', 'carrier:create', 'carrier:update',
     'matching:read', 'matching:assign',
     'trip:read', 'trip:create', 'trip:update',
     'compliance:read', 'compliance:create', 'compliance:update'
   )
  on conflict do nothing;
end;
$$;

revoke all on function public.provision_tenant_iam(uuid) from public;
grant execute on function public.provision_tenant_iam(uuid) to current_user;

comment on function public.provision_tenant_iam(uuid) is
'Creates canonical tenant admin/operator roles and maps effective permissions.';
