# P1 — Durable Jobs idempotency and fencing audit — 2026-09-16

## Scope

Audit the durable-job lease lifecycle after the lease-heartbeat hardening merged into `main`.

## Verified properties

- `claimPending` only claims pending/running jobs whose `attempts < max_attempts` and whose `available_at <= now()`.
- Claiming uses `FOR UPDATE SKIP LOCKED`, generating a fresh lease token.
- `complete` and `fail` require tenant, job id, running status, and the current lease token.
- Lease renewal requires the current lease token and a positive finite duration.
- Lease expiry permits reclamation by another worker.

## Residual P1 risk

A lease token fences database finalization, but it cannot automatically undo external side effects performed by a handler before lease loss. A handler that performs a non-idempotent external operation and then loses its lease can be followed by another worker reclaiming the job and repeating that operation.

Therefore durable-job correctness requires one of the following for handlers with external side effects:

1. an idempotency key derived from the durable job identity and enforced by the destination;
2. a transactional inbox/outbox or equivalent deduplication record inside the authoritative database;
3. a destination-side compare-and-set/fencing mechanism;
4. another explicitly documented idempotency mechanism with equivalent guarantees.

Lease renewal is not itself an idempotency guarantee.

## Acceptance gate

Before marking this P1 item complete, tests must demonstrate stale-lease finalization rejection and the handler-side idempotency contract must be identified in the codebase. CI must pass format, lint, typecheck, tests, and build.
