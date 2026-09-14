# Stage 10.11 — Disaster Recovery / Restore Evidence

## Objective

Establish evidence that a real database recovery point can be restored and validated without using production traffic for the validation workload. The routine drill must use an isolated recovery branch and must not finalize the restore over production.

## Baseline evidence

- Neon project: `tms` (`shiny-hall-34679912`).
- The production/default branch was `main` before the drill and was ready.
- Automatic snapshot schedule was empty before the drill.
- A manual snapshot was created from the production branch at `2026-09-14T21:26:36Z` with seven-day expiration.
- Snapshot creation itself was successful and returned recovery point `snap-green-fog-acgzhbtw`.

## Restore drill evidence

A restore operation was executed from the manual snapshot. The restore API was invoked without an explicit `finalize: false`, so the operation finalized the restored branch instead of leaving it as an isolated non-default branch. The restored branch became `main` and the previous branch was retained under a generated non-default name.

The restored branch reached `ready` at `2026-09-14T21:26:43Z`. The restored database was validated with read-only checks:

- PostgreSQL `17.11`.
- Database `neondb`, schema `public`.
- `21` public base tables.
- `28` rows in `schema_migrations`.
- Latest migration: `0028_durable_jobs.sql`.

The measured restore operation from snapshot creation to branch readiness was approximately `7 seconds`. This is an observed restore duration, not a production RTO target.

The tested recovery point was created immediately before the restore, so its snapshot-age component was effectively `0 seconds` at capture time. This is not sufficient to establish an operational RPO target because the production snapshot schedule is still empty.

## Outcome

**Restore mechanism: PROVEN.** A real Neon snapshot was created, restored, reached ready state, and passed read-only schema/migration validation.

**Safe isolated drill: NOT PROVEN.** Because the restore was finalized rather than created with `finalize: false`, this execution is not accepted as the routine isolated production-safe drill defined below. No additional restore-over-production operation should be performed as part of validation.

**Production backup/recovery readiness: NOT PROVEN.** Automatic snapshot policy, ownership, retention, target RPO and target RTO remain undefined.

## Required safe drill procedure

1. Identify the production database and recovery point.
2. Create or select a recovery point without changing production data.
3. Restore using `finalize: false` so the restored branch remains isolated and does not replace production.
4. Verify the restored branch reaches `ready`.
5. Run read-only schema and migration checks against the restored branch.
6. Execute representative integrity checks, including migration version and critical table availability.
7. Record recovery start/end timestamps and calculate observed RTO.
8. Record recovery-point age and compare it with the approved RPO target.
9. Preserve evidence without credentials or connection strings.
10. Obtain explicit approval before deleting the temporary recovery branch.

## Safety rules

- Never finalize a routine restore drill over production.
- Never run destructive SQL against production for validation.
- Keep recovery branches isolated from application traffic.
- Credentials and connection strings must never be committed or logged.
- A successful snapshot is not evidence of recoverability until restoration and validation succeed.
- Temporary recovery branches must not be deleted automatically; deletion requires explicit approval.

## Production-readiness gate

The backup/restore item remains **NOT PROVEN** until the safe isolated drill succeeds and an explicit recurring snapshot policy is defined with ownership, retention, RPO and RTO targets.

## Follow-up

Perform the next drill with `finalize: false`, validate the isolated branch, and then obtain explicit approval before cleanup. After that, define the recurring snapshot schedule and repeat the drill at an agreed operational cadence.
