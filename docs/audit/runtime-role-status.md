# Runtime database role audit

## Scope

Audit of the application and worker database connection path after the runtime role hardening migration.

## Evidence

- `packages/database/src/pool.ts` creates a PostgreSQL pool from `connectionString` and does not select a PostgreSQL role itself. fileciteturn149file0L2-L5
- `apps/api/src/common/database.module.ts` supplies `process.env.DATABASE_URL` directly to that pool.
- `apps/worker/src/main.ts` creates a PostgreSQL `Pool` directly from `process.env.DATABASE_URL`.
- Tenant-aware repository transactions use `set_config('app.tenant_id', tenantId, true)` before tenant-owned queries.
- Neon production database contains `tms_app` with `BYPASSRLS=false`, no superuser/create-role/create-database privileges, and the required schema/table/function grants after the corrective role migration.

## Credential provisioning evidence

- The first Neon API role recreation path generated a login credential but produced a role with privileged role attributes, including RLS bypass; that state was not accepted for application runtime use.
- The privileged recreation was removed.
- `tms_app` was recreated through the database migration path with explicit `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` and the required grants.
- Temporary-branch validation proved the recreated role had `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, `rolcanlogin=true`, and `rolbypassrls=false` before applying the migration to production.
- The Neon management API does not currently expose a compatible password-reset path for this migration-created role, and direct `ALTER ROLE ... PASSWORD` execution is blocked by the managed-role boundary. No credential was committed to source control.

## Current state

**Database role hardening: COMPROVADO.**

**Runtime role adoption: PENDENTE DE EVIDÊNCIA.**

The application and worker source code do not force `tms_app`; therefore the effective runtime role is determined entirely by the credential embedded in `DATABASE_URL`. The production application connection has not yet been proven to authenticate directly as `tms_app`.

## Required next gate

1. Establish a supported production credential path for the hardened `tms_app` role without weakening its security attributes or committing secrets.
2. Update API and worker production `DATABASE_URL` values to use `tms_app`.
3. Execute behavioral RLS tests using the real runtime credential.
4. Prove tenant A/B read, insert, update and delete isolation, missing-context denial, transaction-scoped context, connection-pool reuse, and membership-function execution.
5. Re-run format, lint, typecheck, test, build, migration validation and deployment health checks.

Until these steps are evidenced, P0 database runtime isolation remains **not fully proven** even though the database role itself is hardened.
