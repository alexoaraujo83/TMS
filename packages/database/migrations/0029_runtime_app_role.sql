-- Runtime database role hardening.
-- The application must never connect with a role that has BYPASSRLS.
-- Password provisioning is intentionally external to migrations.
CREATE ROLE tms_app
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

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

-- Keep future application tables/sequences aligned with the runtime boundary
-- when migrations are executed by the canonical database owner.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tms_app;

-- The migration role remains the only role responsible for schema changes.
REVOKE CREATE ON SCHEMA public FROM tms_app;
