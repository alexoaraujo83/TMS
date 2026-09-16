# P1 — Durable Jobs idempotency and fencing audit — 2026-09-16

## Scope

Audit the durable-job lease lifecycle after the lease-heartbeat hardening merged into `main`.

## Verified properties

- `claimPending` only claims pending/running jobs whose `attempts < max_attempts` and whose `available_at <= now()`.
- Claiming uses `FOR UPDATE SKIP LOCKED`, generating a fresh lease token.
- `complete` and `fail` require tenant, job id, running status, and the current lease token.
- Lease renewal rejects zero, negative, `NaN`, and non-finite durations before issuing SQL.
- Lease renewal requires the current lease token and a positive finite duration.
- Lease expiry permits reclamation by another worker.
- Regression coverage verifies invalid lease durations do not reach the database and stale lease finalization is rejected.

## Real external-side-effect handler

The worker now has a non-noop `external.webhook` Durable Job handler. The handler validates a typed webhook payload and delegates to the existing HTTPS-only `WebhookPublisher`.

The durable job ID is passed as the outbound event ID, which becomes the deterministic `Idempotency-Key` header. A retry or reclaim of the same durable job therefore reuses the same external idempotency key rather than generating a new key.

The publisher also requires an HMAC secret when endpoints are configured, signs the exact JSON body, rejects non-HTTPS endpoints, disables redirects, and treats non-success responses/timeouts as failures.

Automated tests cover handler payload validation and verify that the durable job ID is preserved as the external event identity. Existing publisher tests verify the emitted idempotency header and request security controls.

## Remaining boundary

The TMS side now provides a deterministic idempotency key and a real non-noop external handler, but exactly-once external effects still depend on the destination enforcing that key atomically. The worker cannot independently prove the behavior of an external system it does not control.

Therefore the production integration contract requires each webhook destination to deduplicate atomically by `Idempotency-Key` and return the previously committed result for a replay of the same key. Destination-side evidence must be collected when a real external integration is enabled.

Lease renewal is not itself an idempotency guarantee.

## Acceptance gate

Lease validation, stale-finalization fencing, a real non-noop external handler, deterministic external idempotency-key propagation, and automated handler/publisher tests are implemented. Production exactly-once behavior remains dependent on destination-side idempotency enforcement and is not claimed without destination evidence.
