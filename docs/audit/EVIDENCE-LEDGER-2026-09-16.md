# TMS — EVIDENCE LEDGER — 2026-09-16

Controller: `MASTER-CONTROLLER-109-2026-09-16.md`
Repository: `alexoaraujo83/TMS`
Branch: `main`

| ID | Stage/Gate | Claim | Evidence | Level | Status | Priority | Next action |
|---|---|---|---|---|---|---|---|
| EV-001 | Controller | Canonical repository and branch | GitHub repository metadata; default branch `main`; current HEAD observed as `f12f6ece...` | E2 | COMPROVADO | P0 | Keep controller anchored to `main` |
| EV-002 | Database | Canonical Neon main matches migration baseline | Live runtime reconciliation: 31 migration rows through `0031_finance_relationship_invariants.sql`; 21 public tables | E4 | COMPROVADO / ALIGNED | P1 | Preserve baseline; do not create corrective migration for historical 29-row observation |
| EV-003 | Database/RLS | Runtime role is restricted | Live reconciliation records `tms_app` LOGIN, non-superuser, non-bypass-RLS, without CREATE on public | E4 | COMPROVADO | P0 | Continue runtime boundary regression |
| EV-004 | Environment | Development differs from canonical baseline | Live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-005 | Environment | Staging differs from canonical baseline | Live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-006 | API | Production API health is live | Vercel production `/health` returned HTTP 200 on 2026-09-16; deployment READY | E4 | COMPROVADO | P1 | Complete route/permission/runtime smoke |
| EV-007 | Worker | Worker startup works but latest repository commit deployment is not proven | Railway evidence: worker STARTED/IDLE; current commit deployment event skipped; zero production tenants; `OUTBOX_TENANT_IDS` unset | E4 | PARTIAL | P1 | Verify intended tenant lifecycle and redeploy only when justified |
| EV-008 | Backup/DR | Backup implementation exists but production recovery readiness is incomplete | Current audit explicitly retains missing independent recurring execution, RPO/RTO and production DR proof | E3 | PARCIAL | P1 | Execute/record independent backup, retention and restore evidence |
| EV-009 | CI/CD | Quality chain is defined in CI | `.github/workflows/ci.yml`: format:fix → format:check → lint → typecheck → test → build, plus runtime RLS/IAM checks | E2 | CONFIGURADO | P1 | Verify latest green execution on current HEAD |
| EV-010 | Frontend | Frontend is not equivalent to backend completeness | Current audit: frontend foundation-level; independent route/component/API/auth audit pending | E1 | FOUNDATION / PENDING | P1 | Execute frontend stages 23–25 |

## Evidence rules

1. Never upgrade E-level without fresh evidence.
2. Every correction must record before/after state and validation.
3. Evidence must identify the exact commit, runtime, environment or command where applicable.
4. Secrets and credential values must never be written to this ledger.
5. Historical evidence remains explicitly historical and cannot be presented as current-main evidence without revalidation.

## Active blockers

### BLK-001 — Environment drift

Development and staging are not aligned with canonical main. Ownership and active consumers are unknown from the current evidence. Destructive synchronization is prohibited until this is resolved.

### BLK-002 — Worker deployment freshness

`tms-worker` is started/idle, but deployment of the latest repository commit is not proven. No tenant IDs may be invented or inserted merely to force activity.

### BLK-003 — Backup/DR readiness

Implementation and isolated restore evidence exist, but recurring backup execution, complete retention proof, RPO and RTO are not fully proven.

### BLK-004 — Runtime application coverage

`/health` is proven, but complete route/permission/runtime smoke coverage is pending.

## Regression loop

For every code/configuration correction:

1. Reproduce the finding.
2. Apply the smallest safe correction.
3. Run targeted regression tests.
4. Run format/lint/typecheck/test/build as applicable.
5. Verify the affected runtime/integration boundary.
6. Record evidence and update blocker status.
7. Re-enter the 109-stage sequence only after the blocker is cleared or formally documented.

## Ledger state

The ledger is ACTIVE. Existing evidence is retained and mapped to the controller; the controller will not reset the audit merely because the 109-stage model is newly formalized.
