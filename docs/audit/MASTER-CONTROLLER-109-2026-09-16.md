# TMS — MASTER CONTROLLER — 109 ETAPAS

Date: 2026-09-21
Canonical repository: `alexoaraujo83/TMS`
Canonical branch: `main`
Controller mode: ACTIVE

## Control chain

## Current tracker

The live execution list is maintained in [docs/audit/AUDIT-TRACKER.md](./AUDIT-TRACKER.md). This controller remains the 109-stage sequence; the tracker is the current evidence/status ledger and must be updated whenever a finding changes state.


MASTER CONTROLLER → 109 ETAPAS → EVIDENCE LEDGER → BLOCKER ROUTING → REGRESSION LOOP → FINAL DoD

## Operating rule

The 109 stages are the canonical operational sequence defined in the TMS Prompts Operacionais Master. Existing audit evidence is reused, but a stage is not marked CONCLUÍDO/COMPROVADO merely because an implementation or document exists. Evidence must satisfy the applicable E0–E4 level.

Required cycle:

DISCOVER → ANALYZE → CLASSIFY → CORRECT → CLEAN → REFACTOR → TEST → VALIDATE → DOCUMENT → EVIDENCE → NEXT

## Current execution state

CHAT 03–05 — EXECUTED / inventory and workspace structure confirmed.

CHAT 06 — Architecture 360° / AUD-004 — EXECUTED / architecture and infrastructure reconciliation advanced.

Current routing is no longer discovery. Execution is in blocker-driven regression/release-gate mode:

CI current HEAD → runtime freshness → environment parity → worker/outbox → backup/DR → frontend/Auth0 → regression → FINAL DoD gate.

## Evidence levels

- E0 — not verified
- E1 — existence
- E2 — execution proven
- E3 — integration proven
- E4 — operation proven

## Current evidence baseline

### CI

Current application HEAD:
`f9bb9d4225a777f4c2bc899c4008e2e0b2dd4d91`

GitHub Actions CI run:
`35554413967`

Quality job:
`106195137392`

Conclusion: SUCCESS. Migration, CI-role provisioning, runtime-role validation, RLS runtime integration, IAM runtime resolver, Durable Jobs PostgreSQL integration, format/lint/typecheck/test/build all passed in CI.

Status: COMPROVADO — E3 for CI/integration boundary.

### Production API/Web

Production API health endpoint returns HTTP 200 with `{"status":"ok","service":"tms-api"}`.

Production Web endpoint returns HTTP 200 and exposes the TMS/Auth0 login surface.

Status: COMPROVADO — E2 runtime availability.

Authenticated production `/freights` and real Auth0 tenant-claim E2E remain separate gates.

### Production database

Neon production main:
`shiny-hall-34679912 / br-lingering-shadow-act0vvi9`

Canonical migration state: 31 migrations through `0031_finance_relationship_invariants.sql`.

Critical production tables have RLS + FORCE RLS. `tms_app` is LOGIN/NOSUPERUSER/NOBYPASSRLS with runtime DML and without migration-write privileges.

Status: structural security COMPROVADO — E3.

Behavioral cross-tenant runtime proof remains OPEN because the available SQL execution surface cannot switch the session to `tms_app`; a prior `SET LOCAL ROLE tms_app` attempt was denied.

### DR schema reconciliation

Isolated branch `stage10.11-restore-proof-safe` was reconciled from 28 to 31 migrations with `0029`, `0030`, and `0031`.

Post-migration checksums, runtime-role hardening, relationship constraints, RLS/Force-RLS and schema comparison were verified.

Status: schema parity COMPROVADO — E3.

Independent restore from the current encrypted backup remains OPEN.

## Active blockers

1. **BLK-ENV-PARITY-01 — Environment parity (P1):** development and staging each contain 11 legacy public tables and no `schema_migrations`; production contains 21 canonical public tables and 31 migrations. Ownership/consumer intent exists only partially; automatic destructive synchronization is prohibited.
2. **BLK-RLS-E4-01 — Production behavioral RLS (P1):** structural RLS and non-bypass runtime-role configuration are proven, but production cross-tenant behavior under `tms_app` is not directly executed.
3. **BLK-WORKER-01 — Worker business contract (P1):** Durable Jobs runtime is enabled and the worker processor exists, but no authoritative freight-domain event contract was found connecting `freight.status_changed` → outbox → durable job → business handler. No speculative event type/payload/handler will be invented.
4. **BLK-BACKUP-RUNTIME-01 — Backup execution evidence (P1):** backup worker deployment is SUCCESS, but deployment logs do not prove a completed backup object, checksum, retention result or recurring execution.
5. **DR-RESTORE-E4 — Independent restore (P1):** isolated schema reconciliation is proven, but an independent restore from the current encrypted backup and its operational timing evidence are not proven.
6. **AUTH0-REAL-TOKEN-01 — Auth0 production E2E (P1):** source-controlled Action and API authorization contract are coherent, but a real newly issued access token containing `https://tms-platform.io/claims/tenant_id`, accepted by production API and reaching a tenant-scoped DB operation, is not proven.
7. **BLK-RUNTIME-COVERAGE-01 — Runtime route coverage (P1):** API/Web availability is proven; complete protected-route, permission and tenant-scoped smoke coverage remains pending.
8. **BLK-DEEP-STRUCTURAL-01 — Deep structural analysis (P2):** file-level orphan/dead-code and circular-dependency analysis remain incomplete.

