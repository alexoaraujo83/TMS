# TMS

Novo TMS/SaaS construído do zero, independente do Nexora TMS e usando-o apenas como referência técnica, arquitetural e de auditoria.

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

The dedicated Neon project is `tms`, with independent `main`, `development` and `staging` branches. Application deployment configuration is intentionally kept separate from Nexora.

## Development principle

The implementation follows:

`design -> implement -> test -> verify -> document -> integrate`

No capability is considered complete only because a screen or endpoint exists; tenant isolation, authorization, persistence, tests and operational behavior must also be covered.

## Reference

Nexora TMS is reference material only. The new TMS has its own codebase, database, environments and release lifecycle.
