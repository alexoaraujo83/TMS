# Security Boundary

## Mandatory request path

`HTTP request -> authentication -> tenant context -> authorization -> domain service -> database transaction -> audit`

A request must never select a tenant solely from a URL/body parameter. The authenticated identity and membership determine the tenant context.

## Tenant isolation

1. Resolve authenticated user.
2. Resolve an authorized tenant membership.
3. Attach immutable `tenantId` to the request context.
4. Reject missing or conflicting tenant context.
5. Set PostgreSQL `app.tenant_id` inside the transaction.
6. Enforce PostgreSQL RLS on tenant-scoped tables.
7. Audit security-sensitive actions.

## IDOR/BOLA controls

Every resource read/update/delete must validate ownership through the tenant context and authorization policy. Resource IDs are not authorization boundaries.

## Release gate

P0/P1 security findings block staging/production promotion until remediated or explicitly accepted with documented risk ownership.
