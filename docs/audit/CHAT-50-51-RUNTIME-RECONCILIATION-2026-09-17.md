# TMS — CHAT 50/51 Runtime Reconciliation — 2026-09-17

## Scope
Authentication, authorization, tenant context, protected business routes, API hardening, health/readiness, and live-runtime validation.

## Current repository baseline
GitHub `main` current HEAD observed during this pass: `243afe61dc2dde6cfa1379c048bc6f09a97c0651`.

## Source-level evidence

### Protected business routes
`apps/api/src/modules/freight/freight.controller.ts` applies `AuthGuard` and `PermissionGuard` at controller level. Its business endpoints explicitly declare permissions including `freight:create`, `freight:read`, `matching:read`, `matching:assign`, and `freight:update`.

`apps/api/src/modules/operations/operations.controller.ts` likewise applies both guards and explicitly declares permissions for carrier, driver, vehicle and trip operations.

### Authentication and tenant membership
`apps/api/src/common/auth.guard.ts` requires a Bearer token, requires OIDC issuer/audience configuration, verifies the access token, requires a `tenantId` claim, rejects an `x-tenant-id` mismatch, verifies active tenant membership, and only then populates the request context.

### Authorization
`apps/api/src/common/permission.guard.ts` fails closed when a protected endpoint has no declared permission and rejects requests without the required permission.

### API hardening
`apps/api/src/main.ts` configures strict validation, global exception handling, controlled CORS origins and shutdown hooks. `RequestContextMiddleware` establishes a bounded request ID and security response headers.

### Health/readiness
`/health` reports API health. `/ready` performs a PostgreSQL query and requires the runtime database role to be `tms_app` before returning ready.

## Runtime validation result
A fresh authenticated business-route smoke could not be executed in this pass because current Vercel/Railway connector access did not provide the required runtime access/credentials. Railway service inspection returned HTTP 403. No credentials or tenant IDs were invented.

Therefore:

- Source controls: **E2 / COMPROVADO STATICALLY**.
- `/health` historical live proof: **E4 / COMPROVADO**, dated 2026-09-16.
- Fresh authenticated CRUD/401/403/cross-tenant runtime proof: **E0 / NOT VERIFIED**.
- Exactly-once external delivery: **NOT CLAIMED**.

## Required live matrix

1. `GET /health` → 200.
2. `GET /ready` → 200 with valid database runtime role.
3. Protected business route without Authorization → 401.
4. Malformed/invalid token → 401.
5. Valid token without active tenant membership → 403.
6. Valid token with mismatched `x-tenant-id` → 403.
7. Valid tenant member without required permission → 403.
8. Valid authorized request → expected 2xx.
9. Tenant A cannot read/write Tenant B data → negative isolation test.
10. Validation rejects unknown request fields → 400.
11. CORS allows configured origin and rejects unconfigured origin.
12. Security/request headers are present.

## Blocker decision
No application code correction was justified from the evidence available in this pass. The blocker is evidence access/production runtime validation, not an identified source defect.

## Routing
Remain in blocker routing. Resolve live runtime access for CHAT 50/51, then execute the matrix above. After successful runtime evidence, re-run the regression loop and update the master Evidence Ledger before advancing to the next 109-stage gate.
