-- Runtime database role hardening.
-- The application must never connect with a role that has BYPASSRLS.
-- Password provisioning is intentionally external to migrations.
DO $$
DECLARE
  migration_role text := current_user;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tms_app') THEN
    CREATE ROLE tms_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  END IF;

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tms_app',
    migration_role
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tms_app',
    migration_role
  );
END $$;

GRANT USAGE ON SCHEMA public TO tms_app;

-- Runtime reads are available to the application, while migration metadata
-- remains inaccessible to the runtime role.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tms_app;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tms_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.permissions, public.schema_migrations
  FROM tms_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tms_app;
GRANT EXECUTE ON FUNCTION public.check_tenant_membership(text, uuid) TO tms_app;

-- The runtime role cannot create schema objects or perform migrations.
REVOKE CREATE ON SCHEMA public FROM tms_app;
