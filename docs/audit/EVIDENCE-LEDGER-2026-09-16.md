# TMS — EVIDENCE LEDGER — 2026-09-16

Controller: `MASTER-CONTROLLER-109-2026-09-16.md`
Repository: `alexoaraujo83/TMS`
Branch: `main`

| ID | Stage/Gate | Claim | Evidence | Level | Status | Priority | Next action |
|---|---|---|---|---|---|---|---|
| EV-001 | Controller | Canonical repository and branch | GitHub repository metadata; current `main` HEAD `520b6f3008585bee4334064cd536444be87c5836` | E4 | COMPROVADO | P0 | Keep controller anchored to `main` |
| EV-002 | Database | Canonical Neon main matches migration baseline | Prior live runtime reconciliation: 31 migration rows through `0031_finance_relationship_invariants.sql`; 21 public tables | E4 | COMPROVADO / ALIGNED | P1 | Preserve baseline; no corrective migration from historical 29-row observation |
| EV-003 | Database/RLS | Runtime role is restricted | Prior live reconciliation records `tms_app` LOGIN, non-superuser, non-bypass-RLS, without CREATE on public | E4 | COMPROVADO | P0 | Continue runtime boundary regression |
| EV-004 | Environment | Development differs from canonical baseline | Prior live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-005 | Environment | Staging differs from canonical baseline | Prior live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-006 | API | Production API health is live | Prior live evidence: production `/health` returned HTTP 200 on 2026-09-16; deployment READY | E4 | COMPROVADO | P1 | Complete route/permission/runtime smoke |
| EV-007 | Worker | Worker startup works but latest repository commit deployment is not proven | Prior Railway evidence: worker STARTED/IDLE; latest deployment freshness not proven; zero production tenants; `OUTBOX_TENANT_IDS` unset | E4 | PARTIAL | P1 | Verify intended tenant lifecycle and deployment freshness |
| EV-008 | Backup/DR | Backup implementation exists but production recovery readiness is incomplete | Open Issues #28/#29 retain recurring execution, retention, RPO/RTO and production DR gaps | E3 | PARCIAL | P1 | Validate recurring backup, retention and approved RPO/RTO |
| EV-009 | CI/CD | Quality chain is defined in CI | `.github/workflows/ci.yml`: format:fix → format:check → lint → typecheck → test → build plus runtime RLS/IAM checks | E2 | CONFIGURADO / PENDING FRESH RUN | P1 | Verify latest CI on `520b6f3` |
| EV-010 | Frontend | Frontend is not equivalent to backend completeness | Prior audit: frontend foundation-level; independent route/component/API/auth audit pending | E1 | FOUNDATION / PENDING | P1 | Execute frontend stages 23–25 |
| EV-011 | CHAT 03 | Repository technical inventory exists as concrete monorepo components | Current `main` tree exposes root configs plus `apps/api`, `apps/web`, `apps/worker`, and domain/security/database packages | E1 | INVENTORIED | P1 | Complete orphan/dead-code scan |
| EV-012 | CHAT 04 | Functional inventory can be traced to implemented domains | API `src/common`, health/main, domain modules and packages are present; end-to-end requirement mapping remains incomplete | E1 | PARTIAL / TRACEABILITY PENDING | P1 | Map requirement → API → DB → frontend → test → security → docs |
| EV-013 | CHAT 05 | Project structure conforms to declared pnpm workspace shape | `pnpm-workspace.yaml` declares `apps/*` and `packages/*`; repository has those directories | E2 | COMPROVADO / STRUCTURE ALIGNED | P1 | Continue structure/dependency analysis |
| EV-014 | CHAT 05 | Root toolchain is explicitly pinned | Root toolchain versions are pinned in repository metadata | E1 | CONFIGURED | P2 | Verify CI/runtime compatibility |
| EV-015 | Reconciliation | Controller baseline is current | `main` points to `520b6f3008585bee4334064cd536444be87c5836`; parent is `f12f6ece...` | E4 | RECONCILED | P1 | Use `520b6f3` as current baseline |
| EV-016 | CHAT 32 / Durable Jobs | Lease renewal/heartbeat is implemented | `PgDurableJobStore.renewLease()` renews `available_at`; processor schedules heartbeat at configurable interval and fails closed on renewal failure | E2 | IMPLEMENTED | P1 | Retain Issue #32 only for remaining production/non-noop integration proof |
| EV-017 | CHAT 32 / Durable Jobs | Heartbeat regression tests exist | Worker test suite includes renewal-before-finalization and heartbeat-loss/no-finalization tests | E2 | TEST-COVERED | P1 | Obtain fresh CI execution evidence on current HEAD |
| EV-018 | CHAT 32 / Durable Jobs | A non-noop durable handler exists | `main.ts` registers `external.webhook` through `createDurableWebhookHandler`; handler validates payload and calls `WebhookPublisher.publish()` | E2 | IMPLEMENTED | P1 | Add/verify integration evidence that exercises the real handler path |
| EV-019 | BLOCKER ROUTING | Issue #32's original missing-heartbeat condition is stale relative to current code | Current source already contains heartbeat, renewal and associated tests; Issue #32 still lists the old gap plus a remaining integration requirement | E2 | PARTIALLY RESOLVED / ISSUE STALE | P1 | Reconcile Issue #32 with current implementation after fresh CI/integration evidence |

## Evidence rules

1. Never upgrade E-level without fresh evidence.
2. Every correction must record before/after state and validation.
3. Evidence must identify the exact commit, runtime, environment or command where applicable.
4. Secrets and credential values must never be written to this ledger.
5. Historical evidence remains explicitly historical and cannot be presented as current-main evidence without revalidation.

## Active blockers

### BLK-001 — Environment drift
Development and staging are not aligned with canonical main. Ownership and active consumers are unknown from current evidence. Destructive synchronization is prohibited until resolved.

### BLK-002 — Worker deployment freshness
`tms-worker` is started/idle, but deployment of the current repository commit is not proven. No tenant IDs may be invented merely to force activity.

### BLK-003 — Backup/DR readiness
Implementation and isolated restore evidence exist, but recurring backup execution, retention proof, RPO and RTO are not fully proven.

### BLK-004 — Runtime application coverage
`/health` is proven, but complete route/permission/runtime smoke coverage is pending.

### BLK-005 — Functional traceability
CHAT 04 has structural/domain evidence but not yet an end-to-end requirement-to-operation matrix.

### BLK-006 — Durable Jobs integration evidence
Heartbeat/renewal and tests are present, and a real `external.webhook` handler exists. Fresh CI and an integration execution of that handler are still required before production readiness is upgraded.

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

ACTIVE — CHAT 03/04/05 reconciled and Durable Jobs implementation rechecked. No application code was changed in this pass because the inspected code already contains the previously reported lease-heartbeat correction. The next route remains blocker-driven validation: fresh CI, runtime smoke, environment ownership, backup/DR evidence, frontend audit, and Durable Jobs integration evidence.
