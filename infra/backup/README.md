# TMS PostgreSQL external backup

Stage 10.11 implementation for a scheduled Railway worker that creates an encrypted PostgreSQL dump from Neon and stores it in an S3-compatible bucket.

## Architecture

`Neon PostgreSQL -> Railway backup-worker -> pg_dump -> AES-256-CBC -> S3-compatible storage -> verification -> isolated restore drill`

## Railway variables

Set these as Railway service secrets. Never commit values to GitHub:

- `DATABASE_URL` — direct Neon PostgreSQL connection string for backups.
- `S3_ENDPOINT` — S3 endpoint for the selected provider.
- `S3_BUCKET` — private backup bucket.
- `S3_REGION` — provider region.
- `S3_ACCESS_KEY_ID` — dedicated least-privilege application key.
- `S3_SECRET_ACCESS_KEY` — secret component of the application key.
- `BACKUP_PASSPHRASE` — dedicated backup encryption passphrase.
- Optional `PGSSLMODE` — defaults to `require`.

## Schedule

Recommended initial schedule: once daily at 02:00 UTC. Retention should be configured at the bucket/provider level for at least 14 recovery points.

## Backup verification

The worker verifies that the uploaded object's byte length matches the local dump and writes a SHA-256 sidecar plus a manifest. A successful run emits `backup_status=verified` in Railway logs.

## Restore drill

Run `restore-verify.sh` only against an isolated Neon branch/database. Required variables include `RESTORE_DATABASE_URL` and `BACKUP_OBJECT`. Never point the restore target at production.

The restore drill validates decryption, checksum, `pg_restore`, basic schema visibility, and optionally `public.schema_migrations` when `EXPECTED_MIGRATION_COUNT` is supplied after the canonical migration inventory has been confirmed.

## Gate 10.11 evidence

Do not close the gate from code existence alone. Evidence must include:

1. real backup object;
2. object size and SHA-256 verification;
3. backup duration/timestamp;
4. source schema/migration version;
5. successful isolated restore;
6. critical-table/schema validation;
7. measured backup and restore durations;
8. business-approved RPO/RTO;
9. recurring restore-drill cadence.
