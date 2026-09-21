# New TMS — Audit Logging

Operational logs and durable audit records are separate concerns.

The existing audit_events table is tenant-scoped and protected by PostgreSQL RLS. Audit persistence supports action, entity/resource, request correlation and state/metadata.

Migration 0032 adds:

- actor Auth0 subject
- correlation ID
- IP address
- user-agent
- outcome
- request/correlation indexes

Do not persist access tokens, refresh tokens, client secrets, passwords, session cookies or Authorization headers.

Audit events should be created inside the same transaction as the business mutation whenever the existing repository contract supports it.
