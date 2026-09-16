# TMS — Integrations & Operations

## 1. Runtime topology

```text
Browser
  -> Vercel / Next.js Web
      -> HTTP /api/v1
          -> NestJS API
              -> PostgreSQL / Neon

Worker -> PostgreSQL -> Outbox / Durable Jobs -> integration side effects
```

The intended hosting baseline is Vercel for Web, Railway for API/Worker and Neon PostgreSQL. The exact deployment wiring must be kept in platform configuration rather than committed secrets.

## 2. Environment contract

Relevant variables currently declared in `.env.example`:

- `NODE_ENV`
- `APP_ENV`
- `APP_NAME`
- `APP_URL`
- `API_URL`
- `CORS_ALLOWED_ORIGINS`
- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_JWKS_URL`
- `TENANT_HEADER`
- `WORKER_ENABLED`
- `WORKER_CONCURRENCY`
- `LOG_LEVEL`

`CORS_ALLOWED_ORIGINS` is an explicit comma-separated browser-origin allowlist. The API does not enable wildcard `*` origins and does not enable credentialed CORS. The example file is documentation only; it is not automatically loaded by the API. Secrets must come from the runtime secret store. Auth0 audiences are environment-specific: development, staging and production use distinct audience values as documented in `.env.example`.

## 3. Web → API transport contract

The current topology uses direct browser HTTP access to the NestJS API when the Web and API have different origins. The API therefore applies an environment-driven CORS allowlist through `CORS_ALLOWED_ORIGINS`.

Rules:

- Origins are exact values such as `https://app.example.com`, separated by commas.
- `*` is not a valid production policy and is not configured by the repository baseline.
- Credentialed browser requests are disabled (`credentials: false`). Authentication uses bearer access tokens rather than browser cookies.
- Requests without an `Origin` header remain accepted so server-to-server, health and CLI traffic are not blocked by browser CORS policy.
- A browser origin absent from the allowlist is rejected by the CORS middleware.

For local development the baseline example allows `http://localhost:3000` to reach the API on `http://localhost:3001`. Production/staging origins must be populated in the platform secret/configuration store and must not be committed.

### Web/API request-response contract

| Case | HTTP | Body contract |
|---|---:|---|
| Authentication missing/invalid | 401 | `{ code: "REQUEST_ERROR", message, requestId? }` |
| Permission denied | 403 | `{ code: "REQUEST_ERROR", message, requestId? }` |
| Validation failure | 400 | `{ code: "REQUEST_ERROR", message, requestId? }` |
| Resource not found | 404 | `{ code: "REQUEST_ERROR", message, requestId? }` |
| Unexpected server failure | 500 | `{ code: "INTERNAL_ERROR", message: "Internal server error", requestId? }` |

Clients must not infer authorization state from human-readable messages. They should use HTTP status and the stable `code` field, while treating `message` as display/diagnostic text.

## 4. Authentication and authorization

Authentication uses Auth0/OIDC bearer tokens. The API validates the token issuer, audience and signing keys through the configured Auth0 settings. The authenticated token must provide the tenant claim required by the API; when `TENANT_HEADER` is supplied, it cannot override a different authenticated tenant. The authentication layer also verifies active tenant membership before constructing the request context.

The API uses an authentication guard, current-request context and permission guard. Endpoint permissions are declared at the controller boundary with `RequirePermission`.

Authorization is tenant-aware and must remain enforced in application code plus database isolation. Never trust a tenant ID supplied by the browser without validating membership and establishing the server-side tenant context.

## 5. HTTP contract

Base path: `/api/v1`.

Health: `GET /health`.

Freight endpoints are documented in `docs/PROJECT-DOCUMENTATION.md`. Errors are normalized by the API error/HTTP exception infrastructure; clients should use HTTP status plus the stable application error payload rather than parsing human-readable text.

## 6. External services

### Neon PostgreSQL

Role: transactional persistence. Authentication is through `DATABASE_URL`. Tenant isolation is implemented with PostgreSQL RLS and the `app.tenant_id` setting.

### Vercel

Role: web runtime/deployment target. Authentication to Vercel is platform-managed; application secrets belong in the Vercel environment configuration.

### Railway

Role: intended API/worker runtime. Application startup must honor the injected `PORT`; the API's local fallback is 3001.

### Redis

No Redis variable is currently declared in `.env.example`, and no production Redis-backed queue implementation is claimed by this baseline. Treat Redis as outside the current runtime contract until a concrete adapter is implemented, configured and tested.

### Business integrations

No external freight marketplace, carrier API, tracking provider, fiscal provider, payment provider or notification provider is documented as an implemented production connector in the inspected baseline. Do not create operational documentation that implies otherwise.

## 7. Events and asynchronous processing

The current baseline contains a transactional outbox processor and durable-job persistence/claiming paths. Outbox events are persisted transactionally and claimed with tenant-aware leasing/fencing. Durable jobs likewise use tenant-aware claiming, and recent hardening aligns claims with active tenant lifecycle. Worker lease renewal/acknowledgement behavior is protected by fencing and regression coverage.

The operational model is:

`committed transaction -> outbox/durable job -> worker claim -> idempotent handler -> external side effect -> completion/failure -> audit`

This does **not** imply that every future external integration is implemented. Receiver-side deduplication, complete replay tooling and business-specific handlers must be independently exercised and evidenced before being described as production-ready.

## 8. Deployment procedure

1. Verify repository state and required Node/pnpm versions.
2. Install with the committed lockfile.
3. Run formatting, lint, typecheck, tests and build.
4. Apply database migrations in the target environment.
5. Verify application health.
6. Verify tenant isolation and authorization smoke tests.
7. Verify worker/outbox/durable-job health where applicable.
8. Promote Web/API/Worker according to environment policy.
9. Record release commit and migration version.

Never deploy a populated `.env` file or production credentials through Git.

## 9. Rollback

Application rollback should first confirm database compatibility. Because migrations are forward-only by default, prefer rolling the application back only when the schema remains backward compatible. For incompatible changes, use expand/contract rather than destructive rollback SQL.

If data integrity is at risk, stop writes, preserve evidence/logs, identify the last known-good commit/schema, and execute the approved recovery procedure rather than attempting ad-hoc production edits.

## 10. Incident response

### P0 — security/data integrity

Immediately block promotion or isolate the affected path. Preserve request IDs, deployment SHA, database migration version and relevant audit events. Validate cross-tenant access, authorization bypass and transaction integrity before reopening traffic.

### P1 — major business degradation

Identify affected domain, reproduce with tenant-scoped test data, inspect API/worker logs and database health, mitigate through feature/path isolation where possible, then deploy a verified fix.

### P2/P3

Track through normal issue/maintenance workflow with owner, impact, reproduction, expected behavior and verification evidence.

## 11. Observability

All operational flows should carry a correlation/request ID. Audit events support actor, action, entity, request ID, before/after state and metadata. Production observability must make it possible to trace a request from HTTP boundary through use case, transaction and asynchronous side effect.

## 12. Maintenance

- Keep Node/pnpm versions aligned with the repository.
- Keep migrations immutable after release.
- Update docs in the same change as behavior.
- Review indexes when query patterns change.
- Run security and dependency checks before production promotion.
- Perform periodic backup/restore drills.
- Remove unused environment variables and integrations rather than leaving undocumented operational dependencies.
