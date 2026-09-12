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

Protected Freight and Operations controllers are now exposed behind JWT authentication, database-backed tenant membership and permission guards. Freight matching also applies tenant-scoped hard eligibility filters before deterministic ranking.

Production remains blocked until audit logging, end-to-end security tests, CI verification and production hardening are complete.
