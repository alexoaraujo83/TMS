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

The last successful Worker startup emitted:
- `configuredTenants=1`
- `durableJobsEnabled=false`
- runtime role verification: `tms_app`
- `worker.tenants_verified` with one configured tenant

Current read-only Neon evidence on the production/default database reports:
- active tenants: `1`
- ready pending Outbox events: `0`
- failed Outbox events: `0`
- ready pending Durable Jobs: `0`
- failed Durable Jobs: `0`

These database counts do not prove that the current-main Worker is deployed or that it processed workload.

Worker production workload therefore remains unproven:
- current-main Worker deployment freshness: **BLOCKED**
- active tenant configuration on current deployment: pending
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

This upgrades the backup execution/retention evidence to **E2 / COMPROVADO** for the observed scheduled run.

### Restore evidence

The repository contains a documented isolated Neon restore drill:
- recovery branch reached `ready`
- restore was performed with `finalize: false`
- isolated branch remained non-primary/non-default
- PostgreSQL `17.11`
- `21` public base tables
- `28` migration rows in the historical recovery point
- `10/10` critical TMS tables validated
- no destructive SQL was executed against production

The drill documentation classifies the **restore mechanism and safe isolated restore as PROVEN**, but also records that production backup/recovery readiness is not fully proven because recurring recovery policy, ownership, approved RPO/RTO, and the current scheduled recovery procedure remain unresolved.

The current backup script verifies required configuration, remote object size, checksum, and retention; the separate `restore-verify.sh` provides an isolated restore path but was not executed against today's encrypted backup during this audit cycle.

Therefore:
- scheduled backup execution: **E2 / COMPROVADO**
- object/retention verification for observed run: **E2 / COMPROVADO**
- isolated restore mechanism: **previously PROVEN**
- today's backup restore: **NOT VALIDATED**
- approved RPO/RTO: **ABSENT**
- full production DR readiness: **BLOCKED**

## 6. Frontend / Auth0 — BLOCKED / AUTH0-REAL-TOKEN-01 / P1

Current main uses the Auth0 Next.js server SDK and disables the client-facing access-token endpoint.

Required E2/E3/E4 proof remains:

login → callback/session → server-side token acquisition → Web/BFF → Core API → issuer/audience/signature/expiry → tenant claim → membership → RBAC → tenant-scoped authorization.

No token or secret is persisted in audit evidence.

## 7. Regression — PENDING

Final regression remains:

`format → lint → typecheck → unit → integration → E2E → build → security → smoke → health`

Current CI covers the repository quality/build stages. Authenticated production E2E and current-main Worker workload evidence remain downstream gates.

## Blocker matrix

| ID | Area | Priority | Status | Next action |
|---|---|---:|---|---|
| BLK-001 | Environment parity / production freshness | P1 | BLOCKED | reconcile envs and promote current main |
| BLK-002 | Worker freshness / tenant lifecycle | P1 | BLOCKED | deploy current main + prove active workload |
| BLK-003 | Backup/DR | P1 | PARTIAL/BLOCKED | validate current backup restore + define RPO/RTO |
| BLK-004 | Runtime application coverage | P1 | BLOCKED | authenticated production request |
| BLK-005 | Functional traceability | P1 | BLOCKED | close authenticated E2E path |
| BLK-008 / AUTH0-REAL-TOKEN-01 | Real Auth0 token | P1 | BLOCKED | execute real OIDC flow |

## Decision

CHAT 07 remains **implemented/reconciled**.

Fresh CI evidence upgrades the current-main CI gate to **COMPROVADO / E2**.

Fresh backup evidence upgrades the scheduled backup execution and retention verification to **COMPROVADO / E2** for the observed run.

The historical isolated Neon restore drill proves that the recovery mechanism can restore and validate a recovery point without replacing production, but it does not prove today's backup restore or establish an approved production DR target.

The Worker service remains the immediate operational deployment blocker because Railway's connected redeploy operation cannot redeploy a skipped deployment without a build snapshot.

The remaining critical dependency chain is:

**environment parity → current-main production freshness → Worker current-main deployment → authenticated Auth0 E2E → current-backup restore validation → final regression.**

No diagram, configuration, deployment, or written test is treated as E2/E3/E4 proof by itself.
