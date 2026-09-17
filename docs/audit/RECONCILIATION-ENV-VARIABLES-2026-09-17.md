# Reconciliação do Contrato de Variáveis de Ambiente — 2026-09-17

## 1. Escopo

Auditoria do contrato de configuração no HEAD canônico `863165b8346c7023031913641e94524c8a7540c9`, comparando:

- `.env.example`;
- consumidores efetivamente observados no código;
- GitHub Actions;
- estratégia documentada de ambientes;
- configuração operacional já evidenciada para Railway/Vercel/Neon.

Nenhum valor secreto foi coletado, registrado ou exposto.

## 2. Evidência de baseline

CI do HEAD `863165b8346c7023031913641e94524c8a7540c9` foi executado no GitHub Actions como run #818 (`35167126135`) e terminou `success`.

## 3. Variáveis observadas como consumidores reais

### API

`apps/api/src/main.ts` consome:

- `CORS_ALLOWED_ORIGINS`;
- `PORT` (fallback `3001`).

`apps/api/src/common/database.module.ts` consome:

- `DATABASE_URL`.

`apps/api/src/common/auth.guard.ts` consome:

- `AUTH0_ISSUER_BASE_URL`;
- `AUTH0_AUDIENCE`;
- `AUTH0_JWKS_URL`.

O guard também valida o token OIDC com RS256 e exige o claim de tenant e membership ativo.

### Worker

`apps/worker/src/main.ts` consome:

- `DATABASE_URL`;
- `OUTBOX_TENANT_IDS`;
- `OUTBOX_WEBHOOK_URLS`;
- `OUTBOX_WEBHOOK_SECRET`;
- `OUTBOX_POLL_INTERVAL_MS` (default `5000`);
- `OUTBOX_BATCH_SIZE` (default `50`);
- `OUTBOX_WEBHOOK_TIMEOUT_MS` (default `10000`);
- `DURABLE_JOBS_ENABLED` (default `false`).

`apps/worker/src/config.ts` valida inteiros positivos para os parâmetros numéricos e UUIDs para `OUTBOX_TENANT_IDS`.

## 4. Divergências encontradas

### 4.1 `.env.example` incompleto para o runtime

O arquivo documenta `DATABASE_URL`, CORS e variáveis Auth0, mas não documenta explicitamente:

- `PORT`;
- `OUTBOX_TENANT_IDS`;
- `OUTBOX_WEBHOOK_URLS`;
- `OUTBOX_WEBHOOK_SECRET`;
- `OUTBOX_POLL_INTERVAL_MS`;
- `OUTBOX_BATCH_SIZE`;
- `OUTBOX_WEBHOOK_TIMEOUT_MS`;
- `DURABLE_JOBS_ENABLED`.

Isso impede que `.env.example` seja tratado como contrato completo do runtime.

### 4.2 Variáveis documentadas sem consumidor operacional comprovado nesta etapa

O `.env.example` contém também:

- `NODE_ENV`;
- `APP_ENV`;
- `APP_NAME`;
- `APP_URL`;
- `API_URL`;
- `DATABASE_DIRECT_URL`;
- `AUTH0_DOMAIN`;
- `AUTH0_CLIENT_ID`;
- `AUTH0_CLIENT_SECRET`;
- `TENANT_HEADER`;
- `WORKER_ENABLED`;
- `WORKER_CONCURRENCY`;
- `LOG_LEVEL`;
- `BACKUP_RETENTION_DAYS`.

Para esses itens, o consumidor não foi comprovado no conjunto de caminhos de runtime auditados nesta etapa. Eles não devem ser removidos automaticamente: precisam de classificação posterior como legado, documentação-only, consumo indireto ou configuração ainda não integrada.

### 4.3 Divergência de naming Auth0

O `.env.example` usa audiences `urn:tms:api:development|staging|production`. A arquitetura histórica do programa de auditoria usa `urn:nexora:tms:api:*`.

O código atual lê `AUTH0_AUDIENCE`, mas não fixa o valor. Portanto, o problema é de reconciliação de contrato/documentação/configuração entre ambientes, e não pode ser resolvido inventando um audience.

## 5. Classificação atual

| Item | Estado | Evidência | Ação |
|---|---|---|---|
| `DATABASE_URL` | COMPROVADO | API + worker | manter |
| `CORS_ALLOWED_ORIGINS` | COMPROVADO | API bootstrap | manter e validar por ambiente |
| `PORT` | CONSUMIDO / NÃO DOCUMENTADO | API bootstrap | incluir no contrato |
| `AUTH0_ISSUER_BASE_URL` | COMPROVADO | AuthGuard | provar valor por ambiente |
| `AUTH0_AUDIENCE` | COMPROVADO | AuthGuard | reconciliar naming/valor por ambiente |
| `AUTH0_JWKS_URL` | COMPROVADO | AuthGuard | provar valor ou fallback operacional |
| `OUTBOX_TENANT_IDS` | COMPROVADO | worker | configuração de produção permanece pendente |
| `OUTBOX_WEBHOOK_URLS` | COMPROVADO | worker | endpoint de produção permanece pendente |
| `OUTBOX_WEBHOOK_SECRET` | COMPROVADO | worker | secret operacional permanece pendente |
| `DURABLE_JOBS_ENABLED` | COMPROVADO | worker | não habilitar sem tenant/endpoint/observabilidade |
| parâmetros de polling/batch/timeout | COMPROVADO | worker | documentar defaults |
| variáveis restantes do `.env.example` | NÃO RECONCILIADAS | contrato ainda parcial | rastrear antes de remover |

## 6. Regras de segurança

- Não registrar valores de secrets no repositório.
- Não criar tenant IDs, audiences, endpoints ou secrets fictícios.
- Não sincronizar/destruir ambientes Neon por conveniência.
- Não habilitar Durable Jobs em produção apenas para obter atividade: primeiro provar configuração operacional e observabilidade.
- `DATABASE_URL` deve continuar apontando para a credencial de runtime restrita; migrations usam credencial administrativa separada.

## 7. Bloqueadores relacionados

- `BLK-001` — drift entre ambientes.
- `BLK-002` — worker sem tenants configurados.
- `BLK-006` — side effects externos de Durable Jobs ainda sem prova receiver-side.
- `BLK-008` — conectividade de cada ambiente com consumidor real ainda incompleta.

## 8. Próximo passo lógico

Avançar para CHAT 16 — GitHub / CI-CD, começando por:

1. reconciliar workflows, triggers e gates;
2. verificar quais branches/ambientes realmente promovem código;
3. verificar status e histórico de deployment por SHA;
4. reconciliar GitHub Actions com Railway/Vercel;
5. revisar proteção/regras do `main` quando a permissão permitir;
6. identificar gaps de promoção development → staging → production;
7. retornar a CHAT 15 somente se a reconciliação do contrato de variáveis revelar correção de código/documentação necessária.

## 9. Status

CHAT 15 — **PARCIAL / EVIDENCIADO**.

O contrato de variáveis está suficientemente mapeado para avançar para CI/CD, mas não está aprovado como configuração operacional completa de todos os ambientes.
