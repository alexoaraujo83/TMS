# Vercel ↔ Auth0 Deployment Evidence — 2026-09-26

## Scope

This evidence records the relationship between the Auth0 SDK correction already committed on branch `fix/auth0-production-tenant-contract-2026-09-26` and the Vercel deployment state.

The referenced Vercel TypeScript/Connect SDK documentation was reviewed. Vercel Connect is a connector-token SDK; it is not the Auth0 SDK and it does not generate the TMS tenant claim. The TMS login failure remains an Auth0 Post-Login/tenant-claim contract issue.

## Evidence

### 1. Auth0 SDK correction exists in the repository

The branch contains:

- `@auth0/nextjs-auth0` 4.x;
- explicit `appBaseUrl: process.env.APP_BASE_URL`;
- explicit authorization audience via `AUTH0_AUDIENCE`;
- Next.js 16 App Router/proxy integration.

The correction was committed in:

`29ba3b8b34f17fbd82ebb3208c2afe1f8d5f1aab`

The audit documentation update was committed in:

`70e5e49a97e0ac959dbe46ef028a97f5d4377286`

### 2. The corrected branch is deployed as a Vercel Preview

Vercel reports a READY deployment for the branch:

- branch: `fix/auth0-production-tenant-contract-2026-09-26`
- commit: `70e5e49a97e0ac959dbe46ef028a97f5d4377286`
- state: READY

This demonstrates that the repository correction reached Vercel Preview successfully.

### 3. Production is still on the main branch

The latest Vercel deployment identified with `target=production` is still associated with:

- branch: `main`
- commit: `08b69301b6d020b6049d0bb395628e8616946da8`
- state: READY

Therefore the Auth0 SDK correction is **not yet proven to be present in the production deployment**.

### 4. Production callback failures are observable

Runtime logs for the current production deployment contain multiple:

`GET /auth/callback 500`

events during the observed period.

A `GET /auth/callback 307` was also observed.

The logs do not expose the Auth0 `error_description` value, so these entries alone do not prove that every 500 is the reported `missing_tenant_id` failure. They do prove that the production callback route is currently experiencing server-side failures.

### 5. No grouped Vercel runtime error clusters were present

The Vercel runtime-error aggregation for the last 24 hours returned no runtime error clusters. This does not contradict the callback log entries because the aggregation and raw runtime-log views have different collection/aggregation semantics.

## Interpretation

The current evidence establishes a deployment gap:

`Auth0 SDK correction -> Vercel Preview READY`

but not:

`Auth0 SDK correction -> Vercel Production READY`

Consequently, changing the Auth0 SDK source was necessary to align the Web runtime contract, but it cannot yet be credited as the production fix.

The reported `access_denied / missing_tenant_id` remains independently dependent on the live Auth0 Post-Login Action and trigger binding. Vercel deployment does not publish or bind the Auth0 Action.

## Vercel Connect SDK relevance

The referenced `@vercel/connect` SDK is designed for Vercel Connect integrations and provider-token exchange. It authenticates through the Vercel deployment OIDC token and can retrieve connector credentials at runtime. It is not an alternative to `@auth0/nextjs-auth0`, nor should it be introduced into the TMS login path merely to address the current Auth0 callback failure.

Official reference: https://vercel.com/docs/connect/ts-sdk-reference

## Next controlled step

1. Keep the corrected branch as the validation candidate.
2. Validate the Preview login flow against the intended Auth0 Production tenant only if the test account is authorized for that environment.
3. Reconcile the live Auth0 Post-Login Action and binding.
4. After Auth0 live reconciliation, explicitly promote/deploy the corrected Web commit to Vercel Production.
5. Re-check `/auth/callback` and the complete Web → API → membership → PostgreSQL path.
6. Do not mark AUTH-01 closed until the real Production login and tenant claim are proven.

No secrets, tokens, cookies, or full connection strings are included in this evidence.
