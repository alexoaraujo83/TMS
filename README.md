# TMS

Novo TMS/SaaS — fundação arquitetural independente, tendo o Nexora TMS como referência técnica e de auditoria.

## Princípios

- Novo código-base; não é fork do Nexora.
- Segurança e isolamento multi-tenant desde a fundação.
- P0/P1 bloqueiam promoção para produção.
- Ambientes separados: local, development, staging/preview e production.
- PostgreSQL como banco principal.
- Web: Next.js + TypeScript.
- API: NestJS + TypeScript.
- Worker para processamento assíncrono.
- Monorepo com pnpm + Turborepo.

## Domínios

Tenancy, IAM/Security, Database, Freight, Matching, Finance, Audit e Operations.

## Status

Foundation initialized. Implementação funcional será feita por etapas, com testes e gates de segurança antes de promoção.

## Referência

Nexora TMS: https://github.com/alexoaraujo83/nexora-tms
