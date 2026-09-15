# Runtime database role audit

## Scope

Audit of the application, worker and integration-test database connection paths after the runtime role hardening migration.

## Evidence

- `packages/database/src/pool.ts` creates a PostgreSQL pool from `connectionString` and does not select a PostgreSQL role itself.
- `apps/api/src/common/database.module.ts` supplies `process.env.DATABASE_URL` directly to that pool.
- `apps/worker/src/main.ts` creates a PostgreSQL `Pool` directly from `process.env.DATABASE_URL`.
- Tenant-aware repository transactions use `set_config('app.tenant_id', tenantId, true)` before tenant-owned queries.
- Neon production database contains `tms_app` with `BYPASSRLS=false`, no superuser/create-role/create-database privileges, and the required schema/table/function grants after the corrective role migration.
- `packages/database/test/security.integration.test.ts` now separates an administrative fixture/cleanup connection (`DATABASE_ADMIN_URL`) from the restricted runtime connection (`DATABASE_URL`). All tenant-isolation assertions use the runtime pool.
- CI runs the migration with the administrative connection, creates a random CI-only password for `tms_app`, and exports a runtime-only `DATABASE_URL` for the integration suite. The generated credential is not committed.

## Credential provisioning evidence

- The first Neon API role recreation path generated a login credential but produced a role with privileged role attributes, including RLS bypass; that state was not accepted for application runtime use.
- The privileged recreation was removed.
- `tms_app` was recreated through the database migration path with explicit `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` and the required grants.
- Temporary-branch validation proved the recreated role had `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, `rolcanlogin=true`, and `rolbypassrls=false` before applying the migration to production.
- The Neon management API does not currently expose a compatible password-reset path for this migration-created role, and direct `ALTER ROLE ... PASSWORD` execution is blocked by the managed-role boundary. No production credential was committed to source control.

## Current state

**Database role hardening: COMPROVADO.**

**CI runtime-role RLS test architecture: IMPLEMENTED; CI EXECUTION PENDING.**

**Production runtime role adoption: PENDENTE DE EVIDÊNCIA.**

The application and worker source code do not force `tms_app`; therefore the effective production runtime role is determined by the credential embedded in `DATABASE_URL`. The production application connection has not yet been proven to authenticate directly as `tms_app`.

## Required next gate

1. Obtain a supported production credential path for the hardened `tms_app` role without weakening its security attributes or committing secrets.
2. Update API and worker production `DATABASE_URL` values to use `tms_app` through the platform's secret-management path.
3. Obtain successful CI evidence for the restricted-role integration suite.
4. Prove tenant A/B read, insert, update and delete isolation, missing-context denial, transaction-scoped context, connection-pool reuse, and membership-function execution.
5. Re-run format, lint, typecheck, test, build, migration validation and deployment health checks.

Until these steps are evidenced, P0 database runtime isolation remains **not fully proven** even though the database role itself is hardened.
