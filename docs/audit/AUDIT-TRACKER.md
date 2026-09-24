# TMS — Audit & Execution Tracker (Current)

> **Status:** LIVE / canonical working list  
> **Last updated:** 2026-09-24  
> **Repository:** `alexoaraujo83/TMS`  
> **Branch:** `main`  
> **Current HEAD:** `fb0025aea93aed9ad134a3266f2e7274fb9bcda5`  
> **Rule:** this file records only concrete evidence already observed, the current state, what I would do next, and the acceptance evidence required to close each item. Unverified items remain OPEN/BLOCKED.

## 1. Current release snapshot

| Component | Concrete evidence now | Effective production state | What I would do |
|---|---|---|---|
| GitHub / main | HEAD is `fb0025aea93aed9ad134a3266f2e7274fb9bcda5` | CANONICAL | Keep this as the source commit for the audit cycle. |
| Vercel API | `tms-core-api` deployment `dpl_616VFpHGy2w5Xs3kU3W4TM2PK2j2` is READY and targets `main` at the current HEAD | CURRENT | Keep as the API production reference for this release. |
| Vercel Web | Current-HEAD deployment `dpl_DMPxo75ykyS3E4xucZjs1Bj4ZesN` is CANCELED with Vercel error link indicating **skipping unaffected projects**. Previous production READY deployment is `6348d2926f0b0cac120ff9350bb77bc0fce0903d`. | EXPECTED COMPONENT DRIFT / NOT A FAILURE | Treat component-specific SHA as intentional. Add an explicit release manifest so Web/API/Worker effective SHAs are always recorded together. |
| Railway worker | Current-HEAD deployment `74c88ebf-7046-4d01-836b-c72847e08255` is SKIPPED. Previous successful worker deployment is `9d938334-b80c-4064-bd40-683620f950a2` at SHA `6348d2926f0b0cac120ff9350bb77bc0fce0903d`. | EFFECTIVE SHA STILL PREVIOUS | Verify Railway watch/build rules and record the effective worker SHA. Do not force a redeploy merely to align SHAs if no worker code changed. |
| Railway backup worker | Deployment `21278249-58dc-4121-85de-d866a71a1003` is SUCCESS at current HEAD | CURRENT | Keep deployment evidence, but separately prove an actual backup execution. |
| CI | Current HEAD has Vercel/Railway status checks reporting success; commit workflow-run wrapper returned no PR workflow runs for this SHA | PARTIAL EVIDENCE | Verify the actual main-branch CI run and record run/job IDs before declaring current-HEAD CI E3. |

## 2. Master execution table

