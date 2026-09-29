# Database integration test result — 2026-09-28

## Execution

Command executed by GitHub Actions on branch `chore/platform-cli-sdk-tooling-2026-09-28`:

```bash
RUN_DB_INTEGRATION=true pnpm --filter @tms/database test
```

Run: CI #1328 (run id `36401809459`).

## Result

**FAILED — exit code 1**

Test runner summary for the database package:

- tests: 71
- passed: 20
- failed: 37
- skipped: 0

The CI job successfully initialized PostgreSQL 17, installed dependencies, ran migrations, provisioned the non-bypass runtime role, and passed the dedicated RLS/IAM/worker integration steps that precede this command.

## Primary failures observed

1. Multiple integration tests invoke `pnpm migrate` from a runtime connection and fail with:
   - `permission denied for schema public`
2. The `updated-at` cleanup path fails with:
   - `must be owner of table carriers`
3. RLS negative-path assertions did produce the expected PostgreSQL policy errors for cross-tenant INSERT/UPDATE attempts:
   - `new row violates row-level security policy for table "freights"`

## Interpretation

This run does **not** establish a failure of the RLS policy itself. The dedicated RLS runtime integration step immediately before the full package suite passed, and the log contains expected RLS rejection events.

The full `@tms/database` suite is currently mixing runtime-role execution with tests that attempt schema/migration/ownership operations. Those tests are incompatible with the restricted `tms_app` runtime identity unless their fixture/admin connection handling is corrected.

## Artifact

The complete command output was saved by CI as artifact `database-integration-test-result` (artifact id `10960513429`) for run `36401809459`.

## Gate status

DB-04 E4 remains **not closed** by this run. No production database was modified by this execution; it ran against the ephemeral PostgreSQL service defined by CI.
