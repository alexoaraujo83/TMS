-- Move the Auth0 SECURITY DEFINER helpers to the CI bootstrap owner when it exists.
-- Migration 0037 is already applied in production and is immutable; keep its
-- checksum stable and carry CI-only ownership/grant changes in a new migration.

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'tms_bootstrap') then
    execute 'grant select, insert, update on table public.users to tms_bootstrap';
    execute 'grant select, insert on table public.tenant_memberships to tms_bootstrap';
    execute 'grant select on table public.tenants to tms_bootstrap';
    execute 'grant select on table public.roles to tms_bootstrap';
    execute 'grant select on table public.role_permissions to tms_bootstrap';
    execute 'grant select on table public.permissions to tms_bootstrap';
    execute 'alter function public.bootstrap_auth0_identity(text, text, text, uuid) owner to tms_bootstrap';

    execute 'grant select on table public.users to tms_bootstrap';
    execute 'grant select on table public.tenant_memberships to tms_bootstrap';
    execute 'grant select on table public.tenants to tms_bootstrap';
    execute 'grant select on table public.roles to tms_bootstrap';
    execute 'grant select on table public.role_permissions to tms_bootstrap';
    execute 'grant select on table public.permissions to tms_bootstrap';
    execute 'alter function public.check_tenant_membership(text, uuid) owner to tms_bootstrap';
  end if;
end;
$grants$;
