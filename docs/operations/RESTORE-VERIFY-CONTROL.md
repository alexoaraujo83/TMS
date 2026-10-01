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

The Vercel production environment additionally requires:

- `GITHUB_RESTORE_DISPATCH_TOKEN`: minimum GitHub permission needed to dispatch this workflow.
- `RESTORE_VERIFY_ALLOWED_SUBJECTS`: comma-separated Auth0 subject IDs allowed to request a restore drill.

`RESTORE_DATABASE_URL` must point to an isolated Neon recovery branch/database. Production must never be used as the restore target. The workflow does not accept a target database from user input.

The page is intentionally fail-closed: missing authorization configuration or dispatch credentials prevents execution.

After the dispatch, the workflow runs `infra/backup/restore-verify.sh` with `PGSSLMODE=verify-full` and `PGSSLROOTCERT=system`, then exposes the workflow run as the audit trail.
