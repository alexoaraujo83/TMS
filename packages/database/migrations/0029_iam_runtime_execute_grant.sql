-- Keep the authoritative Auth0 membership resolver closed to PUBLIC.
-- Grant execution only to the runtime application roles when provisioned.
revoke all on function public.check_tenant_membership(text, uuid) from public;

DO $$
BEGIN
  IF EXISTS (select 1 from pg_roles where rolname = 'tms_app') THEN
    execute 'grant execute on function public.check_tenant_membership(text, uuid) to tms_app';
  END IF;
  IF EXISTS (select 1 from pg_roles where rolname = 'nexora_app') THEN
    execute 'grant execute on function public.check_tenant_membership(text, uuid) to nexora_app';
  END IF;
END $$;
