# Auth0 Deploy CLI — Production reconciliation

This directory is the source-controlled Auth0 contract. The Production export workflow is intentionally **read-only**.

## Dedicated Management API application

Create a dedicated Auth0 Machine-to-Machine application for the Deploy CLI. Do **not** reuse the TMS Web client or any runtime application.

The requested authorization profile for the dedicated application is:

- `read:*`
- `create:*`
- `update:*`
- `delete:*`

Auth0 documents that `delete:*` is required for deletion operations and that the Deploy CLI operates within the scopes granted to its dedicated Management API application. citeturn0view0

The repository never stores these credentials. Configure these GitHub Actions secrets in the protected `production-auth0-readonly` environment:

- `AUTH0_DEPLOY_DOMAIN`
- `AUTH0_DEPLOY_CLIENT_ID`
- `AUTH0_DEPLOY_CLIENT_SECRET`

## Current workflow boundary

`.github/workflows/auth0-production-deploy-export.yml` performs:

1. authenticated Production export;
2. no `--export_secrets`;
3. comparison of the exported Post-Login Action with `infra/auth0/actions/post-login.js`;
4. comparison of the Post-Login v3 trigger and binding;
5. regression checks for `api.access.deny` and `missing_tenant_id`;
6. short-lived evidence artifact retention.

It does **not** execute `import`, `update`, `create`, or `delete`.

This separation is deliberate: the Management API credential may have the requested high privileges, but the first Production workflow only exercises the read path.

## Production import gate

A future import workflow must be separate and protected by a GitHub Environment requiring explicit reviewers. It must:

- run the same Production export/diff first;
- fail if the live state changed since the review;
- require explicit human approval;
- run `a0deploy import` only after approval;
- record the exact source commit and Deploy CLI version;
- run a post-import read-only reconciliation.

Never make Production import the default branch-push behavior.

## Official capability

The official Deploy CLI supports YAML export/import and manages Actions, Applications, Connections, APIs and other tenant resources. citeturn0view0turn0view1
