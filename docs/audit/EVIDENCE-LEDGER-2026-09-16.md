# TMS — EVIDENCE LEDGER — 2026-09-16

Controller: `MASTER-CONTROLLER-109-2026-09-16.md`
Repository: `alexoaraujo83/TMS`
Branch: `main`

| ID | Stage/Gate | Claim | Evidence | Level | Status | Priority | Next action |
|---|---|---|---|---|---|---|---|
| EV-001 | Controller | Canonical repository and branch | GitHub repository metadata; current `main` HEAD now reconciled to `8125a025758a17a67a9477331aee3e2b153143ea` | E4 | COMPROVADO | P0 | Keep controller anchored to `main` |
| EV-002 | Database | Canonical Neon main matches migration baseline | Prior live runtime reconciliation: 31 migration rows through `0031_finance_relationship_invariants.sql`; 21 public tables | E4 | COMPROVADO / ALIGNED | P1 | Preserve baseline; no corrective migration from historical 29-row observation |
| EV-003 | Database/RLS | Runtime role is restricted | Prior live reconciliation records `tms_app` LOGIN, non-superuser, non-bypass-RLS, without CREATE on public | E4 | COMPROVADO | P0 | Continue runtime boundary regression |
| EV-004 | Environment | Development differs from canonical baseline | Prior live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-005 | Environment | Staging differs from canonical baseline | Prior live runtime: no `schema_migrations`, 11 public tables | E4 | DRIFTED | P1 | Establish ownership/consumption before synchronization/reset/deletion |
| EV-006 | API | Production API health is live | Prior live evidence: production `/health` returned HTTP 200 on 2026-09-16; deployment READY | E4 | COMPROVADO | P1 | Complete route/permission/runtime smoke |
| EV-007 | Worker | Worker deployment exists and is successful, but runtime is not operationally activated | Railway production service `tms-worker` has latest deployment `1f27c909-27f2-483d-b692-b386e17bb373` with SUCCESS; runtime logs show `configuredTenants=0`, `durableJobsEnabled=false`, `webhookEndpoints=0`, idle because `OUTBOX_TENANT_IDS` is not configured | E4 | PARTIAL / OPERATIONALLY IDLE | P1 | Reconcile intended tenant lifecycle and activation requirements; do not invent tenant IDs |
| EV-008 | Backup/DR | Backup implementation exists but production recovery readiness is incomplete | Open Issues #28/#29 retain recurring execution, retention, RPO/RTO and production DR gaps | E3 | PARCIAL | P1 | Validate recurring backup, retention and approved RPO/RTO |
| EV-009 | CI/CD | Current main quality chain is green | CI #813 run `35164347407` on `a3594140...`; migration, runtime role/RLS/IAM, explicit Durable Jobs integration, format, lint, typecheck, test and build all passed | E4 | COMPROVADO | P1 | Preserve green baseline and continue blocker routing |
| EV-010 | Frontend | Frontend is not equivalent to backend completeness | Prior audit: frontend foundation-level; independent route/component/API/auth audit pending | E1 | FOUNDATION / PENDING | P1 | Execute frontend stages 23–25 |
| EV-011 | CHAT 03 | Repository technical inventory exists as concrete monorepo components | Current `main` tree exposes root configs plus `apps/api`, `apps/web`, `apps/worker`, and domain/security/database packages | E1 | INVENTORIED | P1 | Complete orphan/dead-code scan |
| EV-012 | CHAT 04 | Functional inventory can be traced to implemented domains | API `src/common`, health/main, domain modules and packages are present; end-to-end requirement mapping remains incomplete | E1 | PARTIAL / TRACEABILITY PENDING | P1 | Map requirement → API → DB → frontend → test → security → docs |
| EV-013 | CHAT 05 | Project structure conforms to declared pnpm workspace shape | `pnpm-workspace.yaml` declares `apps/*` and `packages/*`; repository has those directories | E2 | COMPROVADO / STRUCTURE ALIGNED | P1 | Continue structure/dependency analysis |
| EV-014 | CHAT 05 | Root toolchain is explicitly pinned | Root toolchain versions are pinned in repository metadata | E1 | CONFIGURED | P2 | Verify CI/runtime compatibility |
| EV-015 | Reconciliation | Controller baseline is current | `main` advanced from `a3594140...` to `8125a025...` through the Evidence Ledger update; Vercel production deployment is READY on `8125a025...` | E4 | RECONCILED | P1 | Use `8125a025...` as current repository baseline |
| EV-016 | CHAT 32 / Durable Jobs | Lease renewal/heartbeat is implemented | `PgDurableJobStore.renewLease()` renews `available_at`; processor schedules heartbeat at configurable interval and fails closed on renewal failure | E2 | IMPLEMENTED | P1 | Retain Issue #32 only for remaining receiver/operational proof |
| EV-017 | CHAT 32 / Durable Jobs | Heartbeat regression tests exist and execute in green CI | Worker suite includes renewal-before-finalization and heartbeat-loss/no-finalization tests; CI #813 completed successfully | E4 | TEST-COVERED / CI-PROVEN | P1 | Preserve regression coverage |
| EV-018 | CHAT 32 / Durable Jobs | A non-noop durable handler exists | `main.ts` registers `external.webhook` through `createDurableWebhookHandler`; handler validates payload and calls `WebhookPublisher.publish()` | E2 | IMPLEMENTED | P1 | Retain receiver-side contract proof as remaining gap |
| EV-019 | CHAT 32 / Durable Jobs | Webhook publisher fails closed when no endpoints are configured | Commit `318f8c5...` changed behavior to `WEBHOOK_ENDPOINTS_REQUIRED`; current CI remains green | E4 | COMPROVADO | P1 | Keep fail-closed behavior and verify configured-endpoint operations |
| EV-020 | BLOCKER ROUTING | Issue #32 original heartbeat finding is stale relative to current implementation | Current source and CI prove heartbeat/renewal/lease-loss handling; DB-backed path is now directly executed in CI | E4 | RESOLVED FOR DB-PATH | P1 | Narrow Issue #32 to receiver-side idempotency and production operational evidence |
| EV-021 | CHAT 12 / Durable Jobs | Real PostgreSQL Durable Jobs path is executed in CI | CI #813 / run `35164347407`, job `105021964088`, explicitly executed `pnpm --filter @tms/worker exec tsx --test src/durable-jobs.integration.test.ts`; result: 1 passed, 0 failed, 0 skipped. Test exercised persistence → claim → real handler → publisher request with job-ID idempotency key → completion persistence | E4 | COMPROVADO | P1 | Keep receiver-side exactly-once semantics explicitly unclaimed |
| EV-022 | CHAT 13 / Infrastructure | Vercel production is connected to canonical TMS repository and current main | Vercel project `tms-core-api` is linked to `alexoaraujo83/TMS`; latest production deployment `dpl_BLAEsAjrBjCpwrW8hHR9XfzkeJrY` is READY and reports Git SHA `8125a025...`; project domains include `tms-api-snowy.vercel.app` and the main-branch alias | E4 | COMPROVADO | P1 | Complete endpoint/route smoke and environment-variable reconciliation |
| EV-023 | CHAT 13 / Infrastructure | Vercel production shows no grouped runtime errors in the last 24h | Vercel runtime error aggregation for `tms-core-api` returned no runtime errors for the selected 24h window; deployment status-code grouping returned no entries | E4 | COMPROVADO FOR OBSERVED WINDOW | P1 | Add authenticated/business-route smoke; do not treat absence of errors as functional coverage |
| EV-024 | CHAT 13 / Infrastructure | Railway worker is sourced from canonical TMS main and latest deployment is successful | Railway `tms-worker` production config sources `alexoaraujo83/TMS`, branch `main`, Dockerfile build, start command `node apps/worker/dist/main.js`; latest deployment is SUCCESS | E4 | COMPROVADO | P1 | Prove runtime activation semantics and configured tenant lifecycle |
| EV-025 | CHAT 13 / Infrastructure | Railway worker is deployed but intentionally/operationally idle with durable jobs disabled | Latest runtime logs report `configuredTenants=0`, `durableJobsEnabled=false`, `webhookEndpoints=0`, and `reason=OUTBOX_TENANT_IDS is not configured` | E4 | COMPROVADO / BLOCKER | P1 | Determine required production tenant configuration before enabling workload processing |
| EV-026 | CHAT 13 / Infrastructure | Railway project currently contains both TMS worker and backup worker services | Project `tms-backup` production contains `tms-worker`, `tms-backup-worker` and an additional `backup-worker` with no latest deployment; `tms-backup-worker` has cron `0 2 * * *` and SUCCESS latest deployment | E4 | COMPROVADO | P1 | Reconcile service ownership, duplicate backup-worker lifecycle and intended topology |

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

