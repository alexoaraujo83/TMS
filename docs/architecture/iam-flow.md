# IAM and tenant authorization flow

The TMS authorization boundary is server-authoritative.

```text
Bearer JWT
  -> authenticated user (sub)
  -> selected tenant
  -> tenant_memberships lookup
  -> active tenant + user
  -> role / role_permissions
  -> permission guard
  -> application service
  -> tenant-scoped repository
  -> transaction-scoped PostgreSQL RLS context
```

## Rules

1. A signed JWT proves identity and token validity; tenant membership remains authoritative in PostgreSQL.
2. `tenantId`, roles, and permissions from a token must not be treated as sufficient proof of tenant membership.
3. `X-Tenant-Id` is only a request-selection hint. It never grants access.
4. Every tenant-owned repository operation must execute with a transaction-scoped `app.tenant_id` setting.
5. PostgreSQL RLS is the final isolation boundary, not a replacement for application authorization.
6. Missing membership is forbidden; invalid or missing authentication is unauthorized.
7. Resource identifiers must always be resolved inside the authenticated tenant scope to prevent IDOR/BOLA.
