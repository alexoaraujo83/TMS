# Auth0 — New TMS

This directory is the source-controlled contract for the Auth0 Post-Login Action that emits the TMS tenant claim.

## Architecture

Auth0 authenticates the user. TMS remains authoritative for tenant membership, roles and permissions.

The Action reads:

`event.user.app_metadata.tenant_id`

and, when it is a non-empty string, emits:

`https://tms.tms/claims/tenant_id`

into both the Access Token and ID Token.

The API does **not** trust the claim as authorization by itself. It validates the JWT and then re-checks the Auth0 `sub` + tenant against TMS/PostgreSQL membership.

## Managed files

- `actions/post-login.js` — Action source.
- `tenant.yaml` — Deploy CLI definition and Post-Login binding.

## Production deployment

Use a **dedicated Auth0 Machine-to-Machine application** for the Deploy CLI. Do not reuse the TMS Web application's client secret.

Required environment variables:

```bash
export AUTH0_DOMAIN=tms-platform.us.auth0.com
export AUTH0_CLIENT_ID='<deploy-cli-m2m-client-id>'
export AUTH0_CLIENT_SECRET='<deploy-cli-m2m-client-secret>'
```

The Auth0 Deploy CLI can read these environment variables directly, so no `config.json` containing credentials is required.

Install/run the CLI:

```bash
pnpm dlx auth0-deploy-cli --help
```

Run a dry-run first:

```bash
pnpm dlx auth0-deploy-cli import \
  -i ./infra/auth0/tenant.yaml \
  --dry-run
```

Only after reviewing the proposed changes:

```bash
pnpm dlx auth0-deploy-cli import \
  -i ./infra/auth0/tenant.yaml
```

Auth0 documents that an Action being deployed does not automatically mean it is attached to the Login trigger; the trigger binding must also be applied. This repository therefore keeps the `triggers.post-login` binding in source control.

## Required user metadata bridge

For the current bootstrap tenant, the test user's Auth0 `app_metadata.tenant_id` must contain the authoritative TMS tenant UUID before the claim can appear in a token.

Do not put the tenant UUID into the Action source and do not use the TMS Web client secret to modify Auth0 users.

## Evidence required for E3-001

After deployment and a fresh interactive login, capture evidence for:

1. Action exists and is deployed.
2. Action is attached to the Post-Login/Login Flow.
3. Test user has `app_metadata.tenant_id`.
4. A newly issued Access Token contains `https://tms.tms/claims/tenant_id`.
5. The API accepts the token.
6. The API re-checks membership for the token `sub` and tenant.
7. A tenant-scoped operation reaches PostgreSQL under the expected tenant context/RLS.

A configured Action alone is not sufficient to close E3-001.

## Security rules

- Never commit Auth0 client secrets.
- Never put the TMS Web client secret into Auth0 Actions.
- Never treat Auth0 roles/permissions or user metadata as the final TMS authorization authority.
- Keep the API audience environment-specific:
  - development: `urn:tms:api:development`
  - staging: `urn:tms:api:staging`
  - production: `urn:tms:api:production`
