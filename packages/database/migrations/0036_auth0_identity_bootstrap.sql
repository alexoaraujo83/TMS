-- Auth0 identity bootstrap for just-in-time local user provisioning.
--
-- Auth0 remains the identity provider, while TMS/PostgreSQL remains
-- authoritative for the local user and tenant membership. The function is
-- deliberately idempotent and only creates a first membership when the local
-- identity has no existing tenant memberships.

create or replace function public.bootstrap_auth0_identity(
  p_auth0_subject text,
  p_email text,
  p_display_name text,
  p_tenant_id uuid default null
)
returns table (
  user_id uuid,
  tenant_id uuid,
  linked boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid;
  v_existing_subject text;
  v_membership_count integer;
  v_role_id uuid;
  v_linked_tenant uuid;
begin
  if nullif(trim(p_auth0_subject), '') is null then
    raise exception 'auth0_subject is required' using errcode = '22023';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'email is required' using errcode = '22023';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'display_name is required' using errcode = '22023';
  end if;

  select u.id, u.auth0_subject
    into v_user_id, v_existing_subject
    from users u
   where u.auth0_subject = trim(p_auth0_subject)
   limit 1
   for update;

  if v_user_id is null then
    select u.id, u.auth0_subject
      into v_user_id, v_existing_subject
      from users u
     where lower(u.email) = lower(trim(p_email))
     limit 1
     for update;

    if v_user_id is not null and v_existing_subject is not null
       and v_existing_subject <> trim(p_auth0_subject) then
      raise exception 'email is already linked to another Auth0 subject'
        using errcode = '23505';
    end if;
  end if;

  if v_user_id is null then
    insert into users (auth0_subject, email, display_name, status)
    values (trim(p_auth0_subject), trim(p_email), trim(p_display_name), 'active')
    returning id into v_user_id;
  else
    update users
       set auth0_subject = trim(p_auth0_subject),
           email = trim(p_email),
           display_name = trim(p_display_name),
           updated_at = now()
     where id = v_user_id;
  end if;

  select count(*)::integer
    into v_membership_count
    from tenant_memberships tm
   where tm.user_id = v_user_id;

  if p_tenant_id is not null then
    if not exists (
      select 1 from tenants t
       where t.id = p_tenant_id
         and t.status = 'active'
    ) then
      raise exception 'tenant is not active or does not exist'
        using errcode = '23503';
    end if;

    if v_membership_count = 0 then
      select r.id
        into v_role_id
        from roles r
       where r.tenant_id = p_tenant_id
         and r.name = 'operator'
       limit 1;

      insert into tenant_memberships (tenant_id, user_id, role, role_id)
      values (p_tenant_id, v_user_id, 'operator', v_role_id)
      on conflict (tenant_id, user_id) do nothing;
    end if;
  end if;

  select tm.tenant_id
    into v_linked_tenant
    from tenant_memberships tm
   where tm.user_id = v_user_id
     and (p_tenant_id is null or tm.tenant_id = p_tenant_id)
   order by tm.created_at
   limit 1;

  return query select v_user_id, v_linked_tenant,
    (v_linked_tenant is not null);
end;
$$;

revoke all on function public.bootstrap_auth0_identity(text, text, text, uuid) from public;
grant execute on function public.bootstrap_auth0_identity(text, text, text, uuid) to current_user;

comment on function public.bootstrap_auth0_identity(text, text, text, uuid) is
'Idempotent Auth0-to-TMS identity bootstrap. Links the first tenant only when the local identity has no existing memberships; subsequent authorization remains PostgreSQL membership authority.';
