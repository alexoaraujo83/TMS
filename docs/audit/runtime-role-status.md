# Runtime database role audit

## Scope

Audit of the application, worker and integration-test database connection paths after the runtime role hardening migration.

## Evidence

- `packages/database/src/pool.ts` creates a PostgreSQL pool from `connectionString` and does not select a PostgreSQL role itself.
- `apps/api/src/common/database.module.ts` supplies `process.env.DATABASE_URL` directly to that pool.
- `apps/worker/src/main.ts` creates a PostgreSQL `Pool` directly from `process.env.DATABASE_URL`.
- Tenant-aware repository transactions use `set_config('app.tenant_id', tenantId, true)` before tenant-owned queries.
- Neon production database contains `tms_app` with `BYPASSRLS=false`, no superuser/create-role/create-database privileges, and the required schema/table/function grants after the corrective role migration.
- `packages/database/test/security.integration.test.ts` separates an administrative fixture/cleanup connection (`DATABASE_ADMIN_URL`) from the restricted runtime connection (`DATABASE_URL`). All tenant-isolation assertions use the runtime pool.
- CI runs the migration with the administrative connection, creates a random CI-only password for `tms_app`, and exports a runtime-only `DATABASE_URL` for the integration suite. The generated credential is not committed.

## CI execution evidence

- GitHub Actions CI run `#651` (`35018451926`) for commit `e7da9788358c064847cb84c6fcfc75f44d3ce247` completed successfully.
- Database migration completed successfully before the restricted runtime credential was provisioned.
- The CI runtime-role credential provisioning step completed successfully.
- `pnpm format:fix`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all completed successfully in the same run.
- The CI integration suite therefore executed with the restricted runtime connection path configured by the workflow rather than the administrative fixture connection.

## Credential provisioning evidence

- An earlier Neon API role recreation path generated a login credential but produced a role with privileged role attributes, including RLS bypass; that state was not accepted for application runtime use.
- The privileged recreation was removed, including the temporary `tms_app_runtime` role.
- `tms_app` was recreated through the database migration path with explicit `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` and the required grants.
- Temporary-branch validation proved the recreated role had `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, `rolcanlogin=true`, and `rolbypassrls=false` before applying the migration to production.
- Production read-only validation now reports `tms_app` with `authentication_method=password` and the same restricted role attributes. The role has schema usage, freight SELECT/INSERT, and membership-function EXECUTE; it does not have INSERT privilege on `schema_migrations`.
- No production credential is committed to source control.

## Current state

**Database role hardening: COMPROVADO.**

**CI restricted-role integration architecture: COMPROVADO.**

**CI quality/test/build pipeline: COMPROVADO — Run #651 passed.**

**Production credential availability: COMPROVADO — Neon management metadata reports password authentication for `tms_app`.**

**Production runtime role adoption: PENDENTE DE EVIDÊNCIA.**

The application and worker source code do not force `tms_app`; therefore the effective production runtime role is determined by the credential embedded in `DATABASE_URL`. The latest database activity sample observed only `neondb_owner` connections and did not observe an application connection as `tms_app`.

## Required next gate

1. Update the API production `DATABASE_URL` through the platform secret-management path so it authenticates directly as `tms_app`.
2. Determine whether the worker's `DATABASE_URL` is an operational application credential or a backup/restore administrative credential before changing it; backup and restore credentials must remain separate when elevated privileges are required.
3. Prove an application connection with `current_user='tms_app'` and validate tenant A/B read, insert, update and delete isolation, missing-context denial, transaction-scoped context, connection-pool reuse, and membership-function execution against the restricted runtime path.
4. Re-run deployment health checks and confirm the deployed API and worker remain healthy using the intended least-privilege role.

Until these steps are evidenced, P0 database runtime isolation remains **not fully proven** even though the database role, credential availability and CI restricted-role test path are hardened and validated.
