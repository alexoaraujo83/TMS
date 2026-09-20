# CHAT 08 — Operational Routing — 2026-09-20

**Controller:** MASTER CONTROLLER → CHAT 07 Technical Diagrams → Operational Routing

Discovery/Inventory are not repeated. CHAT 07 is already implemented/reconciled.

## Current canonical evidence

- Repository: `alexoaraujo83/TMS`
- Current main: `675fbaaf11081c721b0a6d9ad0beebca14056353`
- Fresh GitHub CI run: `35481688205`
- CI conclusion: **SUCCESS**
- Route: **CI current → Runtime → Environment parity → Worker/Outbox → Backup/DR → Frontend → Regression**

## 1. CI current — COMPROVADO / E2

Fresh GitHub Actions run for current main:
- run `35481688205`
- workflow `.github/workflows/ci.yml`
- SHA `675fbaaf11081c721b0a6d9ad0beebca14056353`
- conclusion: `success`

Successful quality stages included:
- frozen install
- database migration
- runtime-role provisioning/validation
- RLS with non-bypass runtime role
- IAM runtime resolver
- Worker Durable Jobs PostgreSQL integration
- format fix/check
- lint
- typecheck
- tests
- build

CI current-main gate is therefore **E2 / PASS**.

## 2. Runtime — PARTIAL / P1

### API production

Current READY production deployment:
- deployment `dpl_848SwQxVkd6eWsWVSJj7bKiCugvc`
- commit `d5abedff8c5e986578c5abd1c9b0db71385f6e7a`
- alias `tms-api-snowy.vercel.app`

Direct runtime evidence:
- `/health` → HTTP 200
- `/ready` → HTTP 200
- protected freight route without authentication → HTTP 401

### Web production

Current READY production deployment:
- deployment `dpl_2rgVUQyM7JJADg5afM6Uzc5CJu4V`
- commit `d5abedff8c5e986578c5abd1c9b0db71385f6e7a`
- alias `tms-web-chi.vercel.app`

Direct runtime evidence:
- `/` → HTTP 200
- `/api/auth/login` → Auth0 Authorization Code + PKCE redirect
- protected BFF route without authenticated session → HTTP 401

Production Web/API are reachable and READY, but both are stale versus current main.

## 3. Environment parity — BLOCKED / BLK-001 / P1

Production currently runs `d5abedff...`, while canonical main is `675fbaaf...`.

Preview/non-production runtime evidence also contains Auth0 configuration failures, including missing:
- `AUTH0_DOMAIN`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_CLIENT_ID`
- `AUTH0_SECRET`
- client authentication configuration

These errors are attributed to inspected Preview deployments and are **not generalized to Production**.

Environment parity remains unproven.

**Required next action:** reconcile Production/Preview environment contracts without exposing secrets, then promote current main only after configuration is verified.

## 4. Worker / Outbox — BLOCKED / BLK-002 / P1

Production Railway service `tms-worker` is configured from `alexoaraujo83/TMS` branch `main`, with start command `node apps/worker/dist/main.js`.

Fresh Railway inspection on 2026-09-20 found:
- latest service deployment: `8c7efab7-ceb9-4ac0-9c8e-bb97813a734c` → **SKIPPED**
- that skipped deployment references current main `675fbaaf...`
- latest successful Worker deployment: `c53089c1-5348-4940-ae46-7711f7281cec`
- successful deployment commit: `3ecab2dbbdbeac2c90a06f571683c9ef989d92e3`
- current main therefore has **not** been operationally deployed to this Worker service.

A direct redeploy was attempted, but Railway rejected it because the service's latest deployment is `SKIPPED` and has no build snapshot to copy. The available connected Railway action cannot create the first deployment for this existing service; therefore no false deployment success is recorded.

Worker production workload remains unproven:
- current-main Worker deployment freshness: **BLOCKED**
- active tenant configuration: pending
- actual Outbox event processing: pending
- idempotent handler execution: pending

**Next:** deploy current main to the existing Worker service through Railway's supported deployment path, then capture real workload evidence.

## 5. Backup / DR — PARTIAL / BLK-003 / P1

Fresh Railway evidence proves a successful scheduled backup execution for `tms-backup-worker`:
- deployment `3e59f23e-8fd3-4217-8f34-0e0a9fbf88e9`
- status: **SUCCESS**
- scheduled execution: `0 2 * * *`
- backup start: `20260920T020211Z`
- object: `tms/postgres/20260920T020211Z/tms-20260920T020211Z.dump.enc`
- bytes: `127392`
- SHA-256 recorded
- PostgreSQL: `17.11`
- public tables: `21`
- migration count: `31`
- `backup_status=verified`
- `retention_status=verified`
- retention deleted objects/runs: `0/0`

This upgrades the backup execution/retention evidence to **E2 / COMPROVADO** for the observed run.

The repository backup script verifies required backup configuration, remote object size, checksum, and retention, but it does **not** perform a restore drill. Therefore DR readiness remains incomplete.

Still required:
- independent restore drill
- restore integrity validation
- approved RPO
- approved RTO
- evidence that the restore path is operational

## 6. Frontend / Auth0 — BLOCKED / AUTH0-REAL-TOKEN-01 / P1

Current main uses the Auth0 Next.js server SDK and disables the client-facing access-token endpoint.

Required E2/E3/E4 proof remains:

login → callback/session → server-side token acquisition → Web/BFF → Core API → issuer/audience/signature/expiry → tenant claim → membership → RBAC → tenant-scoped authorization.

No token or secret is persisted in audit evidence.

## 7. Regression — PENDING

Final regression remains:

`format → lint → typecheck → unit → integration → E2E → build → security → smoke → health`

Current CI covers the repository quality/build stages. Authenticated production E2E and operational Worker workload evidence remain downstream gates.

## Blocker matrix

| ID | Area | Priority | Status | Next action |
|---|---|---:|---|---|
| BLK-001 | Environment parity / production freshness | P1 | BLOCKED | reconcile envs and promote current main |
| BLK-002 | Worker freshness / tenant lifecycle | P1 | BLOCKED | deploy current main + prove active workload |
| BLK-003 | Backup/DR | P1 | PARTIAL | execute restore drill + define RPO/RTO |
| BLK-004 | Runtime application coverage | P1 | BLOCKED | authenticated production request |
| BLK-005 | Functional traceability | P1 | BLOCKED | close authenticated E2E path |
| BLK-008 / AUTH0-REAL-TOKEN-01 | Real Auth0 token | P1 | BLOCKED | execute real OIDC flow |

## Decision

CHAT 07 remains **implemented/reconciled**.

Fresh CI evidence upgrades the current-main CI gate to **COMPROVADO / E2**.

Fresh backup evidence upgrades the scheduled backup execution and retention verification to **COMPROVADO / E2** for the observed run, but does not close DR.

The remaining critical dependency is **environment parity + production freshness**, followed by authenticated Auth0 E2E. Worker/Outbox current-main deployment and restore verification remain operational gates.

No diagram, configuration, deployment, or written test is treated as E2/E3/E4 proof by itself.
