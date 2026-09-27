# Auth0 — New TMS

This directory is the source-controlled contract for the Auth0 Post-Login Action that emits the TMS tenant and identity bootstrap claims.

## Architecture

Auth0 authenticates the user. TMS remains authoritative for tenant membership, roles and permissions.

The Action reads:

`event.user.app_metadata.tenant_id`

and, when it is a non-empty string, emits:

- `https://tms-platform.io/claims/tenant_id`
- `https://tms-platform.io/claims/email`
- `https://tms-platform.io/claims/display_name`

into both the Access Token and ID Token.

The API validates the JWT and re-checks the Auth0 `sub` + tenant against TMS/PostgreSQL membership. On the first authenticated tenant-scoped request, the API performs an idempotent identity bootstrap: it creates/links the local `users.auth0_subject` record and creates the first tenant membership only when that local identity has no existing memberships. Existing memberships remain authoritative and are never expanded implicitly.

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

## TMS Web Application / Connection contract

The Next.js application uses the Auth0 v4 server SDK and starts signup through the SDK-managed `/auth/login?screen_hint=signup` route. The application intentionally does not hard-code an Auth0 Connection because the authoritative Connection-to-application association belongs to the Auth0 tenant configuration.

Before Production sign-off, verify in Auth0 Production that:

1. **TMS Web** is a Regular Web Application.
2. Its production callback is `https://tms-web-chi.vercel.app/auth/callback`.
3. Its production logout URL is `https://tms-web-chi.vercel.app`.
4. The Connection(s) exposed by Universal Login are explicitly enabled for **TMS Web** using the current Auth0 client/connection configuration mechanism.
5. The signup Connection is the intended user store for this application.
6. The Post-Login Action **TMS — Tenant Claim** is deployed and bound to the Login Flow.
7. New/invited users receive `app_metadata.tenant_id` through an authorized onboarding operation; the browser signup URL must never supply the authoritative tenant UUID.

Do not add a guessed Connection name to `tenant.yaml`. The exact Production Connection must first be observed from Auth0. Once identified, its management contract can be versioned deliberately if the selected Auth0 configuration tooling supports it.

## Required user metadata bridge

For automatic first-login tenant linking, the Auth0 user must have:

`app_metadata.tenant_id`

set to the authoritative TMS tenant UUID.

Do not put a tenant UUID into the Action source. Do not accept a tenant identifier from an untrusted signup URL. Tenant assignment must come from an authorized Auth0 metadata/invitation/onboarding operation.

A new Auth0 user without a tenant claim can still be represented as a local identity only when the API receives a valid tenant-scoped bootstrap request; it cannot receive tenant authorization merely because it authenticated.

## First-login provisioning contract

The first protected API request now follows:

```text
Auth0 JWT
  -> verify issuer/audience/signature
  -> require tenant claim
  -> lookup sub + tenant membership
  -> if missing:
       bootstrap_auth0_identity(...)
       -> create/link users.auth0_subject
       -> if user has zero memberships, create operator membership
  -> lookup membership again
  -> continue authorization
```

The database bootstrap function is `public.bootstrap_auth0_identity(text,text,text,uuid)` and is SECURITY DEFINER with a fixed `search_path`. It is idempotent, rejects an email already bound to another Auth0 subject, requires an active tenant, and never adds a second tenant membership to an already-associated local identity.

## Claim namespace

The custom claims namespace is intentionally stable and independent of the Auth0 tenant domain or the Vercel deployment URL:

`https://tms-platform.io/claims/*`

## Evidence required for E3-001

After deployment and a fresh interactive login, capture evidence for:

1. Action exists and is deployed.
2. Action is attached to the Post-Login/Login Flow.
3. Test/new user has `app_metadata.tenant_id`.
4. Newly issued Access Token contains tenant and identity bootstrap claims.
5. The API accepts the token.
6. First authenticated request creates/links the local user and membership.
7. A second request is idempotent and does not create another membership.
8. The API re-checks membership for the token `sub` and tenant.
9. A tenant-scoped operation reaches PostgreSQL under the expected tenant context/RLS.

A configured Action alone is not sufficient to close E3-001.

## Security rules

- Never commit Auth0 client secrets.
- Never put the TMS Web client secret into Auth0 Actions.
- Never treat Auth0 roles/permissions or user metadata as the final TMS authorization authority.
- Never auto-link an identity to a second tenant.
- Never trust a tenant ID supplied only by an untrusted browser/signup parameter.
- Keep the API audience environment-specific:
  - development: `urn:tms:api:development`
  - staging: `urn:tms:api:staging`
  - production: `urn:tms:api:production`
