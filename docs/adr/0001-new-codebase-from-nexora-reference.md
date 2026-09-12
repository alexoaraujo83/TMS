# ADR 0001 — New codebase using Nexora as reference

## Status

Accepted

## Decision

The TMS is implemented as a new codebase. Nexora TMS is used as an architectural and audit reference only.

We may reuse validated concepts such as domain boundaries, tenant isolation, RLS, idempotency, auditability, transactional workflows and reconciliation patterns. We do not copy code or known P0/P1 weaknesses without independent validation.

## Consequences

The new repository can evolve its contracts and security model without inheriting accidental coupling or unsafe implementation details from the reference project.
