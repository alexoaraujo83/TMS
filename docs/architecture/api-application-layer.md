# API application layer

The API is an adapter layer, not the source of tenant authority.

## Mandatory request path

`HTTP -> authentication -> tenant context -> authorization -> application service -> repository -> PostgreSQL/RLS`

### Rules

- `X-Tenant-Id` is only a request-context hint; it is not an authentication mechanism and must never be trusted as proof of membership.
- A production controller must receive an authenticated principal before selecting a tenant.
- Every repository method that reads or writes tenant-owned data receives `tenantId` explicitly.
- Matching must reject both a freight from another tenant and any candidate from another tenant before ranking.
- Controllers must not query PostgreSQL directly.
- No operational endpoint is considered production-ready until authentication, authorization, tenant membership, request validation, and RLS enforcement are connected end-to-end.
- P0/P1 cross-tenant failures block release.
