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

Code and CI provide PostgreSQL Durable Jobs integration evidence.

Production workload remains unproven:
- current-main Worker deployment freshness: pending
- active tenant configuration: pending
- actual Outbox event processing: pending
- idempotent handler execution: pending

**Next:** deploy current main to Worker and capture real workload evidence.

## 5. Backup / DR — BLOCKED / BLK-003 / P1

Backup worker code/deployment path exists, but production DR readiness remains unproven.

Still required:
- scheduled backup execution
- retention enforcement
- verified backup status
- restore drill
- approved RPO
- approved RTO

No claim of recurring production DR readiness is made without fresh runtime evidence.

## 6. Frontend / Auth0 — BLOCKED / AUTH0-REAL-TOKEN-01 / P1

Current main uses the Auth0 Next.js server SDK and disables the client-facing access-token endpoint.

Required E2/E3/E4 proof remains:

login → callback/session → server-side token acquisition → Web/BFF → Core API → issuer/audience/signature/expiry → tenant claim → membership → RBAC → tenant-scoped authorization.

No token or secret is persisted in audit evidence.

## 7. Regression — PENDING

Final regression remains:

`format → lint → typecheck → unit → integration → E2E → build → security → smoke → health`

Current CI covers the repository quality/build stages. Authenticated production E2E and operational workload evidence remain downstream gates.

## Blocker matrix

| ID | Area | Priority | Status | Next action |
|---|---|---:|---|---|
| BLK-001 | Environment parity / production freshness | P1 | BLOCKED | reconcile envs and promote current main |
| BLK-002 | Worker freshness / tenant lifecycle | P1 | BLOCKED | deploy current main + prove active workload |
| BLK-003 | Backup/DR | P1 | BLOCKED | prove recurring backup + restore policy |
| BLK-004 | Runtime application coverage | P1 | BLOCKED | authenticated production request |
| BLK-005 | Functional traceability | P1 | BLOCKED | close authenticated E2E path |
| BLK-008 / AUTH0-REAL-TOKEN-01 | Real Auth0 token | P1 | BLOCKED | execute real OIDC flow |

## Decision

CHAT 07 remains **implemented/reconciled**.

Fresh CI evidence upgrades the current-main CI gate to **COMPROVADO / E2**.

The remaining critical dependency is **environment parity + production freshness**, followed by authenticated Auth0 E2E. Worker/Outbox and Backup/DR remain downstream operational gates.

No diagram, configuration, deployment, or written test is treated as E2/E3/E4 proof by itself.
