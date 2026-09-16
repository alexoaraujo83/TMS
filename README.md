# TMS

Novo TMS/SaaS construído do zero, com código-base, banco de dados, ambientes e ciclo de release próprios.

## Current foundation

- TypeScript monorepo
- pnpm + Turborepo
- Next.js Web
- NestJS API
- asynchronous Worker
- PostgreSQL/Neon
- multi-tenant by design
- security gates before production promotion

## Architecture

See:

- `docs/architecture/FOUNDATION.md`
- `docs/architecture/DOMAIN-MAP.md`
- `docs/architecture/ROADMAP.md`

## Environments

The dedicated PostgreSQL/Neon infrastructure uses independent `main`, `development` and `staging` environments. Application deployment configuration is maintained independently from external projects.

## Development principle

The implementation follows:

`design -> implement -> test -> verify -> document -> integrate`

No capability is considered complete only because a screen or endpoint exists; tenant isolation, authorization, persistence, tests and operational behavior must also be covered.

## Release quality

Production promotion requires measured evidence for database integrity, tenant isolation, authorization, application behavior, worker execution, backup/restore, observability and deployment health.
