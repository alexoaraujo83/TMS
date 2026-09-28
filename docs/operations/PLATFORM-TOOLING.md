# Platform CLI / SDK contract

## Scope

The TMS repository treats GitHub, Vercel, Neon, Railway and Auth0 as external platform dependencies. Credentials are never committed to the repository.

## Required local CLIs

- GitHub CLI: `gh`
- Vercel CLI: `vercel`
- Neon CLI: `neon`
- Railway CLI: `railway`
- Auth0 CLI: `auth0`

Run `node scripts/check-platform-tooling.mjs` to verify local availability.

## Authentication

Authentication is environment-specific and must use each platform's supported credential store, environment variable, OIDC flow, or interactive login. Do not put access tokens, client secrets, database URLs, signing keys, or backup keys in source files.

## SDK policy

Application SDKs belong in the workspace/package that consumes them. Platform CLIs are operator tooling and must not be required by the runtime application unless a documented build/deploy step explicitly needs them.

## TMS platform contract

| Platform | Primary responsibility | Production write policy |
|---|---|---|
| GitHub | source, PRs, CI | branch/PR first; never direct `main` changes during tooling rollout |
| Vercel | web/API deployments and environment configuration | preview first; production only after validation |
| Neon | PostgreSQL/Data API | read-only verification first; migrations through controlled workflow |
| Railway | worker/backup runtime | inspect first; deploy only after CI/preview validation |
| Auth0 | OIDC/OAuth tenant configuration | configuration export/read first; changes explicitly reviewed |

## Rollout gate

`main` remains unchanged until all tooling checks, application checks, CI checks and platform smoke tests pass on the feature branch and its pull request.
