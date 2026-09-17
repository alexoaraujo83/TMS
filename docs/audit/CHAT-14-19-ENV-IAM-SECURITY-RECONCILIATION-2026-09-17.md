# TMS — CHAT 14–19 Environment / IAM / Tenancy / Security Reconciliation — 2026-09-17

## Scope

Blocker-driven execution of CHAT 14–19, covering environment contract, IAM, tenant authority, OIDC/Auth0 verification, authorization, request hardening, and CI/CD evidence relevant to the security boundary.

## Canonical baseline

Repository: `alexoaraujo83/TMS`
Branch: `main`
Current audit baseline at start: `243afe61dc2dde6cfa1379c048bc6f09a97c0651`

A subsequent audit-only commit `fee603c3ffe7b875dfead9f2ae9a2203e7dfe11b` also passed CI run `35238935778` / #821. This validates the documentation addendum, not a production deployment of the application.

## CHAT 14 — Environment boundary

### Evidence

The environment reconciliation already established that development and staging Neon environments differ from the canonical migration baseline. Neither environment may be reset, synchronized, or deleted until ownership and active consumers are established.

The environment-consumer reconciliation also identified production consumers and deployment paths, while leaving development/staging ownership incomplete.

### Classification

**PARCIAL / P1 blocker BLK-001 remains active.**

No destructive synchronization was performed.

## CHAT 15 — Environment variable contract

### Evidence

The runtime contract was reconciled against actual source consumers. API consumers include `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `PORT`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_AUDIENCE`, and `AUTH0_JWKS_URL`. Worker consumers include `DATABASE_URL`, `OUTBOX_TENANT_IDS`, webhook configuration, polling/batch/timeout controls, and `DURABLE_JOBS_ENABLED`.

The `.env.example` remains incomplete for several worker/runtime variables. Several historical variables remain unclassified and must not be deleted solely because no direct consumer was found in the audited paths.

Auth0 audience naming also requires explicit environment-level reconciliation; the code consumes `AUTH0_AUDIENCE` without hard-coding an audience value.

### Classification

**PARCIAL / E2 source-consumer evidence.** Configuration values and secrets remain intentionally unexposed.

## CHAT 16 — GitHub / CI-CD security controls

### Fresh evidence

GitHub Actions run `35167622122` (#820) for HEAD `243afe61dc2dde6cfa1379c048bc6f09a97c0651` completed successfully.

The CI workflow includes deterministic install, migration, ephemeral PostgreSQL role provisioning, runtime-role/RLS/IAM checks, explicit Durable Jobs integration, formatting, lint, typecheck, tests and build.

The migration workflow is separated from CI and targets the production environment using a secret reference without exposing its value; migration concurrency is serialized.

### Gaps

Branch protection could not be independently verified because the integration returned a permissions-related 403 for the branch-protection endpoint. Rulesets were observed as empty. Therefore required checks, mandatory approvals, and push restrictions are **not claimed as proven**.

No explicit development → staging → production promotion workflow was proven from the available workflows.

### Classification

**PARTIAL / P1 operational governance gaps.**

## CHAT 17 — IAM / authentication

`apps/api/src/common/auth.guard.ts` requires a Bearer token, requires OIDC issuer/audience configuration, verifies the access token, requires the tenant claim, rejects an `x-tenant-id` mismatch, checks active tenant membership, and only then creates request authentication context. fileciteturn45file0L2-L2

`packages/auth/src/index.ts` performs JWT verification using JWKS and restricts accepted algorithms to RS256; issuer and audience are validated, and the tenant claim is extracted from the TMS namespaced claim. fileciteturn47file0L2-L2

### Classification

**COMPROVADO STATICALLY / E2.** Live authenticated token verification remains E0 because a fresh production authenticated smoke could not be executed without valid runtime credentials.

## CHAT 18 — Tenant authority / authorization

The API does not trust a tenant header as the source of authority. The authenticated token tenant claim is compared against `x-tenant-id` when supplied, and active membership is verified against the database before request context is established. fileciteturn45file0L2-L2

`PermissionGuard` fails closed when a protected route has no explicit permission declaration and rejects a request whose authenticated context lacks the required permission. fileciteturn46file0L2-L2

Protected business controllers were previously reconciled with explicit permissions for freight, matching and operational resources.

### Classification

**COMPROVADO STATICALLY / E2.** Cross-tenant isolation and 401/403 behavior still require live runtime evidence.

## CHAT 19 — Security hardening

The API bootstrap and request-context middleware were previously reconciled for strict validation, global exception handling, controlled CORS, bounded request IDs and security response headers. Health and readiness are separated; readiness performs a PostgreSQL check and requires the restricted runtime role.

### Classification

**COMPROVADO STATICALLY / E2.** Runtime CORS, validation, headers and readiness behavior remain pending fresh live smoke evidence.

## Blocker routing

1. **BLK-001 Environment drift — P1:** keep environments untouched until ownership/consumer mapping is complete.
2. **BLK-002 Worker activation — P1:** do not invent tenant IDs or enable production Durable Jobs without approved tenant lifecycle and endpoint configuration.
3. **BLK-004 Runtime application coverage — P1:** execute authenticated route matrix when runtime access is available.
4. **BLK-005 Functional traceability — P1:** continue end-to-end requirement mapping.
5. **BLK-008 Live API auth/tenant smoke — P1:** static IAM controls are proven; runtime boundary remains unverified.
6. **BLK-GH-001 Branch governance — P1:** protection/ruleset controls are not independently proven.
7. **BLK-GH-002 Environment promotion — P1:** explicit promotion chain is not proven.

## Regression result

No application code correction was justified by the current evidence. The discovered gaps are primarily runtime-access, environment-governance and operational-proof gaps. No secret, tenant ID, Auth0 audience, webhook endpoint or credential was invented.

The current CI chain is green on `243afe61...` and on the subsequent audit-only commit `fee603c3...`; this does not elevate runtime authentication or production deployment evidence.

## Stage disposition

| Stage | Result | Evidence |
|---|---|---|
| CHAT 14 | PARTIAL | E2/E4 historical environment evidence; ownership unresolved |
| CHAT 15 | PARTIAL | E2 source-consumer contract |
| CHAT 16 | PARTIAL | E4 CI execution; governance/promotion gaps |
| CHAT 17 | COMPROVADO STATICALLY | E2 |
| CHAT 18 | COMPROVADO STATICALLY | E2 |
| CHAT 19 | COMPROVADO STATICALLY | E2 |

## Gate decision

CHAT 14–19 is **not fully closed**. The security source boundary is substantially evidenced, but the operational gate remains blocked by environment ownership/parity and fresh live authenticated runtime proof.

Next route: **CHAT 20–25 Backend/Frontend runtime and API integration**, while retaining the P1 blockers and returning to them through blocker routing whenever runtime evidence or an identified defect becomes actionable.
