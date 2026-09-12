-- Establish deterministic tenant roles so memberships can resolve effective permissions.
-- Admin receives every permission; operator receives operational freight/master-data,
-- matching and trip permissions. Existing tenants and memberships are backfilled.

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
  values (p_tenant_id, 'operator', 'Operational freight and trip execution')
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
     'trip:read', 'trip:create', 'trip:update'
   )
  on conflict do nothing;
end;
$$;

revoke all on function public.provision_tenant_iam(uuid) from public;
grant execute on function public.provision_tenant_iam(uuid) to current_user;

create or replace function public.provision_tenant_iam_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.provision_tenant_iam(new.id);
  return new;
end;
$$;

revoke all on function public.provision_tenant_iam_on_insert() from public;
grant execute on function public.provision_tenant_iam_on_insert() to current_user;

drop trigger if exists tenants_provision_iam on tenants;
create trigger tenants_provision_iam
after insert on tenants
for each row execute function public.provision_tenant_iam_on_insert();

-- Existing tenants receive the same deterministic role baseline.
do $$
declare
  tenant_record record;
begin
  for tenant_record in select id from tenants loop
    perform public.provision_tenant_iam(tenant_record.id);
  end loop;
end;
$$;

-- Resolve legacy role text to the canonical tenant role. Unknown custom roles remain
-- untouched and continue to require explicit role/permission administration.
update tenant_memberships tm
   set role_id = r.id
  from roles r
 where r.tenant_id = tm.tenant_id
   and r.name = tm.role
   and tm.role_id is null;

-- Future memberships using the legacy role column are resolved automatically.
create or replace function public.resolve_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_role_id uuid;
begin
  if new.role_id is null then
    select id into resolved_role_id
      from roles
     where tenant_id = new.tenant_id
       and name = new.role;
    new.role_id = resolved_role_id;
  end if;
  return new;
end;
$$;

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
set search_path = public
as $$
begin
  insert into role_permissions (role_id, permission_id)
  select r.id, new.id
    from roles r
   where r.name = 'admin'
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.grant_new_permission_to_admins() from public;
grant execute on function public.grant_new_permission_to_admins() to current_user;

drop trigger if exists permissions_grant_to_admins on permissions;
create trigger permissions_grant_to_admins
after insert on permissions
for each row execute function public.grant_new_permission_to_admins();

comment on function public.provision_tenant_iam(uuid) is
'Creates canonical tenant admin/operator roles and maps effective permissions.';
