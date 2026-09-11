# Database boundary

Database access is tenant-scoped by construction.

- Repository methods receive tenant scope from the authenticated application context.
- Tenant context is installed with parameterized `set_config('app.tenant_id', ..., true)` inside the active transaction.
- UUIDs are validated before repository lookup.
- Queries use parameters; identifiers are never interpolated from HTTP input.
- PostgreSQL RLS remains the final isolation control.
- A repository must not expose a global `findById(id)` for tenant-owned resources.
- Resource lookup must combine tenant scope and resource identifier, preventing IDOR/BOLA.
