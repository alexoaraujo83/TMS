# Release gates

Production promotion is blocked when any P0 or P1 security/control failure remains unresolved.

## Mandatory gates

- Authentication is mandatory for operational endpoints.
- Tenant membership is authoritative in the database; JWT claims do not grant membership by themselves.
- `X-Tenant-Id` is never treated as proof of authorization.
- Tenant-owned resource lookup requires both tenant scope and resource identifier.
- PostgreSQL RLS is enabled and forced on tenant-owned tables.
- Tenant context is installed inside the active database transaction.
- Operational repositories use parameterized SQL.
- Permission checks execute before domain mutation.
- Cross-tenant matching and resource access are rejected.
- Audit events are required for security-sensitive mutations.
- CI must pass format, lint, typecheck, test and build before production promotion.

## Current implementation status

The repository is still foundation-stage. Protected operational controllers are intentionally not exposed until the authentication, membership, authorization and audit path is wired end-to-end.
