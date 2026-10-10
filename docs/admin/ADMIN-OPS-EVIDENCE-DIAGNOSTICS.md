# TMS Admin Control Center — Operações, Evidências e Administração

**Branch:** `feat/admin-ops-evidence-diagnostics-2026-10-10`  
**Base:** `main`  
**Status:** implementação incremental; integrações não disponíveis permanecem explicitamente `unknown` ou pendentes.

## Objetivo

Evoluir o `/admin` sem promover evidências incompletas nem confundir presença de infraestrutura com execução funcional.

## 1. Central de saúde operacional

Implementado no Web:
- BFF autenticado em `GET /api/tms/admin/health`.
- Probes sem cache para API `/health` e `/ready`, com timeout de 4,5 s.
- Estados `healthy`, `degraded`, `blocked` e `unknown`.
- A interface identifica a hora e latência de cada probe.
- OIDC/tenant claims, Railway Worker/durable jobs e backups permanecem `unknown` até haver integração de telemetria confiável e evidência recente.

**Semântica:** `/health = 200` demonstra liveness do endpoint; `/ready = 200` demonstra somente os checks que esse endpoint realmente executa. Nenhum dos dois, sozinho, comprova login real, isolamento entre tenants, processamento de jobs ou restore de backup.

## 2. Evidence Ledger

A UI atual consome `/api/tms/project-control` e exibe evidências, estado, fonte, referência e data quando fornecida pela API. Para completar o ledger de governança, o contrato de backend precisa persistir e devolver:
- `evidenceCode`, título, tipo, resultado (`PASS|FAIL|BLOCKED|NOT_RUN`) e nível (`E0|E1|E2|E3|E4`);
- módulo/etapa e critério de aceitação;
- origem verificável (URL de workflow/deployment/log ou identificador de teste), commit SHA, ambiente e timestamp;
- request/correlation IDs e referência segura ao artefato;
- ator/responsável, validade/expiração e motivo de invalidação.

**Regra de promoção:** evidência E0/E1 não se promove a E2/E3/E4 por rótulo, deployment `READY` ou endpoint isolado. Cada promoção exige critério, artefato e resultado verificáveis.

## 3. Diagnóstico correlacionado

A UI já identifica a cadeia de rastreabilidade esperada e permite preparar um identificador de consulta. A busca real de logs ainda não é declarada funcional: falta um endpoint server-side autorizado que agregue fontes de Web/BFF, Core API, PostgreSQL/outbox, Railway worker e auditoria.

Contrato recomendado:
- `GET /api/tms/admin/diagnostics?kind=requestId|correlationId|event_id|idempotency_key|freightId|jobId&value=...`
- validar formato/tamanho e restringir janela temporal;
- aplicar autenticação e autorização administrativa server-side, tenant context e RLS;
- devolver eventos sanitizados e ordenados, com timestamps, serviço, resultado e IDs correlacionados;
- nunca devolver bearer tokens, cookies, secrets, credenciais, connection strings ou payloads sensíveis.

Cadeia-alvo: `Web → BFF → Core API → PostgreSQL → outbox → durable_jobs → handler → audit/telemetry`. A prova E4 de worker requer o mesmo `event_id`/`idempotency_key`, execução real, replay idempotente e teste negativo cross-tenant.

## 4. Administração segura

A seção de administração registra os controles necessários, sem expor botões de mutação ainda sem backend:
- **Usuários/memberships/RBAC:** consultar e alterar via API com permission checks server-side, tenant scope e auditoria.
- **Auditoria administrativa:** ator, tenant, ação, alvo, resultado, timestamp e request/correlation ID; sem segredos.
- **Deploys/rollback/replay:** integrar com provedores autorizados, exigir permissão específica, confirmação explícita, idempotência e trilha auditável.
- A sessão Auth0, por si só, não prova privilégio administrativo. Antes de habilitar mutações, verificar claims/permissions reais e impor autorização na API, não apenas esconder controles na UI.

## 5. Endpoints e próximo trabalho

| Endpoint | Estado nesta entrega | Próximo requisito |
|---|---|---|
| `GET /api/tms/project-control` | Existente | Adicionar metadados completos do ledger sem inventar E-level |
| `GET /api/tms/admin/health` | Implementado no Web | Testar sessão real e confirmar semântica de `/ready` |
| `GET /api/tms/admin/diagnostics` | Pendente | Agregação segura de logs/telemetria |
| `GET /api/tms/admin/audit` | Pendente | Trilha de auditoria protegida |
| `GET /api/tms/admin/memberships` | Pendente | Auth0 + membership + RBAC + tenant isolation |
| `GET /api/tms/admin/deployments` | Pendente | Integração autenticada com provedores |

## Critérios de aceitação

- [ ] Typecheck e build do Web aprovados no CI.
- [ ] `/admin` exige sessão real e a API valida autorização administrativa.
- [ ] Saúde: respostas reais, timeout e indisponibilidade exibidos sem falsos PASS.
- [ ] Ledger: artefatos rastreáveis, nível E e critérios de aceitação persistidos.
- [ ] Diagnóstico: IDs correlacionados através da cadeia sem dados secretos.
- [ ] Auditoria de toda ação administrativa com tenant e ator.
- [ ] Testes positivos e negativos de isolamento cross-tenant.
- [ ] Nenhuma alteração de dados de produção/replay sem autorização e evidência prévia.
