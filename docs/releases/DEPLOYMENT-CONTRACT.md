# TMS Deployment Contract

## Current Railway topology

The Railway project is currently named `tms-backup` and contains two production services with distinct responsibilities:

```text
Railway project: tms-backup
└── production
    ├── tms-worker
    │   └── durable jobs / outbox consumer
    └── tms-backup-worker
        └── backup / disaster recovery
```

The project name is currently retained for compatibility and operational continuity. A later infrastructure change may rename the project to remove the ambiguity between the business worker and the backup worker. That rename is intentionally **not** part of this documentation-only change.

## Deployment decision contract

A commit reaching `main` does not imply that every runtime must be redeployed. Each deployable component has an independent effective SHA.

```text
commit
  │
  ├── changes relevant to worker/runtime paths?
  │      ├── yes → deploy tms-worker
  │      └── no  → SKIPPED is intentional
  │
  └── changes relevant to backup/DR paths?
         ├── yes → deploy tms-backup-worker
         └── no  → SKIPPED is intentional
```

The same principle applies to the independent Vercel projects `tms-web` and `tms-core-api`: their production SHAs may differ from each other and from `main` when a component has not required a new deployment.

## Release manifest requirement

Every production release observation must record, at minimum:

- repository SHA;
- effective Web SHA and Vercel deployment ID;
- effective API SHA and Vercel deployment ID;
- effective Worker SHA and Railway deployment ID;
- effective Backup Worker SHA and Railway deployment ID;
- database migration head.

The authoritative versioned record for the current observed state is `docs/releases/2026-09-26.json`.

## Interpretation of SKIPPED

`SKIPPED` is not a deployment failure when the service has no relevant source/configuration changes for the commit. It must remain traceable to the service's watch/deployment contract. A deployment should be considered stale only when a relevant change exists and the service did not deploy.

## Future project rename

Before renaming the Railway project, the following must be completed:

1. verify service/source/configuration references;
2. update operational documentation and dashboards;
3. verify CI/CD references and deployment integrations;
4. verify environment variables and external references;
5. perform the rename during a controlled maintenance window;
6. verify both services after the rename;
7. update the release manifest and audit evidence.
