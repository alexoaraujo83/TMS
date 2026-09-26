# AUDIT-TRACKER — Live Evidence Addendum — 2026-09-26

This addendum is part of the current tracker state and records the live Neon verification executed against the canonical `tms` project. It is intentionally separate so the large historical tracker remains byte-for-byte auditable.

## DB-01 — CLOSED / COMPROVADO

Canonical Neon project: `tms` (`shiny-hall-34679912`), default branch `main` (`br-lingering-shadow-act0vvi9`), database `neondb`.

Live `public.schema_migrations` head is `0035_diagnostics_permission_and_admin_replay.sql`.

Verified live checksums:

| Migration | Live checksum | Repository SHA-256 |
|---|---|---|
| 0032_observability_audit_context.sql | `1c8e70d30f1bbd9442682035b7c08e8fdc3ed619b83615f8eb033bbb4cc45e78` | MATCH |
| 0033_durable_job_idempotency.sql | `d18c0849023fd07407350cbd1bb38a1b4caf0074242b7ff4bf8cd59d426b2a3c` | MATCH |
| 0034_freight_replay_permission.sql | `82b8d07f1113a08678be03c80cdf36048e573a238aa2a275f7c60cd4637247b9` | MATCH |
| 0035_diagnostics_permission_and_admin_replay.sql | `86380c669fa14b9e9e49a49f29822efb73347bec60d2b75e05f81fa81c2d94c` | MATCH |

This closes DB-01 for the checked head/checksum contract.

## DB-04 — OPEN / BLOCKED

Live `tms_app` has `rolsuper=false`, `rolbypassrls=false`, `rolcanlogin=true`.

RLS is enabled and forced on the tenant-scoped public tables inspected, including `freights`, `audit_events`, `outbox_events`, `durable_jobs`, `financial_entries`, `tenant_memberships`, `users`, `carriers`, `drivers`, `vehicles`, `trips`, `trip_occurrences`, `trip_pods`, `compliance_checks`, `gr_requests`, `freight_assignments`, `roles`, `role_permissions`, and `tenants`.

The inspected policies bind access to `current_setting('app.tenant_id', true)`.

A direct `SET ROLE tms_app` from the Neon SQL connector was rejected by PostgreSQL with `permission denied to set role "tms_app"`. Therefore the cross-tenant behavioral E4 could not be executed using a true `tms_app` session. Structural controls are confirmed; behavioral isolation is not promoted to PASS.

## Required next action

Use the runtime's real `tms_app` connection path (or a supported Neon connector path that authenticates directly as `tms_app`) to execute controlled same-tenant and cross-tenant SELECT/INSERT/UPDATE/DELETE assertions. Do not modify RLS or grants merely to make the test pass.

## Evidence file

Full live evidence is recorded in `docs/audit/DB-LIVE-EVIDENCE-2026-09-26.md`.


## DB-04 — Authorization note — 2026-09-26

The operator explicitly authorized the controlled behavioral E4 for DB-04 in this audit sequence.

This authorization does **not** authorize changing RLS policies, grants, role attributes, credentials, or production configuration to manufacture a passing result. The test must use the real `tms_app` connection path, controlled tenant data, and rollback/no-persistence for any test mutation.

Required evidence remains:
- effective `current_user=tms_app`;
- `rolbypassrls=false`;
- own-tenant SELECT succeeds;
- cross-tenant SELECT produces no rows/no disclosure;
- controlled cross-tenant INSERT is rejected;
- controlled cross-tenant UPDATE is rejected;
- no persistent test mutation;
- no secrets recorded.

The existing `SET ROLE tms_app` attempt is not sufficient because PostgreSQL rejected it with `permission denied to set role "tms_app"`. DB-04 therefore remains OPEN/BLOCKED until an authenticated `tms_app` session is obtained.
