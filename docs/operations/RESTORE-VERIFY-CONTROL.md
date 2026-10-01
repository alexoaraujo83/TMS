# Restore verification control

The TMS web application exposes an authenticated control page at `/app/restore`.

The page does **not** accept a database URL, S3 credentials, encryption keys, or backup object from the browser. It dispatches the repository workflow `.github/workflows/restore-verify.yml`, whose GitHub Environment `restore-verification` must contain the isolated restore secrets.

Required GitHub Environment secrets:

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`
- `BACKUP_ENCRYPTION_KEY`
- `BACKUP_OBJECT`
- `RESTORE_DATABASE_URL`
- `EXPECTED_MIGRATION_COUNT`

The Vercel production environment additionally requires `GITHUB_RESTORE_DISPATCH_TOKEN` with the minimum GitHub permission needed to dispatch this workflow.

`RESTORE_DATABASE_URL` must point to an isolated Neon recovery branch/database. Production must never be used as the restore target.

The page is intentionally fail-closed: without the dispatch token it returns HTTP 503 and does not attempt any restore.
