# Stage 10.11 — Disaster Recovery / Restore Evidence

## Objective

Establish evidence that a real database recovery point can be restored and validated without using production traffic for the validation workload. The routine drill must use an isolated recovery branch and must not finalize the restore over production.

## Baseline evidence

- Neon project: `tms` (`shiny-hall-34679912`).
- Production/default branch remains `main`.
- Automatic snapshot schedule is currently empty.
- Existing recovery point `snap-green-fog-acgzhbtw` was reused for the isolated validation because the project snapshot limit prevented creation of another snapshot.

## Safe isolated restore drill evidence

A second restore operation was executed with `finalize: false`, producing the isolated recovery branch `br-misty-smoke-acwzvipt`.

The recovery branch was explicitly non-primary and non-default and reached `ready`. Read-only validation on the isolated branch confirmed:

- PostgreSQL `17.11`.
- Database `neondb`.
- `21` public base tables.
- `28` rows in `schema_migrations`.
- Latest migration: `0028_durable_jobs.sql`.
- `10/10` critical TMS tables present: tenants, users, freights, freight_assignments, trips, trip_occurrences, trip_pods, financial_entries, outbox_events and durable_jobs.

The restore branch reached ready state approximately one to two seconds after the restore request. This is an observed provider/branch readiness measurement only; it is not an approved application-level RTO.

The isolated branch was not finalized and did not replace the production/default branch. No destructive SQL was executed as part of validation.

## Snapshot automation evidence

The project currently reports an empty snapshot schedule. An attempt to configure a daily snapshot policy with 14-day retention was rejected by the provider because automatic backup-schedule creation is not enabled for this project.

Therefore the repository cannot truthfully mark recurring snapshot automation as configured. This is a provider/project capability blocker, not an application implementation failure.

The current evidence also does not establish a business-approved RPO or RTO. Those targets must be defined before production-readiness approval.

## Outcome

**Restore mechanism: PROVEN.** A real Neon recovery point was restored and validated.

**Safe isolated drill: PROVEN.** The second drill used `finalize: false`, remained non-primary/non-default, reached `ready`, and passed read-only structural validation.

**Production backup/recovery readiness: NOT PROVEN.** Recurring backup policy, ownership, retention, target RPO and target RTO remain unresolved. Automatic snapshot scheduling is not enabled for this project.

## Required safe drill procedure

1. Identify the production database and recovery point.
2. Create or select a recovery point without changing production data.
3. Restore using `finalize: false` so the restored branch remains isolated and does not replace production.
4. Verify the restored branch reaches `ready`.
5. Run read-only schema and migration checks against the restored branch.
6. Execute representative integrity checks, including migration version and critical table availability.
7. Record recovery start/end timestamps and calculate observed provider restore duration.
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

The backup/restore item remains **NOT PROVEN** until an explicit recurring recovery policy is established with ownership, retention, RPO and RTO targets, and the corresponding operational mechanism is available.

## Follow-up

Keep the validated recovery branch available until cleanup is explicitly approved. Resolve the provider snapshot-schedule capability or establish an approved external backup mechanism. Then define RPO/RTO targets, execute a scheduled drill, preserve evidence, and reassess the production-readiness gate.
