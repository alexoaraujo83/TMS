-- The Auth0 membership resolver is SECURITY DEFINER and must not be
-- executable by PUBLIC. Runtime API access requires an explicit grant to the
-- canonical application role after migration 0020 recreated the text/uuid
-- signature.
revoke all on function public.check_tenant_membership(text, uuid) from public;

DO $$
BEGIN
  IF EXISTS (select 1 from pg_roles where rolname = 'nexora_app') THEN
    execute 'grant execute on function public.check_tenant_membership(text, uuid) to nexora_app';
  END IF;
END $$;