| ID | Area | Concrete today | State | What I would do | Closure evidence | Priority |
|---|---|---|---|---|---|---|
| REL-01 | Release manifest | API is on HEAD; Web and Worker may legitimately remain on previous SHAs because their projects were skipped as unaffected | OPEN | Create a machine-readable release manifest with repo SHA + effective Web/API/Worker SHAs + migration head + config/version references | One release record reconciles all production components | P0 |
| DB-01 | Neon migration head | Repository contains migrations through `0033_durable_job_idempotency.sql`; last independently recorded Neon evidence was migration 0031 | BLOCKED | Re-run live Neon verification when the connector can execute authoritative read-only SQL; verify `schema_migrations` and 0032/0033 checksums | Live DB proves expected migration head and checksums | P0 |
| DB-02 | Migration pipeline | `.github/workflows/database-migrate.yml` runs on migration changes and production environment, but `TMS_ALLOW_EXISTING_SCHEMA_BASELINE=true` is always set | REVIEW | Keep baseline capability but restrict it to an explicit bootstrap/baseline operation, or prove why permanent production enablement is safe | Normal production migration path no longer silently treats an empty `schema_migrations` as canonical baseline, unless explicitly approved | P1 |
| DB-03 | Runtime DB role | Prior production evidence proves API readiness only with `tms_app`; worker role adoption remains pending | PARTIAL | Prove worker connection identity and required grants separately from backup/restore credentials | Worker runtime check shows approved least-privilege role | P1 |
| DB-04 | Behavioral RLS | Structural RLS/FORCE RLS and `NOBYPASSRLS` are documented/proven; direct production cross-tenant behavior under runtime role is still open | BLOCKED | Execute a controlled production-safe cross-tenant read/write denial test using the real runtime role | Cross-tenant operations are denied in production under runtime credentials | P0 |
| AUTH-01 | Auth0 tenant claim | Source-controlled Action defines `https://tms-platform.io/claims/tenant_id`; API revalidates subject + membership | OPEN | Perform fresh Auth0 login/token issuance and trace the real token through Web → API → DB | Fresh token with tenant claim accepted; tenant-scoped operation succeeds; wrong tenant is denied | P0 |
| AUTH-02 | Auth0 configuration parity | Required env vars are consumed by Web/API; exact production values were not independently verified through an Auth0 connector | OPEN | Reconcile production Auth0 tenant/application/API/Action settings with repository contract without exposing secrets | Documented config fingerprint/version + successful E2E token test | P1 |
| API-01 | Protected route coverage | Freight controller has protected business routes; current replay route is also protected | PARTIAL | Build a route/permission matrix and execute smoke tests for each protected family | Every production route has auth, permission, validation and tenant-scope evidence | P1 |
| API-02 | Replay permission | New `POST :id/status-events/:eventId/replay` uses broad `freight:update` permission | NEEDS HARDENING | Introduce a dedicated permission such as `freight:replay`, assign only to explicitly approved roles, and document it | 403 for ordinary update-only users; approved replay role succeeds | P1 |
| API-03 | Replay semantics | Replay creates `replay:<eventId>:<randomUUID>`, so each manual request creates a distinct durable job | NEEDS DECISION | Define whether replay is intentionally repeatable or should be idempotent; preserve audit reason and actor | Documented semantics + tests for repeated replay behavior | P1 |
| API-04 | Replay tests | Source search finds controller/service implementation but no dedicated replay test | OPEN | Add unit/integration tests for success, nonexistent event, aggregate mismatch, payload inconsistency, permission denial, tenant isolation and repeated replay | Targeted test suite passes and is included in CI | P1 |
| API-05 | Replay documentation | Existing project docs list freight status update but not the new replay operation | DOC DRIFT | Update API/operations documentation and state that replay is production capability only after runtime gate is closed | Docs match route, permission and operational controls | P1 |
| WORK-01 | Worker deployment | Current HEAD deployment is SKIPPED; prior successful worker is at 6348; worker process/runtime exists | PARTIAL | Verify why watch rules skip this commit and record effective worker SHA; no forced redeploy unless required | Effective worker version is known and intentional | P1 |
| WORK-02 | Worker business contract | Prior audit found no authoritative contract connecting `freight.status_changed` → outbox → durable job → business handler | BLOCKED | Define the domain event contract before adding speculative handlers or tenant IDs | Source + test + runtime evidence for one real freight event end-to-end | P1 |
| WORK-03 | Worker operational readiness | Worker can be alive with zero configured tenants; metrics are currently insufficient to distinguish idle from broken | OPEN | Add explicit readiness/telemetry for process, DB, role, tenants, outbox, durable jobs and last successful cycle | Dashboard/log evidence distinguishes healthy-idle from unhealthy | P1 |
| WORK-04 | Durable Jobs idempotency | Lease fencing and deterministic external idempotency-key propagation are implemented; receiver-side atomic dedup remains external dependency | PARTIAL / CORRECT | Keep TMS-side key deterministic and collect destination-side proof when real integrations are enabled | Destination proves atomic deduplication for same idempotency key | P1 |
| BAK-01 | Backup execution | Backup worker deployment is SUCCESS, but deployment success does not prove a backup object/checksum/retention run | OPEN | Execute or capture one real scheduled/manual backup and verify artifact, checksum, manifest and retention | Actual backup artifact + verification evidence | P1 |
| DR-01 | Independent restore | Restore-proof branch was reconciled to migration 0031, but this is not an independent restore from the current encrypted backup | OPEN | Restore a real current backup into isolated infrastructure and measure restore steps/time | Restore completes from real artifact with recorded RPO/RTO evidence | P1 |
| ENV-01 | Environment parity | Prior evidence shows development/staging materially behind production and without canonical `schema_migrations` | BLOCKED | Define ownership/consumer intent first; then migrate or retire environments non-destructively | Approved environment matrix + schema/version evidence | P1 |
| ENV-02 | Environment variable contract | Several runtime vars are proven consumers; `.env.example` remains incomplete and some historical vars lack consumers | PARTIAL | Reconcile every variable as required/optional/legacy/documentation-only/indirect | Complete env contract per environment, without secrets | P1 |
| SEC-01 | Tenant isolation architecture | AuthZ + tenant membership + transaction tenant context + PostgreSQL RLS are implemented as defense in depth | STRONG / E3 STRUCTURAL | Preserve architecture; focus on runtime proof instead of rewrite | Production behavioral test closes DB-04 and AUTH-01 | P0 |
| SEC-02 | Runtime config centralization | `packages/config` exists, but API/Auth0/Web/Worker still contain direct `process.env` reads | TECHNICAL DEBT | Centralize operational env parsing and validation, keeping bootstrap exceptions explicit | No uncontrolled runtime env reads outside approved config boundaries | P2 |
| DB-05 | Repository typing | Outbox/Durable Jobs repositories still use `any` for pool/client/row in inspected paths | TECHNICAL DEBT | Replace with `Pool`, `PoolClient` and explicit row interfaces | Typecheck passes with those paths free of `any` | P2 |
| WEB-01 | Frontend structure | `apps/web/src/app/page.tsx` remains monolithic and owns session, health, freight list/form/status/error state | TECHNICAL DEBT | Split into hooks/components/libs without changing behavior first | Same runtime behavior with smaller testable units | P2 |
| WEB-02 | Web/API deployment model | Vercel correctly skipped current Web deploy because the commit is API-only | ACCEPTED / NEEDS DOCUMENTATION | Make component promotion semantics explicit rather than forcing all services onto identical SHAs | Release manifest explains effective SHA per component | P1 |
| DOC-01 | Audit source of truth | Multiple dated audit documents exist; several contain historical states that no longer match current HEAD | PARTIAL | Keep historical records immutable and use this file as the current execution tracker | Every current finding is maintained here; historical docs are labeled by date | P1 |
| DOC-02 | Architecture diagrams | Architecture docs exist, but current audit still benefits from a single C4/context + deployment + ERD + event-flow set | OPEN | Consolidate/refresh diagrams from actual current topology | Diagrams match deployed topology and DB relationships | P2 |
| CI-01 | Current-head CI | Current commit status has external deployment checks; the workflow-run lookup did not return a PR run for HEAD | OPEN | Verify main push CI directly and record exact run/job IDs | Current HEAD format/lint/typecheck/test/build are green | P0 |
| CI-02 | Promotion gates | Web/API/Worker are not necessarily promoted together; component-specific deploy behavior is already observable | OPEN | Define explicit promotion matrix and release gate rules per app | A failed/stale component cannot be mistaken for a complete release | P1 |
| SEC-03 | Security-sensitive replay | Replay is a production mutation that creates durable work and audit records | NEEDS HARDENING | Require dedicated permission, structured reason, rate/approval policy if warranted, and audit coverage | Operationally controlled replay with negative tests and audit evidence | P1 |
| FINAL-01 | Final DoD | Final DoD is not reached while P0/P1 runtime evidence remains open | BLOCKED | Close P0 first, then P1, then rerun regression and documentation reconciliation | All release gates green or formally accepted with evidence | P0 |

