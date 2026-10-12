# IAM Platform — MVP foundation

## Status

- Repository: `alexoaraujo83/TMS`
- Delivery model: incremental changes through pull requests; never commit directly to `main`.
- Identity provider: Auth0 through the existing OIDC/JWT verifier in `@tms/auth`.
- Authorization source of truth: active database membership and tenant-scoped role/permission mappings.
- Database: PostgreSQL with the existing migration chain and tenant RLS.
- This document describes the target and the first code increment; it does not claim production readiness.

## Existing foundations discovered

- `packages/auth`: OIDC access-token verification and membership authorization helpers.
- `packages/security`: permission helper and security headers.
- `packages/tenancy`: tenant context assertions.
- `packages/database/migrations`: IAM roles, permissions, membership role assignment, and RLS foundations.
- `apps/api`: NestJS modular API and request context middleware.
- `.env.example`: Auth0 issuer, JWKS and API audience placeholders.

The MVP must extend these foundations rather than create duplicate identity or tenancy systems.

## Boundaries

1. Auth0 authenticates identities and issues tokens; the API validates issuer, audience, signature, expiry and allowed algorithm.
2. The IAM domain owns internal user linkage, tenant memberships, roles, permissions and access governance.
3. The application API authorizes each protected operation using authoritative membership data. A tenant claim is a selection hint, not proof of membership.
4. PostgreSQL RLS remains an independent isolation boundary for tenant-owned records.
5. The frontend may hide inaccessible actions but is never the authorization enforcement point.

## Policy decision contract

`evaluateAccess` is a pure, deny-by-default policy primitive. It verifies that:
- request fields are present;
- membership exists and is active;
- membership identity matches the authenticated principal;
- membership tenant matches the selected tenant;
- an optional resource tenant matches the selected tenant;
- the exact permission is granted.

Wildcard permission strings are not interpreted by this primitive. Elevated administrative capabilities must be explicit and separately scoped; they must never bypass tenant isolation.

This helper does not verify tokens, fetch membership from the database, or replace RLS. Callers must compose those controls in that order.

## MVP sequence

1. Foundation: document boundaries and add deterministic policy tests.
2. Persistence: review existing IAM migrations, constraints, role mappings and RLS policies before adding schema.
3. OIDC integration: exercise valid and invalid JWTs with Auth0-compatible issuer/audience settings; never log tokens.
4. Membership resolution: load the active user and membership from PostgreSQL using a controlled bootstrap path.
5. API enforcement: protect endpoints with server-side authorization; audit denied sensitive operations without leaking data.
6. Admin console: user, organization, role and permission management with least-privilege controls.
7. Evidence: run CI, integration tests and cross-tenant negative tests before enabling new paths in production.

## Security acceptance gates

- Invalid signature, issuer, audience, expiry or algorithm is rejected.
- Missing, inactive or mismatched membership is denied.
- A permission not granted exactly is denied.
- A resource from another tenant is denied even if a caller submits its identifier.
- Database RLS blocks cross-tenant reads and writes using the runtime database role.
- Permission changes and membership deactivation take effect within a documented revocation/cache window.
- Audit events exclude access tokens, secrets and unnecessary personal data.
- No production migration or deployment occurs as part of a code-only pull request.

## Environment variables

Reuse the existing `AUTH0_ISSUER_BASE_URL`, `AUTH0_JWKS_URL` and `AUTH0_AUDIENCE` configuration. Validate their presence at startup for protected environments. Never add real secrets to repository files or logs.

## Evidence ledger for this increment

| Item | Evidence required | Current state |
|---|---|---|
| Repository inspection | Existing packages, migrations and scripts inspected | Inspected |
| Policy evaluator | Deterministic unit tests added | Added; CI execution pending |
| OIDC | Existing `jose` verifier and security tests inspected | Existing foundation found |
| PostgreSQL/RLS | Runtime cross-tenant tests | Not executed in this increment |
| Auth0 production login | Real token and membership verification | Not executed in this increment |
| Deployment | Production smoke tests | Not performed |
