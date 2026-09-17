# TMS — Infrastructure Reconciliation — 2026-09-17

## Scope

Fresh reconciliation of the canonical `main` commit against Railway production services and the CI workflow. No deployment or destructive infrastructure action was performed.

## Canonical source

- Repository: `alexoaraujo83/TMS`
- Branch: `main`
- Canonical HEAD at audit time: `a4722dee78973d2ad1eb2aaf3e117c2999a61431`
- CI workflow continues to execute migration, runtime-role/RLS/IAM checks, Durable Jobs PostgreSQL integration, format, lint, typecheck, tests and build.

## Railway production reconciliation

Project: `tms-backup`
Environment: `production`

### `tms-worker`

- Source repository: `alexoaraujo83/TMS`
- Source branch: `main`
- Dockerfile: `Dockerfile`
- Start command: `node apps/worker/dist/main.js`
- Replicas: 1 in `sfo`
- Declared variable names include `DATABASE_URL` only; values were not inspected.
- Latest successful deployment remains commit `c4c29be78bb64f57d73de74c472ffbcd7a2e1754`.
- Deployments corresponding to `a3594140...`, `8125a025...` and `a4722dee...` are `SKIPPED`; therefore Railway worker runtime is not proven to be running the canonical HEAD.
- Prior successful runtime logs prove database runtime-role verification but report `configuredTenants=0`, `durableJobsEnabled=false`, `webhookEndpoints=0`, and idle state because `OUTBOX_TENANT_IDS` is not configured.

**Classification:** deployed and source-connected, but runtime activation and canonical-HEAD deployment are not proven.

### `tms-backup-worker`

- Source repository: `alexoaraujo83/TMS`
- Source branch: `main`
- Dockerfile: `infra/backup/Dockerfile`
- Start command: `/app/backup.sh`
- Cron: `0 2 * * *`
- Replicas: 1 in `sfo`
- Latest deployment: `50671657-1614-4b30-8afb-7730d4703954`
- Deployment commit: `a4722dee78973d2ad1eb2aaf3e117c2999a61431`
- Deployment status: `SUCCESS`
- Configuration declares backup/database/object-storage variables, but secret values were not inspected or recorded.
- Deploy logs returned no runtime entries for the queried deployment; this does not by itself prove that a backup job executed successfully.

**Classification:** scheduled backup service is configured and the canonical HEAD deployment succeeded; actual recurring backup execution still requires execution evidence.

### `backup-worker`

- Service exists in the same Railway production project.
- Current status has no active deployment/cron evidence.

**Classification:** unresolved topology/ownership item. Do not delete or repurpose without ownership evidence.

## Important discrepancy

GitHub status checks can report Railway-related success while the Railway deployment history shows `SKIPPED` for the canonical `tms-worker` commit. Runtime deployment state therefore must be established from Railway deployment records, not inferred from a status-check label alone.

## Environment matrix — current evidence

| Environment | Canonical SHA | Railway | Neon branch | Runtime conclusion |
|---|---|---|---|---|
| Development | Unknown | Unknown | `development` exists | Drift/ownership reconciliation pending |
| Staging | Unknown | Unknown | `staging` exists | Drift/ownership reconciliation pending |
| Production API | `a4722dee` repository baseline | Vercel evidence previously observed at `8125a025`; current Vercel direct listing unavailable due authorization scope | `main` | API deployment is behind repository HEAD based on last verified evidence |
| Production worker | `a4722dee` repository baseline | `tms-worker` latest SUCCESS is `c4c29be`; later commits are SKIPPED | `main` | Worker is behind repository HEAD and operationally idle |
| Production backup | `a4722dee` | `tms-backup-worker` SUCCESS on `a4722dee` | backup/restore topology requires separate proof | Scheduled service exists; execution proof pending |
| DR | N/A | restore/backup evidence exists | restore branches exist | Restore readiness remains under audit |

## Decision / blocker routing

1. Do **not** auto-deploy `tms-worker` to production merely to align SHA; first reconcile tenant lifecycle and required production configuration.
2. Do **not** invent or set `OUTBOX_TENANT_IDS` values.
3. Do **not** delete `backup-worker`; classify ownership and purpose first.
4. Continue environment reconciliation for Development/Staging before any destructive schema synchronization.
5. Continue backup execution/retention/RPO/RTO proof separately from deployment success.
6. Continue runtime route/permission smoke testing independently of `/health`.

## Evidence level

- Railway configuration/deployment metadata: **E4 — direct runtime platform evidence**.
- Worker runtime activation: **E4 — directly observed idle state**.
- Backup recurring execution: **not yet proven**.
- Production external webhook exactly-once semantics: **not claimed**.

## Next logical stage

Remain in **CHAT 13 — Infrastructure** until topology and deployment/consumer reconciliation are complete. Then enter **CHAT 14 — Environments**, carrying forward the explicit blockers above.
