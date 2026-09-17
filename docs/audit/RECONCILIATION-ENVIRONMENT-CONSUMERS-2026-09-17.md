# Reconciliação de Consumidores por Ambiente — 2026-09-17

## Objetivo

Reconciliar os ambientes documentados (`local`, `development`, `staging/preview`, `production`) com os consumidores reais observados em GitHub, Vercel, Railway e Neon, sem alterar dados, secrets, deployments ou branches de banco.

## Evidência canônica

- Repositório: `alexoaraujo83/TMS`
- HEAD auditado: `c2598353cc5b23ed156f328efc54ebcd3c609274`
- CI #817: run `35166754489`, push em `main`, conclusão `success`.
- O workflow CI executa migrations locais, valida RLS/IAM, integração PostgreSQL de Durable Jobs, format, lint, typecheck, test e build.

## Consumidores observados

| Ambiente | Neon | Vercel | Railway | Migrations automatizadas | Estado comprovado |
|---|---|---|---|---|---|
| local | `tms_dev` via Docker | não aplicável | não aplicável | local | documentado |
| development | branch Neon `development` | nenhum consumidor identificado | nenhum ambiente Railway identificado | nenhum workflow específico | banco existente, consumidor não comprovado |
| staging/preview | branch Neon `staging` | nenhum deployment recente de `target=preview` identificado no projeto auditado | nenhum ambiente Railway não-production identificado | nenhum workflow específico | banco existente, consumidor não comprovado |
| production | Neon `main` | projeto `tms-core-api`, deployment `c2598353...`, `READY`, target `production` | projeto `tms-backup`, ambiente `production`; `tms-worker`, `tms-backup-worker`, `backup-worker` | workflow `database-migrate.yml` usa GitHub Environment `production` e secret `NEON_DATABASE_URL` | consumidor comprovado |

## Vercel

Projeto observado: `tms-core-api`, framework NestJS, Node `24.x`.

Deployment de produção atual observado:

- deployment `dpl_CtGVZZNsLssodit5gKgEh6Ek4mDf`
- commit `c2598353cc5b23ed156f328efc54ebcd3c609274`
- estado `READY`
- target `production`
- integração GitHub para `alexoaraujo83/TMS` / branch `main`

Não foi comprovado neste levantamento um consumidor Vercel separado para `development` ou `staging/preview`.

## Railway

Projeto observado: `tms-backup`.

O projeto possui somente o ambiente Railway `production`.

Serviços observados:

- `tms-worker`
- `tms-backup-worker`
- `backup-worker`

Não foi comprovado ambiente Railway `development` ou `staging`.

O deployment histórico do `tms-worker` que foi validado operacionalmente continua sendo anterior ao HEAD atual; deployments posteriores relacionados a commits de auditoria foram registrados como `SKIPPED`. Portanto, status/check de integração não deve ser interpretado como prova de que o worker de produção esteja executando o HEAD atual.

## GitHub Actions

`database-migrate.yml` é explicitamente restrito a `main` e ao GitHub Environment `production`, usando `NEON_DATABASE_URL`. Não existe neste workflow uma etapa equivalente para `development` ou `staging`.

## Neon

As branches `main`, `development` e `staging` existem e estão acessíveis. A reconciliação anterior comprovou:

- `main`: 31 migrations até `0031_finance_relationship_invariants.sql`, 21 tabelas públicas e 9 tabelas `neon_auth`.
- `development`: sem `schema_migrations` e 11 tabelas públicas no levantamento.
- `staging`: sem `schema_migrations` e 11 tabelas públicas no levantamento.

A divergência é material. Nenhuma sincronização, reset ou migração destrutiva foi executada.

## Conclusão

A topologia atualmente comprovada é **production-first**. O código e a documentação definem `development` e `staging/preview`, mas seus consumidores externos e o fluxo de promoção não estão comprovados operacionalmente.

Isso mantém o bloqueador `BLK-001 — Environment drift` ativo. Não é permitido classificar `development` ou `staging` como ambientes operacionais ativos nem removê-los como órfãos sem evidência adicional de consumo, ownership e finalidade.

## Próximo passo obrigatório

Executar o **CHAT 15 — Environment Variables**, produzindo uma matriz segura de nomes de variáveis, origem/owner, ambiente, consumidor, criticidade e evidência de conectividade, sem revelar valores secretos. Em paralelo, reconciliar se o worker de produção deve ser promovido ao HEAD atual e se `OUTBOX_TENANT_IDS`/configuração de Durable Jobs possui owner e tenant autorizados.
