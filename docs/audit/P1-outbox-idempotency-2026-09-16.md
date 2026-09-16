# P1 Outbox / Idempotency Audit — 2026-09-16

## Scope

Audit the Outbox worker and repository on current `main` after the Durable Jobs lease/fencing hardening. The objective is to verify tenant isolation, lease fencing, retry behavior, and the failure window between executing an event handler and acknowledging the outbox row.

## Evidence reviewed

- `apps/worker/src/outbox-worker.ts`
- `apps/worker/src/outbox-worker.test.ts`
- `apps/worker/src/outbox-store.ts`
- `packages/database/src/outbox-repository.ts`
- `packages/database/test/outbox-repository.integration.test.ts`

## Findings

### 1. Tenant isolation — PROVEN

The repository applies tenant context before claim/finalization and predicates finalization by `tenant_id`. Integration coverage verifies cross-tenant visibility and cross-tenant finalization denial.

### 2. Lease fencing — PROVEN

Claims assign a random `lease_token`. Publication/failure updates require the current token. Integration coverage verifies that a stale token cannot publish or fail an event after the event has been reclaimed.

### 3. At-least-once delivery — CONFIRMED

A successful handler followed by process loss before `markPublished` can cause the event to be claimed again. The Outbox therefore provides at-least-once processing, not exactly-once side effects.

### 4. Acknowledgement failure — HARDENED

Previously, `markPublished` and the handler were inside the same `try/catch`. If the handler completed its side effect but `markPublished` failed, the processor called `markFailed`, cleared the lease, and scheduled an immediate retry. That could turn an acknowledgement failure into an avoidable duplicate side effect.

The hardened processor now treats handler failure and acknowledgement failure separately. If the handler succeeds but publication acknowledgement fails, the processor does **not** call `markFailed`. The current lease remains in force until expiry, preserving fencing and avoiding an unnecessary immediate replay.

This does not provide exactly-once effects. A later reclaim can still replay the event, so handlers must remain idempotent.

## Required idempotency contract

`event.id` is the stable durable identifier available to every handler. Any handler that performs an external or otherwise non-transactional side effect must use `event.id` as its idempotency key at the effect boundary (for example, a broker/message key, provider idempotency key, or durable consumer/inbox uniqueness constraint).

A future consumer implementation that cannot provide such a boundary must not be considered exactly-once safe merely because the Outbox lease is fenced.

## Remaining gap

There is no generic database-level consumer inbox/deduplication mechanism in the audited worker path. Adding one globally would be premature until actual consumers and side-effect boundaries are identified. The current gate therefore remains **AT-LEAST-ONCE + FENCED**, not **EXACTLY-ONCE**.

## Validation gate

The branch must pass the existing CI quality chain, including formatting, lint, typecheck, tests, and build. The new regression test must prove that an acknowledgement failure does not call `markFailed` after a successful handler.

## Next gate

After green CI:

1. inspect actual Outbox consumers/handlers and classify each side effect as transactional, idempotent, or unsafe;
2. add consumer-specific idempotency/inbox constraints where a real side-effect boundary requires them;
3. validate Outbox-to-Durable-Jobs orchestration, retry ownership, and observability;
4. only then consider an explicit exactly-once claim for any individual integration.
