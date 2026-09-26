# AUTH-01 — Auth0 Production Reconciliation Runbook

## Purpose

Identify the live Auth0 Production configuration responsible for the observed
`access_denied / missing_tenant_id` callback and reconcile it with the
source-controlled TMS contract without weakening API authorization.

## Preconditions

- Do not record client secrets, access tokens, refresh tokens, cookies, or full connection strings.
- Use a dedicated Auth0 Management/Deploy CLI application for tenant configuration.
- Prefer read-only inspection first.
- Do not change the TMS API AuthGuard, RLS, database grants, or tenant authorization to work around this incident.

## 1. Inspect the live Post-Login flow

Record only:
- Action display name;
- Action ID;
- deployed/published status;
- trigger version;
- binding order;
- last modified timestamp;
- application/client association where visible.

Determine whether `TMS — Tenant Claim` is actually bound to the Production Post-Login trigger.

## 2. Search all live Post-Login Actions

Inspect every Action bound to the Production Post-Login flow.

Search its source/deployed code for:
- `api.access.deny`;
- `missing_tenant_id`;
- tenant metadata checks;
- uncaught access to possibly undefined user properties.

The repository search currently finds no `api.access.deny` or `missing_tenant_id` in source control. Therefore a live match is evidence of Production drift unless the repository is later shown to be incomplete.

Auth0 documents that `api.access.deny()` produces `access_denied` and uses its message as `error_description`. It also documents that runtime errors in Actions can surface as `access_denied`, so inspect both explicit deny calls and uncaught Action errors.

## 3. Compare the intended Action

Expected source-controlled behavior:
- read `event.user.app_metadata.tenant_id`;
- if it is a non-empty string, emit the namespaced tenant claim;
- do not deny login merely because the metadata bridge is absent;
- API remains responsible for membership authorization.

Expected claim:
`https://tms-platform.io/claims/tenant_id`

## 4. Inspect the test user

Confirm, without exposing unrelated profile data:
- Auth0 subject identifier;
- presence of `app_metadata.tenant_id`;
- tenant UUID value matches the intended TMS tenant;
- corresponding TMS membership exists and is active.

Do not write tenant metadata until the current live state has been captured for rollback/audit.

## 5. Inspect client/API contract

Confirm the Production Web application uses:
- the intended Auth0 tenant/domain;
- callback URL registered for the deployed Web application;
- logout URL registered for the deployed Web application;
- API audience `urn:tms:api:production`;
- issuer corresponding to the TMS Auth0 tenant.

Do not expose client secrets in evidence.

## 6. Safe correction

Only after the live drift is identified:
1. export/capture current live configuration for rollback;
2. run the repository's Deploy CLI import with `--dry-run`;
3. review proposed Action/binding changes;
4. apply only the intended Auth0 configuration;
5. verify the Post-Login binding again;
6. perform a fresh login with a controlled test user;
7. verify the newly issued token contains the tenant claim without storing the token;
8. verify Web → API → membership → PostgreSQL tenant context.

## 7. Negative tests

After the positive path:
- remove/alter tenant metadata only in a controlled test identity, if safe;
- verify the API does not authorize a protected request without a tenant claim;
- verify an incorrect `x-tenant-id` does not override the authenticated claim;
- verify a user without active membership is denied.

Do not change production RLS or grants for these tests.

## 8. Closure evidence

AUTH-01 can close only when all are recorded:
- live Action/version identified;
- live Post-Login binding identified;
- source/live diff resolved;
- test user's tenant metadata verified;
- fresh token claim verified;
- API membership verification verified;
- tenant-scoped DB operation verified;
- negative tenant test verified;
- no secrets/tokens persisted in repository or audit documentation.