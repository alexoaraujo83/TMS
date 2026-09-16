# TMS — EVIDENCE LEDGER — 2026-09-16

Controller: `MASTER-CONTROLLER-109-2026-09-16.md`
Repository: `alexoaraujo83/TMS`
Branch: `main`

| ID | Stage/Gate | Claim | Evidence | Level | Status | Priority | Next action |
|---|---|---|---|---|---|---|---|
| EV-001 | Controller | Canonical repository and branch | GitHub repository metadata; current `main` HEAD `bb8c978182d2e447bc1e725920d0e641870b48e2` | E4 | COMPROVADO | P0 | Keep controller anchored to `main` |
| EV-002 | Database | Canonical Neon main matches migration baseline | Prior live runtime reconciliation: 31 migration rows through `0031_finance_relationship_invariants.sql`; 21 public tables | E4 | COMPROVADO / ALIGNED | P1 | Preserve baseline; no corrective migration from historical 29-row observation |
| EV-003 | Database/RLS | Runtime role is restricted | Prior live reconciliation records `tms_app` LOGIN, non-superuser, non-bypass-RLS, without CREATE on public | E4 | COMPROVADO | P0 | Continue runtime boundary regression |
| EV-004 | Environment | Development differs from canonical baseline | Prior live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-005 | Environment | Staging differs from canonical baseline | Prior live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-006 | API | Production API health is live | Prior live evidence: production `/health` returned HTTP 200 on 2026-09-16; deployment READY | E4 | COMPROVADO | P1 | Complete route/permission/runtime smoke |
| EV-007 | Worker | Worker startup works but latest repository commit deployment is not proven | Prior Railway evidence: worker STARTED/IDLE; latest deployment freshness not proven; zero production tenants; `OUTBOX_TENANT_IDS` unset | E4 | PARTIAL | P1 | Verify intended tenant lifecycle and deployment freshness |
| EV-008 | Backup/DR | Backup implementation exists but production recovery readiness is incomplete | Open Issues #28/#29 retain recurring execution, retention, RPO/RTO and production DR gaps | E3 | PARCIAL | P1 | Validate recurring backup, retention and approved RPO/RTO |
| EV-009 | CI/CD | Current main quality chain is green | CI #809 run `35163720743` on HEAD `bb8c978...`; quality job completed successfully; migration, role/RLS/IAM checks, format, lint, typecheck, test and build all passed | E4 | COMPROVADO | P1 | Preserve green baseline and continue blocker routing |
| EV-010 | Frontend | Frontend is not equivalent to backend completeness | Prior audit: frontend foundation-level; independent route/component/API/auth audit pending | E1 | FOUNDATION / PENDING | P1 | Execute frontend stages 23–25 |
| EV-011 | CHAT 03 | Repository technical inventory exists as concrete monorepo components | Current `main` tree exposes root configs plus `apps/api`, `apps/web`, `apps/worker`, and domain/security/database packages | E1 | INVENTORIED | P1 | Complete orphan/dead-code scan |
| EV-012 | CHAT 04 | Functional inventory can be traced to implemented domains | API `src/common`, health/main, domain modules and packages are present; end-to-end requirement mapping remains incomplete | E1 | PARTIAL / TRACEABILITY PENDING | P1 | Map requirement → API → DB → frontend → test → security → docs |
| EV-013 | CHAT 05 | Project structure conforms to declared pnpm workspace shape | `pnpm-workspace.yaml` declares `apps/*` and `packages/*`; repository has those directories | E2 | COMPROVADO / STRUCTURE ALIGNED | P1 | Continue structure/dependency analysis |
| EV-014 | CHAT 05 | Root toolchain is explicitly pinned | Root toolchain versions are pinned in repository metadata | E1 | CONFIGURED | P2 | Verify CI/runtime compatibility |
| EV-015 | Reconciliation | Controller baseline is current | `main` points to `bb8c978182d2e447bc1e725920d0e641870b48e2`; parent is `318f8c561a6581b23544dc4c1aff06c60ed26e14` | E4 | RECONCILED | P1 | Use `bb8c978` as current baseline |
| EV-016 | CHAT 32 / Durable Jobs | Lease renewal/heartbeat is implemented | `PgDurableJobStore.renewLease()` renews `available_at`; processor schedules heartbeat at configurable interval and fails closed on renewal failure | E2 | IMPLEMENTED | P1 | Retain Issue #32 only for remaining integration/idempotency proof |
| EV-017 | CHAT 32 / Durable Jobs | Heartbeat regression tests exist and execute in green CI | Worker suite includes renewal-before-finalization and heartbeat-loss/no-finalization tests; CI #809 completed successfully | E4 | TEST-COVERED / CI-PROVEN | P1 | Add DB-backed integration execution |
| EV-018 | CHAT 32 / Durable Jobs | A non-noop durable handler exists | `main.ts` registers `external.webhook` through `createDurableWebhookHandler`; handler validates payload and calls `WebhookPublisher.publish()` | E2 | IMPLEMENTED | P1 | Add/verify integration evidence exercising the real handler path |
| EV-019 | CHAT 32 / Durable Jobs | Webhook publisher fails closed when no endpoints are configured | Commit `318f8c5...` changed behavior to `WEBHOOK_ENDPOINTS_REQUIRED`; commit `bb8c978...` added regression coverage; CI #809 is green | E4 | COMPROVADO | P1 | Keep fail-closed behavior and verify configured-endpoint integration |
| EV-020 | BLOCKER ROUTING | Issue #32 original heartbeat finding is stale relative to current implementation | Current source and CI prove heartbeat/renewal/lease-loss handling; remaining gap is DB-backed real-handler/integration and idempotency evidence | E4 | PARTIALLY RESOLVED / ISSUE STALE | P1 | Reconcile Issue #32 text and retain it open until integration proof exists |

## Evidence rules

1. Never upgrade E-level without fresh evidence.
2. Every correction must record before/after state and validation.
3. Evidence must identify the exact commit, runtime, environment or command where applicable.
4. Secrets and credential values must never be written to this ledger.
5. Historical evidence remains explicitly historical and cannot be presented as current-main evidence without revalidation.
6. A green unit/integration CI chain does not by itself prove production external-side-effect semantics.

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
Current main is CI-green and heartbeat/fail-closed behavior is proven. A DB-backed execution of `external.webhook` through persistence → claim → handler → publication → finalization, plus duplicate/idempotency behavior at the receiver boundary, is still not proven.

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

ACTIVE — current `main` is `bb8c978...` and CI #809 is green. Durable Jobs heartbeat/renewal and fail-closed webhook behavior are now CI-proven. The remaining blocker is specifically integration/idempotency evidence for the real durable webhook path; environment drift, worker deployment freshness, backup/DR, runtime smoke and functional traceability also remain open. Next route: reconcile Issue #32, then execute the DB-backed Durable Jobs integration proof before advancing to infrastructure/environment gates.
