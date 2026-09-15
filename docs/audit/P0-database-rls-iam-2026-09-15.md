# P0 Database / RLS / IAM Audit — 2026-09-15

## Scope

Canonical repository: `alexoaraujo83/TMS`.

This execution continues from the existing main baseline and does not reclassify previously proven application functionality as complete without new runtime evidence.

## Baseline observed

- `main` HEAD at start: `fd8d52358bcf7c69387c366f6b40957d95c4865c`.
- Database package reports schema version `28`.
- Migrations `0001` through `0028` are present and ordered without a numeric gap.
- The migration runner records SHA-256 checksums in `public.schema_migrations` and uses an advisory transaction lock.
- Runtime tenant context is installed with `set_config('app.tenant_id', ..., true)` inside a transaction before repository work.
- Repositories use `withTransaction(..., { tenantId })`, so the tenant setting is transaction-scoped rather than a persistent pool-session setting.

## Confirmed database model from migrations

Tenant-scoped tables represented by the canonical migrations include:

- `tenants`
- `tenant_memberships`
- `roles`
- `role_permissions`
- `carriers`
- `drivers`
- `vehicles`
- `freights`
- `freight_assignments`
- `trips`
- `audit_events`
- `compliance_checks`
- `gr_requests`
- `trip_occurrences`
- `trip_pods`
- `financial_entries`
- `outbox_events`
- `durable_jobs`

`permissions` is intentionally global. `schema_migrations` is a migration-control table and is not an application tenant table.

Composite tenant-scoped foreign keys are explicitly used for critical relationships such as driver→carrier, vehicle→driver, assignment→freight/driver/vehicle, trip→freight/assignment, compliance/GR→freight/assignment, and finance→freight/assignment/trip.

## RLS evidence

The migrations explicitly enable and force RLS on tenant-owned tables and define tenant isolation policies. Later migrations (`0013`, `0018`, `0022`, `0023`, `0026`, `0028`) explicitly include `WITH CHECK` clauses for their tenant policies.

PostgreSQL semantics were also cross-checked against the official documentation: a policy containing `USING` without an explicit `WITH CHECK` implicitly uses the same expression for write checks for the applicable commands. Therefore the earlier policies are not treated as an automatic isolation defect solely because the clause is omitted. The audit requirement remains to prove behavior with a non-bypass runtime role.

## P0 finding: runtime IAM function privilege gap

Migration `0020_auth0_subject_identity.sql` drops the previous UUID resolver, recreates `public.check_tenant_membership(text, uuid)` as `SECURITY DEFINER`, and revokes `PUBLIC` execution. The migration does not grant execution to the canonical runtime application role after recreating the function.

The API calls this function directly through `verifyTenantMembership()`.

This was classified as **P0 / runtime privilege evidence gap** because the API runtime role must be able to execute the authoritative membership resolver while `PUBLIC` must not be able to execute it.

### Correction

Migration `0029_iam_runtime_execute_grant.sql` was added. It:

1. revokes execution from `PUBLIC` again;
2. grants execution to `nexora_app` when that canonical role exists;
3. intentionally does not create database roles or embed credentials in migrations.

The conditional grant preserves compatibility with environments where roles are provisioned outside the schema migration lifecycle.

## Behavioral RLS evidence added

A dedicated non-bypass runtime integration test was added:

`packages/database/test/rls-runtime.integration.test.ts`

It uses a separate `NOSUPERUSER NOBYPASSRLS` runtime role and an owner/provisioning role. It proves:

- cross-tenant reads are invisible;
- cross-tenant inserts are rejected;
- tenant reassignment on update is rejected;
- cross-tenant deletes do not affect the target row;
- transaction-local tenant context does not leak through pool reuse.

A second integration test was added:

`packages/database/test/iam-runtime.integration.test.ts`

It proves the runtime role can execute `check_tenant_membership(text, uuid)` while `PUBLIC` cannot, and verifies the authoritative Auth0-subject → internal-user → tenant-membership result.

## CI hardening

The CI workflow now provisions an ephemeral non-bypass runtime role for behavioral RLS testing and executes both dedicated integration tests before the existing quality chain.

The existing quality chain remains:

`format:fix → format:check → lint → typecheck → test → build`

## Evidence status

At the time this document was committed, the PR validation workflow was still running. Therefore the behavioral claims above are **IMPLEMENTED / PENDING CI EVIDENCE**, not yet marked COMPROVADO in the final gate.

## Remaining P0/P1 audit work

1. Execute the dedicated runtime CI tests and retain successful job evidence.
2. Verify actual production PostgreSQL roles and attributes for `nexora_owner`, `nexora_app`, `nexora_worker`, and `nexora_migrator`.
3. Prove `nexora_app` is `NOBYPASSRLS`, non-superuser, and does not own tenant tables.
4. Reconcile the migration runner's existing-schema baseline validator with all schema introduced after migration `0021`; its current `expectedTables` list predates `trip_occurrences`, `trip_pods`, `financial_entries`, `outbox_events`, and `durable_jobs`.
5. Perform the production database catalog audit (`pg_roles`, `pg_class`, `pg_policy`, `pg_constraint`, `pg_indexes`, privileges) against the live canonical database.

## Decision

Do not mark the Database/RLS/IAM gate final until the live runtime role audit and successful non-bypass behavioral test evidence are both available.
