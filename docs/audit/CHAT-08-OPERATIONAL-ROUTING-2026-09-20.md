# CHAT 08 — Operational Routing — 2026-09-20

**Controller:** MASTER CONTROLLER → CHAT 07 Technical Diagrams → Operational Routing

Discovery/Inventory are not repeated. CHAT 07 is already implemented on the predecessor audit branch.

## Current canonical evidence

- Repository: `alexoaraujo83/TMS`
- Current main inspected: `675fbaaf11081c721b0a6d9ad0beebca14056353`
- Route: **CI current → Runtime → Environment parity → Worker/Outbox → Backup/DR → Frontend → Regression**

## 1. CI current — PARTIAL / P1

Combined status for `675fbaaf...`:
- Railway tms-worker: SUCCESS
- Railway tms-backup-worker: SUCCESS
- Vercel tms-web: FAILURE
- Vercel tms-core-api: FAILURE

The Vercel failure target reports a build-rate-limit condition. The GitHub Actions connector returned no workflow run associated with the current SHA, so current main is **not classified as E2 CI-green**.

Repository CI contract remains: format → lint → typecheck → integration tests → tests → build.

**Next:** obtain fresh current-main CI/Vercel evidence before declaring CI green.

## 2. Runtime — PARTIAL / P1

### API production
READY deployment:
- `dpl_51exFfBpbsvzdtMPiusZ7nj8TfSs`
- commit `30d0e015e6d1a305ed5c7e4b77199798041def14`
- alias `tms-api-snowy.vercel.app`

Previously recorded: /health 200, /ready 200, protected freight route without auth 401.

### Web production
READY deployment:
- `dpl_8Kzu664D92GAF9HqyemY7jN8k7qi`
- commit `1e9238304b064ae1f00399bb3cbc579216d4a886`
- alias `tms-web-chi.vercel.app`

Previously recorded: / 200, /api/auth/login → Auth0 307/PKCE, /api/tms/freights without session → 401.

Both production deployments are stale versus current main. Real authenticated E2E remains unproven.

## 3. Environment parity — BLOCKED / BLK-001 / P1

Neon TMS project has ready `main`, `development` and `staging` branches. Branch existence/readiness is not parity proof.

Production Web/API are not on current main. Previous audit evidence also records Auth0 configuration failures in preview/non-production deployments. Do not generalize those failures to production without direct evidence.

**Next:** reconcile code commit, env contract, Auth0, API URL/audience/issuer, DB target and promotion path across environments.

## 4. Worker / Outbox — BLOCKED / BLK-002 / P1

Railway `tms-worker`:
- source: `alexoaraujo83/TMS`
- branch: `main`
- Dockerfile: `Dockerfile`
- start: `node apps/worker/dist/main.js`
- current-main deployment attempt: SKIPPED
- latest inspected successful deployment is from older commit `3ecab2db...`

Code implements tenant-scoped Outbox and optional Durable Jobs processing, with PostgreSQL integration coverage.

Deployment existence is not workload activation proof.

**Next:** deploy current main, verify active tenant configuration, and capture actual Outbox/Durable Jobs processing evidence.

## 5. Backup / DR — BLOCKED / BLK-003 / P1

Railway `tms-backup-worker`:
- branch: `main`
- Dockerfile: `infra/backup/Dockerfile`
- cron: `0 2 * * *`
- current-main deployment: SUCCESS

Runtime execution could not be independently inspected because the connected tool returned an authorization error for the backup logs. Therefore recurring execution, retention enforcement, scheduled restore drill, approved RPO and approved RTO remain unproven.

Existing audit evidence establishes isolated restore proof, not full recurring production DR readiness.

**Next:** prove scheduled backup execution, retention and restore drill with credential-safe evidence.

## 6. Frontend / Auth0 — BLOCKED / AUTH0-REAL-TOKEN-01 / P1

Current main uses Auth0 Next.js server SDK and disables the client-facing access-token endpoint.

Required E2/E3/E4 proof remains:
login → callback/session → server-side token acquisition → Web/BFF → Core API → issuer/audience/signature/expiry → tenant claim → membership → RBAC → tenant A allow → tenant B deny.

No token or secret should be persisted in audit evidence.

## 7. Regression — PENDING

Final loop remains:

`format → lint → typecheck → unit → integration → E2E → build → security → smoke → health`

It is downstream of current CI/runtime freshness and authenticated E2E.

## Blocker matrix

| ID | Area | Priority | Status | Next action |
|---|---|---:|---|---|
| BLK-001 | Environment parity | P1 | BLOCKED | reconcile environments |
| BLK-002 | Worker freshness / tenant lifecycle | P1 | BLOCKED | deploy current main + prove active workload |
| BLK-003 | Backup/DR | P1 | BLOCKED | prove recurring backup + restore policy |
| BLK-004 | Runtime application coverage | P1 | BLOCKED | authenticated production request |
| BLK-005 | Functional traceability | P1 | BLOCKED | close authenticated E2E path |
| BLK-008 / AUTH0-REAL-TOKEN-01 | Real Auth0 token | P1 | BLOCKED | execute real OIDC flow |

## Decision

CHAT 07 is **implemented/reconciled**. No further Discovery/Inventory is warranted.

The operational order is fixed:

**CI current → Runtime freshness → Environment parity → Worker/Outbox → Backup/DR → Frontend/Auth0 → Regression**

No diagram, configuration, deployment, or written test is treated as E2/E3/E4 proof by itself.