### BLK-002 — Worker activation / tenant lifecycle
The Railway `tms-worker` deployment is now proven successful and sourced from `alexoaraujo83/TMS` `main`, but runtime logs show zero configured tenants, Durable Jobs disabled, zero webhook endpoints and idle state because `OUTBOX_TENANT_IDS` is not configured. Do not invent tenant IDs or enable workload processing without an approved tenant lifecycle/configuration.

### BLK-003 — Backup/DR readiness
Implementation and isolated restore evidence exist, but recurring backup execution, retention proof, RPO and RTO are not fully proven.

### BLK-004 — Runtime application coverage
`/health` is proven, and Vercel production currently reports no grouped runtime errors for the observed 24h window, but complete route/permission/runtime smoke coverage is pending.

### BLK-005 — Functional traceability
CHAT 04 has structural/domain evidence but not yet an end-to-end requirement-to-operation matrix.

### BLK-006 — Durable Jobs external-side-effect evidence
The real PostgreSQL durable-job path is now CI-proven through persistence → claim → handler → publication → finalization. Receiver-side duplicate/retry/idempotency semantics and production webhook endpoint/observability evidence remain unproven. Exactly-once external delivery is not claimed.

### BLK-007 — Infrastructure topology reconciliation
Railway production currently hosts `tms-worker`, `tms-backup-worker`, and an additional `backup-worker` with no latest deployment. Ownership and intended lifecycle of the duplicate/unused-looking backup service are not yet reconciled.

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

ACTIVE — current `main` is `8125a025...`. Vercel production is READY on that exact commit, and Railway `tms-worker` has a successful production deployment sourced from `alexoaraujo83/TMS` `main`. Infrastructure is therefore no longer an unverified deployment concept, but runtime activation remains blocked by zero configured tenants / disabled Durable Jobs and the intended service topology still needs reconciliation. Durable Jobs heartbeat/renewal, fail-closed webhook behavior, and the real PostgreSQL persistence → claim → handler → publication → finalization path remain CI-proven. Environment drift, backup/DR, runtime smoke, functional traceability, receiver-side webhook semantics and infrastructure topology remain open. Next route: CHAT 13 — Infrastructure continues with topology/configuration reconciliation, then advance to CHAT 14 — Environments without bypassing blockers.
