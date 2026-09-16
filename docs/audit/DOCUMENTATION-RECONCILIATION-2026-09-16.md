# TMS — Documentation Reconciliation Audit — 2026-09-16

## Purpose

Reconcile documentation against repository implementation and prevent documentation from describing planned, obsolete or unverified behavior as production functionality.

## Current findings

### 1. Runtime topology

The repository contains separate Web, API and Worker applications. The documented target topology is Browser -> Web -> API -> PostgreSQL, with Worker processing asynchronous persistence-backed work.

**Status:** COMPROVED at repository structure level.

### 2. Worker / Outbox / Durable Jobs

The implementation baseline contains transactional outbox processing and durable-job persistence/claiming paths. Recent hardening includes tenant lifecycle checks, lease renewal and fencing behavior.

**Status:** IMPLEMENTED FOUNDATION; production readiness remains subject to runtime/environment evidence.

### 3. Previous documentation contradiction

`docs/INTEGRATIONS-OPERATIONS.md` previously described the worker as only a bootstrap loop and stated that the outbox pipeline was not implemented. That statement no longer matched the current repository baseline.

**Correction:** the operational documentation was reconciled in the same change to describe the implemented outbox/durable-job foundation while explicitly retaining limitations around future business handlers, receiver-side deduplication and replay tooling.

### 4. Frontend maturity

`apps/web` exists as a Next.js application, but the current inspected source tree remains a foundation-level UI. The home page explicitly states that operational modules are added incrementally.

**Status:** FOUNDATION ONLY; do not document freight, matching, trip, finance or dashboard UI as production functionality until independently verified.

### 5. Backup / disaster recovery

Backup/restore documentation must distinguish a proven isolated restore drill from production DR readiness. A successful isolated restore does not by itself establish business-approved RPO/RTO, retention ownership or recurring backup policy.

**Status:** RESTORE MECHANISM PROVEN; PRODUCTION DR READINESS NOT PROVEN.

## Documentation governance

For every implementation change:

1. identify affected documentation;
2. update documentation in the same change whenever practical;
3. distinguish IMPLEMENTED, PARTIAL, CONFIGURED, PROVEN and PLANNED;
4. attach executable evidence for operational claims;
5. avoid declaring platform configuration as application proof;
6. create an ADR for material architectural decisions.

## Next audit passes

- Reconcile database documentation against current main/staging/development schemas and migration history.
- Reconcile environment documentation against Neon, Railway and Vercel runtime configuration.
- Audit every API route and permission against documentation.
- Audit frontend routes/components and identify undocumented or missing product flows.
- Validate runbooks by executing the documented commands where safe.
- Remove or update obsolete documents after preserving historical evidence.
