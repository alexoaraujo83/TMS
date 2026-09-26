# AUTH0 Production Contract — Tenant Claim / Login Flow

Date: 2026-09-26
Repository: `alexoaraujo83/TMS`
Environment: Auth0 production + Vercel production

## Incident

Production callback:

`/auth/callback?error=access_denied&error_description=missing_tenant_id`

The repository's current Post-Login Action does **not** call `api.access.deny()` when `app_metadata.tenant_id` is missing. It simply omits the TMS tenant claim. Therefore the observed `access_denied / missing_tenant_id` is evidence of configuration/runtime drift in the Auth0 tenant (for example an older deployed Action, another Post-Login Action, or a different active flow), not evidence that the current source-controlled Action emitted that denial.

Auth0 documents that `api.access.deny()` terminates the login and returns `access_denied`, with the supplied message in `error_description`. See the official Auth0 references linked from the audit record.

## Canonical contract

### 1. Auth0 identity

- Auth0 remains the identity provider.
- The TMS application remains authoritative for tenant membership, roles and permissions.
- The production Web application is the Auth0 Regular Web Application.
- The API audience must be the production TMS API audience:
  `urn:tms:api:production`.
- Issuer:
  `https://tms-platform.us.auth0.com/`.
- JWKS:
  `https://tms-platform.us.auth0.com/.well-known/jwks.json`.

### 2. Tenant bridge

The source-controlled Post-Login Action reads:

`event.user.app_metadata.tenant_id`

When it is a non-empty string, it emits the namespaced claim:

`https://tms-platform.io/claims/tenant_id`

into both the Access Token and ID Token.

The Action must **not** use a hard-coded tenant UUID and must **not** accept a tenant selected by the browser.

The Action must **not** call `api.access.deny("missing_tenant_id")` merely because the metadata bridge is absent. Missing tenant membership is an application authorization condition and must not be converted into a hidden Auth0-side tenant assignment.

### 3. API authorization

The API must continue to enforce:

1. valid JWT signature, issuer and production audience;
2. required TMS tenant claim;
3. requested tenant header, when present, exactly matching the authenticated claim;
4. active PostgreSQL membership for `sub + tenant_id`;
5. request context populated only from the verified membership;
6. PostgreSQL transaction-scoped `app.tenant_id`;
7. PostgreSQL RLS as the final isolation boundary.

This is already represented in `apps/api/src/common/auth.guard.ts` and must not be weakened to make login succeed.

### 4. Production Auth0 flow

The effective Production Post-Login flow must contain exactly the intended TMS tenant-claim Action, with no stale Action that denies access for `missing_tenant_id`.

Source of truth:

- `infra/auth0/actions/post-login.js`
- `infra/auth0/tenant.yaml`

The Deploy CLI contract must deploy the Action **and** bind it to the Post-Login trigger. Auth0 explicitly documents that deployment alone does not attach an Action to a trigger.

### 5. Production user precondition

Before validating the complete Web → Auth0 → API → DB flow, the designated test user must have:

`app_metadata.tenant_id = <authoritative TMS tenant UUID>`

and that UUID must correspond to an active TMS membership for the user's Auth0 `sub`.

Do not write credentials, cookies, JWTs, or the tenant UUID into this document.

## Required reconciliation

The following checks must be performed in Auth0 Production before the incident is considered fixed:

- [ ] Identify every Action attached to Post-Login.
- [ ] Identify the deployed version of `TMS — Tenant Claim`.
- [ ] Compare the deployed Action code with `infra/auth0/actions/post-login.js`.
- [ ] Search all active Post-Login Actions for `api.access.deny` and `missing_tenant_id`.
- [ ] Confirm the intended Action is attached to the active Post-Login flow.
- [ ] Confirm the Production Web client is the application initiating the login.
- [ ] Confirm the Production API audience is `urn:tms:api:production`.
- [ ] Confirm the test user's `app_metadata.tenant_id` exists and is the authoritative TMS tenant.
- [ ] Confirm the Auth0 `sub` has an active TMS membership for that tenant.
- [ ] Perform a fresh login after the reconciliation.
- [ ] Capture the newly issued Access Token metadata/claims without storing the token.
- [ ] Confirm `https://tms-platform.io/claims/tenant_id` is present.
- [ ] Confirm Web → API succeeds with that token.
- [ ] Confirm API membership validation succeeds.
- [ ] Confirm DB tenant context/RLS behavior remains enforced.

## Safe correction sequence

1. Export or otherwise record the current Production Post-Login configuration for rollback/audit.
2. Compare the live Action and trigger binding with the repository.
3. Remove/disable only the stale or conflicting Post-Login Action responsible for `missing_tenant_id`.
4. Deploy the source-controlled `TMS — Tenant Claim` Action.
5. Apply the Post-Login trigger binding.
6. Verify the designated test user's tenant metadata and membership.
7. Start a fresh Auth0 session; do not reuse a session created under the denied flow.
8. Validate the complete Web → Auth0 → API → PostgreSQL path.
9. Record only non-secret evidence in the audit tracker.

## Explicit non-actions

Do **not**:

- bypass Auth0;
- put tenant IDs in frontend local storage as an authorization source;
- trust `X-Tenant-Id` independently of the token;
- remove the API membership check;
- disable RLS;
- grant `BYPASSRLS` to `tms_app`;
- use `neondb_owner` as the runtime identity;
- hard-code a production tenant UUID in the Action;
- commit Auth0 secrets or tokens.

## Current repository assessment

**Source contract:** structurally correct.

**Production contract:** NOT YET RECONCILED.

**Incident status:** Auth0 Production drift/configuration mismatch suspected; live Auth0 configuration must be inspected before changing application authorization code.

**DB-04:** remains independent and blocked pending the real `tms_app` behavioral session.

## Official Auth0 references

- Auth0 documents that `api.access.deny()` stops the login flow and prevents completion.
- Auth0 documents that custom Access Token claims can be set from a Post-Login Action.
- Auth0 documents that an Action being deployed does not by itself mean it is attached to the trigger; the trigger binding must also be applied.
