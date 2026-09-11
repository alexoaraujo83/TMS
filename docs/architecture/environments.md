# Environment Strategy

| Environment | Database | Purpose |
|---|---|---|
| local | `tms_dev` | developer workstation via Docker |
| development | dedicated DB | shared integration |
| staging/preview | dedicated DB | release validation |
| production | dedicated DB | live operations |

Never reuse a Nexora operational database. Never commit credentials. Production secrets must be supplied by the deployment platform/secret manager.

## Promotion

`local -> development -> staging/preview -> production`

Each promotion must pass formatting, lint, typecheck, tests, build, migration checks, smoke tests and the applicable security gates.
