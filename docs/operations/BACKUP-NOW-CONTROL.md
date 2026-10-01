# Backup Now control

The Restore / DR page exposes a controlled **Backup now** action next to the restore verification action.

## Security model

- The browser sends only the literal confirmation `BACKUP-NOW`.
- The browser never receives or submits the database URL, S3 credentials, or encryption key.
- The API requires an Auth0 session and an explicit `BACKUP_ALLOWED_SUBJECTS` subject allowlist.
- The API requires `GITHUB_BACKUP_DISPATCH_TOKEN` and fails closed when it is missing.
- GitHub executes `.github/workflows/backup-now.yml` in the protected `backup-production` environment.
- The workflow runs `infra/backup/backup.sh` with PostgreSQL 17 client binaries and forces `verify-full` TLS.
- Workflow concurrency prevents overlapping manual backups.
- The normal Railway scheduled backup remains unchanged.

## Required Vercel variables

- `GITHUB_BACKUP_DISPATCH_TOKEN`
- `BACKUP_ALLOWED_SUBJECTS`

## Required GitHub Environment

Create/protect the `backup-production` environment and configure:

- `NEON_DATABASE_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`
- `BACKUP_ENCRYPTION_KEY`
- `BACKUP_RETENTION_DAYS`

No secret value belongs in the repository.