## 3. Concrete facts that must not be lost

1. **Do not call Web/Worker SHA drift a defect by itself.** Vercel explicitly reported the current Web deployment as canceled because the project was unaffected; Railway likewise skipped the worker deployment for the API-only commit. The correct control is an effective-component-SHA manifest.
2. **Do not claim Neon is at migration 0033 yet.** Repository HEAD contains 0033; the last recorded live Neon evidence is 0031, and the current connector has not supplied fresh authoritative migration-head evidence.
3. **Do not claim Auth0 production E2E is proven.** Source configuration is evidence of intended behavior, not proof of a freshly issued production token traversing the full chain.
4. **Do not claim backup/DR E4 from deployment success or schema reconciliation alone.** A real backup artifact and independent restore are separate gates.
5. **Do not invent a worker event contract.** If `freight.status_changed` is not the authoritative production contract, define it before implementing a handler.
6. **Do not force deployment merely to align component SHAs.** First determine whether the changed files actually require that component to redeploy.
7. **Do not perform destructive development/staging database synchronization.** Establish environment ownership and consumer intent first.
8. **Do not remove historical audit documents just because they are old.** Mark them historical and maintain this tracker as the current operational state.

## 4. Recommended execution order

### P0 — close these first

1. Current-head CI evidence.
2. Live Neon migration head + 0032/0033 verification.
3. Production behavioral RLS under the real runtime role.
4. Real Auth0 token → Web → API → tenant-scoped DB operation.
5. Effective Web/API/Worker SHA release manifest.

### P1 — then execute

6. Dedicated replay permission + replay semantics + replay tests.
7. Worker runtime identity and worker business-event contract.
8. Real backup execution.
9. Independent restore from current encrypted backup.
10. Environment parity governance.
11. Full protected-route runtime matrix.
12. Documentation reconciliation.

### P2 — after runtime closure

13. Centralize environment configuration.
14. Remove repository `any` debt.
15. Refactor monolithic Web page.
16. Refresh C4/ERD/deployment/event-flow diagrams.

## 5. Definition of done for this tracker

An item may move to **CLOSED/PROVEN** only when the stated closure evidence exists. Source code, a successful deployment, or a document alone is not enough for an operational E3/E4 claim.

**Current overall state: P0/P1 runtime evidence still open. Final DoD not reached.**
