# TMS — Neon Live Evidence — 2026-09-26

## Scope

Read-only verification of the canonical Neon project `tms` (`shiny-hall-34679912`), default branch `main` (`br-lingering-shadow-act0vvi9`), database `neondb`.

No schema mutation was executed.

## DB-01 — Migration head

Live `public.schema_migrations` reports:

- `0035_diagnostics_permission_and_admin_replay.sql`
  - checksum: `86380c669fa14b9e9e49a49f29822efb73347bec60d2b75e05f81fa81c2d94c`
- `0034_freight_replay_permission.sql`
  - checksum: `82b8d07f1113a08678be03c80cdf36048e573a238aa2a275f7c60cd4637247b9`
- `0033_durable_job_idempotency.sql`
  - checksum: `d18c0849023fd07407350cbd1bb38a1b4caf0074242b7ff4bf8cd59d426b2a3c`
- `0032_observability_audit_context.sql`
  - checksum: `1c8e70d30f1bbd9442682035b7c08e8fdc3ed619b83615f8eb033bbb4cc45e78`

The repository migrations at the audited control HEAD contain the same SHA-256 checksums for 0032 and 0033; 0035 was independently hashed from the repository file and matches live. Therefore DB-01 is **COMPROVADO for the migration head and checked migration checksums**.

## Runtime role evidence

Live roles report:

- `tms_app`: `rolsuper=false`, `rolbypassrls=false`, `rolcanlogin=true`.
- `authenticator`: `rolsuper=false`, `rolbypassrls=false`, `rolcanlogin=true`.
- `neondb_owner`: `rolsuper=false`, `rolbypassrls=true`.

The application role therefore has `NOBYPASSRLS` at the live database level.

## RLS structural evidence

All tenant-scoped tables inspected have RLS enabled and forced. The live database currently reports `19` public tables with `relrowsecurity=true` and `relforcerowsecurity=true`, including:

- `freights`
- `audit_events`
- `outbox_events`
- `durable_jobs`
- `financial_entries`
- `tenant_memberships`
- `users`
- `carriers`
- `drivers`
- `vehicles`
- `trips`
- `trip_occurrences`
- `trip_pods`
- `compliance_checks`
- `gr_requests`
- `freight_assignments`
- `roles`
- `role_permissions`
- `tenants`

The inspected tenant policies compare `tenant_id` to `current_setting('app.tenant_id', true)` (UUID cast where applicable), for example `freights`, `audit_events`, `outbox_events`, and `durable_jobs`.

## DB-04 — Behavioral test status

A direct `SET ROLE tms_app` attempt through the Neon SQL connector was rejected with `permission denied to set role "tms_app"`, even though `pg_auth_members` reports `neondb_owner -> tms_app` with `admin_option=true`. The connector therefore could not establish a true `tms_app` session for the cross-tenant behavioral assertion.

Consequently **DB-04 remains OPEN/BLOCKED**. Structural evidence is strong, but no cross-tenant `SELECT/INSERT/UPDATE/DELETE` result has been promoted to E4.

## Additional live observations

- `freights`: 0 rows.
- `financial_entries`: 0 rows.
- `audit_events`: 117 rows for one tenant.
- `outbox_events`: 27 rows for one tenant.
- The canonical tenant observed in populated audit/outbox data is `19d9a5a4-2d50-4b78-a910-1fdea96fd12e`.

## Conclusion

**DB-01: CLOSED/COMPROVADO.**

**DB-04: OPEN/BLOCKED.** The remaining evidence requires an actual connection authenticated as `tms_app` (or an equivalent runtime path that demonstrably uses that role) and controlled cross-tenant assertions.
