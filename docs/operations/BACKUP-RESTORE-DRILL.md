# Stage 10.10 — Backup and Restore Readiness

## Objective

Establish an evidence-driven database backup and restore drill for the TMS production database. The drill must prove that a recoverable database state can be restored without modifying production data.

## Current evidence

- The TMS Neon production project is `tms`.
- The default branch is `main` and is currently ready.
- The configured Neon automatic snapshot schedule is currently empty.
- Repository CI proves migration and application quality gates, but CI alone does not prove backup recoverability.

## Required drill

1. Identify the production database and the recovery point to test.
2. Create or select a point-in-time/snapshot recovery point without modifying production data.
3. Restore that recovery point into an isolated temporary branch.
4. Verify the restored branch is ready and compare its schema against the expected application schema.
5. Run the database migration validation against the restored branch.
6. Execute representative read-only integrity checks, including migration version and critical table availability.
7. Record recovery start/end timestamps and the resulting RTO measurement.
8. Record the recovery point age to establish the tested RPO.
9. Preserve the evidence and explicitly mark the drill PASS only when all checks succeed.

## Safety rules

- Never restore over production as part of the routine drill.
- Never run destructive SQL against production for validation.
- Temporary recovery branches must be isolated from application traffic.
- Credentials and connection strings must never be committed or logged.
- A successful snapshot creation is not, by itself, evidence of recoverability; restoration and validation are mandatory.

## Production-readiness gate

The backup/restore item remains **NOT PROVEN** until a real restore drill has been executed and evidence recorded. Documentation or the existence of a backup feature is not sufficient.

## Follow-up

After the first successful drill, define an explicit recurring snapshot policy appropriate to the production RPO/RTO target and document ownership, retention, escalation and evidence location.