## Worker gate

Durable Jobs runtime was explicitly enabled on Railway `tms-worker`.

Verified runtime evidence on successful deployment `e1db84a3-9e75-4174-8370-104682bc366f`:
- `durableJobsEnabled=true`
- `configuredTenants=1`
- runtime database role verification = `tms_app`
- tenant verification = 1
- durable-job batch completed with claimed/completed/failed = 0/0/0

The zero-job result is not a failure; it means no eligible durable job was available.

Current repository source inspection still finds no authoritative freight-status domain event contract. Do not force a worker deployment or fabricate `OUTBOX_TENANT_IDS` merely to create activity.

## Environment parity gate

Read-only Neon evidence:

| Environment | Public tables | schema_migrations | durable_jobs |
|---|---:|---|---|
| Production main | 21 | yes | yes |
| Development | 11 | no | no |
| Staging | 11 | no | no |
| Restore-proof-safe | canonical after reconciliation | yes | yes |

Development/staging are therefore materially behind production. No destructive reset, deletion or blind migration has been performed.

## Backup/DR gate

Backup implementation performs encrypted dump, SHA256/manifest verification, upload and retention handling.

Latest verified backup-worker deployment:
`71784d43-8d6b-49a5-8838-03303438beda`
Status: SUCCESS.

Deployment logs did not provide execution evidence. Therefore deployment success is not promoted to backup-operation E4.

The isolated restore-proof branch has been reconciled to migration 0031, but this is not equivalent to proving an independent restore from the current encrypted backup.

## Auth0 gate

Source-controlled desired state defines:
- Post Login Action `TMS — Tenant Claim`
- claim `https://tms-platform.io/claims/tenant_id`
- tenant source `event.user.app_metadata.tenant_id`
- API membership revalidation against Auth0 subject + tenant membership.

This is implementation/source evidence only. The actual Auth0 tenant state and a fresh production token are not independently verified through the available connector surface.

## Regression loop

For every code/configuration correction:

1. Reproduce the finding.
2. Apply the smallest safe correction.
3. Run targeted regression tests.
4. Run format/lint/typecheck/test/build as applicable.
5. Verify the affected runtime/integration boundary.
6. Record evidence and update blocker status.
7. Re-enter the 109-stage sequence only after the blocker is cleared or formally documented.

## Current release-gate matrix

| Gate | Status | Evidence |
|---|---|---|
| CI current application HEAD | PASS | E3 |
| API runtime | PASS | E2 |
| Web runtime | PASS | E2 |
| Production schema/migrations | PASS | E3 |
| RLS structural controls | PASS | E3 |
| DR isolated schema reconciliation | PASS | E3 |
| Environment parity | BLOCKED | E1/E2 |
| Behavioral production RLS | BLOCKED | E3 structural / E4 pending |
| Worker runtime | PASS on prior application deployment | E2 |
| Worker business contract | BLOCKED | contract absent |
| Backup deployment | PASS | E2 |
| Backup execution | OPEN | E0/E1 |
| Independent restore | OPEN | E3 schema proof / E4 pending |
| Auth0 real-token E2E | OPEN | source/code only |
| Full protected-route runtime regression | OPEN | partial |
| Final DoD | BLOCKED | P1 blockers remain |

## Next execution route

Do not repeat Discovery/Inventory.

1. Regression/release-gate verification.
2. Attempt only safe executable runtime evidence for protected routes.
3. Keep RLS E4, Auth0 E2E, backup execution and independent restore explicitly open when direct proof is unavailable.
4. Resolve environment parity only through governed, non-destructive migration/ownership decisions.
5. Resolve Worker only after an authoritative domain event contract exists.
6. Update Evidence Ledger and return to the 109-stage sequence only after the affected gate changes state.

## FINAL DoD

FINAL DoD is **NOT REACHED**.

The controller may only enter FINAL DoD after P0/P1 blockers are resolved or formally accepted, critical regression is green, environments are reconciled or explicitly governed, security/tenancy boundaries are evidenced, backup/restore is proven to the required operational target, and documentation/evidence are current.
