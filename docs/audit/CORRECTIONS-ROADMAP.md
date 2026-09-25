# TMS — Roadmap de Correções, Refatoração, Limpeza e Infraestrutura

> Documento derivado do `docs/audit/AUDIT-TRACKER.md`.
> Ordem orientada por risco e dependência. Nenhuma tarefa deve ser marcada como concluída sem evidência registrada no tracker.
> Regra: primeiro fechar P0 operacional; depois P1; só então executar P2/refatorações e limpeza ampla.

## 1. Ordem executiva

| Ordem | ID(s) | Tipo predominante | Ação | Pré-condição | Critério de encerramento |
|---:|---|---|---|---|---|
| 1 | DB-01 | Evidência operacional / funcional | Reconciliar migration head e checksums de produção | Acesso read-only ao projeto/branch Neon correto | `schema_migrations` live comprova 0033 e checksums 0032/0033 |
| 2 | DB-04 | Segurança / funcional | Provar RLS comportamental cross-tenant com credencial real de runtime | DB-01 e identificação da role/runtime | Leituras/escritas cross-tenant são negadas; tenant correto funciona |
| 3 | AUTH-01 | Segurança / funcional | Executar E2E real Auth0 → Web → API → DB | Acesso operacional Auth0 + usuário de teste | Token novo contém claim; API aceita tenant correto e rejeita tenant incorreto |
| 4 | SEC-01 | Segurança / funcional | Fechar isolamento tenant E4 | DB-04 + AUTH-01 | Evidência conjunta de AuthZ, membership, contexto e RLS |
| 5 | REL-01 | Release / infraestrutura | Criar manifesto versionado da release efetiva | DB-01 + reconciliação Vercel/Railway | SHA efetivo por componente + migration head + referência de configuração |
| 6 | FINAL-01 | Governança / qualidade | Executar regressão final e DoD | P0 encerrados | Todos os gates P0 verdes ou formalmente aceitos com evidência |
| 7 | CI-10 | Infraestrutura / governança | Proteger `main` e exigir checks apropriados | Política de merge definida | Branch protection/ruleset efetivo e validado |
| 8 | DB-02/DB-06 | Banco / CI | Endurecer baseline e validação de migrations | DB-01 encerrado | Caminho normal não mascara drift e valida schema/checksums completos |
| 9 | API-02/03/04 + SEC-03 | Segurança / funcional | Endurecer replay | Semântica de replay definida | Permissão dedicada, negativos, auditoria e repetição testados |
| 10 | API-06 | Segurança / funcional | Restringir/redefinir endpoints de diagnóstico | Política operacional definida | Exposição mínima e testes de autorização |
| 11 | WORK-01/02/03/14/15 + RAIL-02/05 | Runtime / infraestrutura | Fechar prova E4 do worker | Worker efetivo identificável | Evento real percorre outbox → durable job → handler → audit |
| 12 | BAK-01/02 + DR-01 | Infraestrutura / DR | Recuperar artefato e executar restore independente | Acesso ao objeto de backup | Restore atual reproduzível com RPO/RTO medidos |
| 13 | BAK-04/05 + RAIL-07 | Infraestrutura / hardening | Definir RPO/RTO, alerta e hardening criptográfico | Restore conhecido | Política aprovada e controles operacionais verificáveis |
| 14 | ENV-01/02/03 | Infraestrutura / configuração | Reconciliar ambientes e contrato de variáveis | Ownership de dev/staging definido | Matriz por ambiente e workflow seguro comprovados |
| 15 | OBS-01 + WORK-03 | Observabilidade | Implantar readiness/health/telemetria/alertas mínimos | Contrato operacional definido | Healthy-idle vs unhealthy distinguíveis e alertáveis |
| 16 | BUILD-01/02/03 + WEB-02/10/13 + DEPLOY-09 | Build/deploy | Tornar promoção e toolchain determinísticos | Manifesto de release | Instalação, Node, promoção e escopo por componente documentados/testados |
| 17 | DOC-01/03/04 + DOC-02 | Documentação | Reconciliar SSOT e históricos | P0/P1 operacionais estabilizados | Docs não apresentam estado histórico como corrente |
| 18 | SEC-02/CONFIG-01 | Refatoração | Centralizar configuração efetivamente | Contrato de env fechado | `process.env` restrito às fronteiras aprovadas |
| 19 | DB-05 + PKG-08 + PKG-01/02/05/06/07/08 | Limpeza/refatoração | Tipagem, dependências e código órfão | Comportamento funcional estabilizado | Grafo de pacotes coerente, sem `any` nos caminhos definidos e sem órfãos confirmados |
| 20 | WEB-01/03/11/12 | Refatoração | Decompor frontend e reforçar testes/configuração | Contrato API/auth estável | Mesma semântica funcional com unidades menores e testes |
| 21 | TEST-01 | Qualidade | Aumentar cobertura/gates | P0/P1 fechados | Cobertura e gates alinhados ao risco real |
| 22 | OBS-02 | Limpeza/hardening | Revisar sinks, retenção e exposição de logs | Política de observabilidade definida | Logs de produção com retenção e acesso compatíveis com o risco |

## 2. P0 — Bloqueadores de segurança, integridade e release

### P0.1 — DB-01: migration head/checksum

**Não corrigir schema por inferência.**

1. Identificar o projeto Neon `tms` e o branch de produção correto.
2. Executar consulta read-only em `schema_migrations`.
3. Comparar head e checksums com os arquivos 0032 e 0033 do repositório.
4. Se houver drift, parar e registrar evidência antes de qualquer migration.
5. Só depois decidir se a correção é migration, baseline hardening ou documentação.

**Não usar `migration_count=33` do backup como substituto da consulta live.**

### P0.2 — DB-04: RLS comportamental

1. Confirmar role efetiva do runtime.
2. Selecionar dois tenants existentes sem alterar dados.
3. Com a role de runtime, executar contexto tenant A e tentar acessar tenant B.
4. Repetir com tenant B.
5. Validar tanto leitura quanto operação de escrita em cenário controlado; se escrita em produção não for autorizada, usar evidência equivalente em ambiente/branch seguro e manter o limite explicitado.
6. Registrar resultado, role, tenant IDs anonimizados e SQL não sensível.

**Resultado exigido:** tenant correto funciona; tenant incorreto não atravessa RLS.

### P0.3 — AUTH-01: Auth0 E2E

1. Obter acesso operacional ao Auth0.
2. Emitir token novo para usuário de teste.
3. Validar issuer, audience, assinatura/JWKS, expiração e claim tenant.
4. Passar pelo Web/API real.
5. Confirmar membership/role no TMS.
6. Confirmar autorização tenant-scoped.
7. Testar tenant incorreto/ausência de membership.
8. Nunca registrar ou persistir o token.

**Bloqueio atual:** a conexão desta sessão não expõe uma capacidade Auth0 operacional; não inferir deployment/trigger/token real a partir do código-fonte.

### P0.4 — SEC-01: isolamento tenant

Fechar somente depois de DB-04 e AUTH-01. A evidência deve demonstrar defesa em profundidade, não apenas uma camada isolada.

### P0.5 — REL-01: manifesto

Criar depois da reconciliação operacional. O manifesto deve registrar:

- aplicação auditada;
- SHA efetivo de Web;
- SHA efetivo de API;
- SHA efetivo de Worker;
- migration head/checksum;
- versão Node/pnpm relevante;
- referências de configuração sem segredos;
- status dos gates P0.

### P0.6 — FINAL-01

Não iniciar “limpeza final” antes do fechamento dos P0. O DoD deve ser uma consequência das evidências, não uma declaração antecipada.

## 3. P1 — Correções funcionais e infraestrutura

### Segurança/API
- API-02: permissão dedicada para replay.
- API-03: decisão explícita sobre replay repetível versus idempotente.
- API-04: testes negativos/positivos do replay.
- API-05: documentação do replay.
- API-06: reduzir superfície dos diagnósticos.
- SEC-03: auditoria, motivo estruturado e controles de replay.

### Worker/runtime
- WORK-01: versão efetiva do worker.
- WORK-02: evento real `freight.status_changed`.
- WORK-03/14: readiness e estado operacional.
- WORK-04/06/07: idempotência, lease e falhas de publicação.
- WORK-15: evidência E4.
- RAIL-02/05: healthcheck e promoção efetiva.

### Backup/DR
- BAK-01: objeto real.
- BAK-02: verificação independente.
- DR-01: restore atual.
- BAK-04: RPO/RTO.
- BAK-05: revisão de AES-CBC + sidecar SHA-256.
- RAIL-07: política de falha/restart/alerta.

### Ambientes/build/deploy
- ENV-01/02/03.
- BUILD-01/02/03.
- CI-02/05/06/07/10.
- WEB-02/10/13.
- DEPLOY-09.

### Observabilidade/documentação
- OBS-01.
- DOC-01/03/04.

## 4. P2 — Refatoração, limpeza e dívida técnica

Somente após estabilização P0/P1:

- centralização efetiva de configuração;
- remoção de `any` nos repositórios auditados;
- remoção/revisão de pacotes e símbolos órfãos;
- dependências diretas coerentes no monorepo;
- refatoração incremental de `apps/web/src/app/page.tsx`;
- cobertura adicional e gates;
- revisão de mensagens de erro/configuração;
- remoção ou ajuste do Dockerfile secundário Node 22;
- reconciliação dos diagramas Mermaid com runtime;
- revisão de sinks/retention dos logs.

## 5. Regras de execução

1. Evidência antes de alteração quando o finding for operacional.
2. Alteração de produção somente com necessidade demonstrada e autorização aplicável.
3. Não criar dados artificiais de produção para fabricar evidência.
4. Não igualar SHAs de componentes sem demonstrar que o componente deveria ter sido promovido.
5. Não executar migration em produção para “testar” DB-01.
6. Não sincronizar development/staging destrutivamente.
7. Não expor segredos, tokens, URLs de banco ou material criptográfico.
8. Cada avanço deve atualizar `docs/audit/AUDIT-TRACKER.md`.
9. Cada correção deve apontar para evidência reproduzível.
10. A ordem só pode ser alterada se uma dependência técnica ou risco concreto for registrado no tracker.

## 6. Estado inicial da Fase 2

- Fase 1: concluída.
- Fase 2: iniciada.
- Primeiro alvo: P0.
- DB-01: tentativa de consulta live iniciada, mas a ferramenta Neon disponível nesta sessão exige `project_id`; o identificador não está disponível no contrato exposto. Nenhuma mutation foi executada.
- AUTH-01: capacidade Auth0 específica solicitada não está disponível nesta sessão; nenhuma inferência E4 será feita.
- CI run 36080140034 do HEAD `c4fcb3ba...`: concluído como `cancelled`, portanto não deve ser tratado como CI verde.
- Avanço posterior: run `36081162875` / #1139 no SHA `2eb43e87...` terminou `success`, fechando CI-01 para esse HEAD de controle/documentação.


## 7. Avanço da Fase 2 — CI-01 fechado

### 7.1 Evidência

O run GitHub Actions `36081162875` / #1139 no SHA `2eb43e87bb8005cbfb6d65c7808e34dde725cca4` terminou `success`. O job `107903222930` passou architecture check, migration, runtime role/RLS/IAM, integrações outbox/durable jobs/replay, format, lint, typecheck, test e build.

### 7.2 Interpretação operacional

CI-01 pode ser marcado **FECHADO/COMPROVADO** para o HEAD de controle/documentação atual. A evidência não fecha DB-01, DB-04 ou AUTH-01, pois esses itens exigem runtime/credenciais externos ao CI.

Os quatro status externos observados no mesmo commit — tms-worker, tms-backup-worker, tms-web e tms-core-api — também retornaram `success`. Eles permanecem evidência de deploy/integridade do pipeline externo, não prova dos P0 operacionais.

### 7.3 Próximo passo

Manter DB-01 como primeiro bloqueador: resolver a incompatibilidade do conector Neon para executar a consulta read-only de `schema_migrations`. Nenhuma migration ou alteração de produção deve ser executada para contornar essa ausência de evidência.

## 8. Avanço da Fase 2 — DB-01: bloqueio de tooling reproduzido em `get_branch`

### 8.1 Evidência adicional

Uma nova tentativa read-only usando `get_branch` para `br-lingering-shadow-act0vvi9` retornou erro de validação do backend exigindo `project_id`, embora o schema exposto do método aceite somente `branch_id`.

### 8.2 Estado

DB-01 continua **BLOQUEADO por incompatibilidade do conector Neon**. O bloqueio agora está reproduzido também no resolvedor de branch, não apenas nos caminhos de listagem/descrição/SQL já registrados no tracker.

### 8.3 Regra preservada

Não usar `get_connection_string` como workaround: a ferramenta informa que ele retorna uma credencial privilegiada e não está disponível em modo read-only. Não expor ou copiar segredo para fabricar evidência de migration head.

### 8.4 Próximo passo

Continuar o desbloqueio por capacidade de consulta read-only compatível com o projeto `shiny-hall-34679912`. Enquanto o contrato permanecer incompatível, DB-01 não será fechado por inferência.


## 9. Avanço da Fase 2 — DDL recebido não fecha DB-01/DB-04

### 9.1 Evidência

O DDL recebido contém a estrutura atual do domínio e demonstra a presença estrutural de `schema_migrations`, dos campos de 0032/0033 e de nove tabelas `neon_auth`. fileciteturn54file0L226-L239 fileciteturn54file0L327-L413

### 9.2 Limite da evidência

O artefato não contém os registros de `schema_migrations`, policies RLS, `FORCE ROW LEVEL SECURITY` nem grants da role de runtime. Assim, ele não prova migration head/checksum nem isolamento comportamental.

### 9.3 Estado

- **DB-01:** BLOQUEADO por tooling; DDL estrutural não substitui consulta live.
- **DB-04:** BLOQUEADO; RLS habilitado no DDL, mas a evidência fornecida não contém policies/role/grants. fileciteturn54file0L23-L34
- **NEO-01..NEO-05:** nenhuma mudança de classificação; a presença de `auth`/`neon_auth`/`pgrst` não prova adoção da Data API.

### 9.4 Regra de execução

Não criar migration corretiva, não alterar RLS e não migrar o acesso do TMS para Data API com base apenas neste DDL. O próximo avanço continua sendo desbloquear a consulta read-only autoritativa do Neon.


## 10. Avanço Fase 2 — 2026-09-25 — DB-01 revalidado

### Evidência

Nova execução da auditoria tentou novamente resolver o projeto Neon e preparar a consulta read-only de `schema_migrations`. O backend continua exigindo `project_id`, enquanto o contrato exposto dos métodos usados não aceita esse parâmetro. A tentativa com `project_id` em `list_branches` foi rejeitada pelo schema local; `describe_project({})` foi rejeitado pelo backend por ausência do mesmo identificador.

### Estado

- **DB-01: BLOQUEADO POR TOOLING.**
- Projeto canônico: `tms / shiny-hall-34679912`.
- Nenhuma leitura live de `schema_migrations` foi obtida.
- Nenhuma migration ou mutation de produção foi executada.
- Nenhum segredo/connection string privilegiado foi usado para contornar o bloqueio.

### Baseline confirmado

O diretório `packages/database/migrations/` do repositório contém 0001–0033, incluindo 0032 e 0033. Isso confirma apenas o baseline de código. Os checksums versionados de 0032/0033 continuam sendo referência de comparação, não evidência do banco live.

### Regra de execução

Não marcar DB-01 como concluído por DDL, contagem histórica, backup, CI ou presença de arquivos. Não executar migration corretiva para “alinhar” produção enquanto o estado live não estiver comprovado.

### Próximo passo

Resolver a incompatibilidade da integração Neon e obter consulta read-only autoritativa de `schema_migrations`. Depois: DB-04 → AUTH-01 → SEC-01 → REL-01.


## 43. FASE 2 — 2026-09-25 — bloqueio Neon reproduzido no executor SQL

Foi feita uma tentativa direta de consulta **read-only** ao branch de produção conhecido `br-lingering-shadow-act0vvi9`, usando `SELECT version, checksum FROM public.schema_migrations ORDER BY version`.

O executor `run_sql` exposto aceita `sql`, `branch_id` e `database_name`, mas o backend rejeitou a chamada exigindo `project_id`, campo que não existe no contrato exposto dessa ferramenta. A mesma incompatibilidade já havia sido observada na resolução de branches/databases.

**Conclusão:** a consulta autoritativa ainda não foi desbloqueada. DB-01 permanece **BLOQUEADO POR TOOLING**. DB-01 tooling incompatibility reproduced at run_sql/database-resolution layer. No production mutation performed. Sequential DB-04/AUTH-01/SEC-01/REL-01 must remain gated.

Nenhuma mutation, migration, alteração de branch ou alteração de dados foi executada.

**Gate preservado:** DB-04 → AUTH-01 → SEC-01 → REL-01 só avançam após evidência operacional suficiente de DB-01, sem inferência.


## 44. FASE 2 — 2026-09-25 — projeto/branch fornecidos; consulta preparada, mas leitura de linhas ainda bloqueada

Projeto/branch canônicos fornecidos para a execução:
- `tms / shiny-hall-34679912`
- `main / br-lingering-shadow-act0vvi9`
- `neondb`

O plano read-only de `SELECT version, checksum FROM public.schema_migrations ORDER BY version` foi validado com sucesso, confirmando a existência da relação/colunas no alvo. Isso não substitui os registros live.

A execução efetiva continua bloqueada porque o backend exige `project_id` no executor SQL, mas o contrato exposto não aceita esse campo. O project ID correto já foi fornecido; o problema remanescente é de compatibilidade do conector, não de identificação do projeto.

**DB-01 permanece BLOQUEADO POR TOOLING.** Nenhuma alteração de produção foi executada. O próximo passo é obter uma capacidade SQL read-only que aceite/encaminhe `project_id`; somente então registrar head/checksums e avançar para DB-04 → AUTH-01 → SEC-01 → REL-01.


## 45. DB-01 — evidência live recebida e gate fechado

### Evidência
A saída read-only autoritativa de `public.schema_migrations` para o Neon canônico `tms / shiny-hall-34679912`, branch `main / br-lingering-shadow-act0vvi9`, contém as migrations `0001`–`0033` em sequência.

Os dois checksums que eram necessários para reconciliar o novo head com o baseline do repositório coincidem exatamente:

| Migration | Live | Repositório |
|---|---|---|
| 0032_observability_audit_context.sql | `1c8e70d30f1bbd9442682035b7c08e8fdc3ed619b83615f8eb033bbb4cc45e78` | `1c8e70d30f1bbd9442682035b7c08e8fdc3ed619b83615f8eb033bbb4cc45e78` |
| 0033_durable_job_idempotency.sql | `d18c0849023fd07407350cbd1bb38a1b4caf0074242b7ff4bf8cd59d426b2a3c` | `d18c0849023fd07407350cbd1bb38a1b4caf0074242b7ff4bf8cd59d426b2a3c` |

### Decisão
**DB-01 = FECHADO / COMPROVADO.** O bloqueio de tooling foi superado pela obtenção da evidência read-only autoritativa. Não houve migration corretiva nem qualquer mutation no banco.

### Próxima ação sequencial
Executar **DB-04**: prova comportamental de isolamento cross-tenant com a credencial/papel real de runtime, cobrindo leitura e escrita negativa entre tenants. Depois, e somente depois, avançar para **AUTH-01 → SEC-01 → REL-01** conforme o gate definido no tracker.

### Não fazer
- não reaplicar 0032/0033;
- não executar migration apenas para “confirmar” o estado já comprovado;
- não considerar DB-01 como evidência de RLS comportamental;
- não antecipar correções funcionais antes da prova DB-04.


## 46. DB-04 — E4 cross-tenant ainda bloqueado

A auditoria avançou do DB-01 para DB-04. A leitura do repositório confirma a intenção de least privilege do papel `tms_app` e as policies tenant-scoped, mas isso é evidência estrutural, não prova comportamental.

A tentativa de consultar diretamente o papel/runtime no Neon foi bloqueada pela mesma incompatibilidade de contrato do conector: o backend requer `project_id`, enquanto o schema exposto da operação não aceita esse parâmetro.

### Critério de fechamento DB-04
Usar `tms_app` em conexão real e demonstrar:
1. tenant A lê seus próprios registros;
2. tenant A não lê registros do tenant B;
3. tenant A não insere registro com `tenant_id` de B;
4. tenant A não atualiza registro de B;
5. `current_user = 'tms_app'` e `rolbypassrls = false` na mesma evidência;
6. nenhum resultado positivo de cross-tenant é tolerado.

**Estado: BLOQUEADO / E4 PENDENTE.** Não executar alterações de schema ou relaxamento de RLS para viabilizar o teste.


## 10. Avanço da Fase 2 — DB-04: credenciais identificadas, E4 ainda pendente

As referências de conexão fornecidas para `neondb` permitem identificar as roles de runtime/infraestrutura e o endpoint do banco, mas os segredos foram redigidos. Isso é suficiente para planejar o teste, não para abrir uma sessão autenticada como `tms_app` nesta sessão.

O conector Neon continua rejeitando `run_sql` por exigir `project_id` não exposto no schema da ferramenta. Não será usado `neondb_owner` como substituto de `tms_app`, pois isso invalidaria a prova de `NOBYPASSRLS`/least privilege.

### Critério mantido

DB-04 só fecha com evidência executada sob `tms_app` contendo, no mínimo:

- `current_user = tms_app`;
- `rolbypassrls = false`;
- leitura do próprio tenant funcionando;
- leitura cross-tenant impedida;
- INSERT cross-tenant impedido;
- UPDATE cross-tenant impedido.

A evidência deve omitir senhas, tokens e connection strings completas.

### Próxima ação

Executar o teste no Neon SQL Editor ou em cliente PostgreSQL já autenticado como `tms_app`, devolver somente os resultados não sensíveis, e então reconciliar DB-04 no tracker. Sem esse resultado, não avançar para AUTH-01.


## 11. Continuação Fase 2 — Auth0, Data API e superfície HTTP

### AUTH-01

A auditoria confirmou novamente que o TMS implementa autenticação via **Auth0 externo**, com issuer/audience/JWKS e claim namespaced de tenant. Testes sintéticos/CI cobrem o contrato, mas não substituem token real e execução E4.

**Estado: ABERTO / E4 PENDENTE.**

A capacidade Neon Auth/Data API disponível no conector não deve ser usada como substituta do Auth0 real. As leituras de configuração Neon também permanecem bloqueadas pelo parâmetro `project_id` não exposto no contrato das ferramentas.

### API-11 / API-06

Endpoints de diagnóstico continuam sob `freight:read`:
`runtime-context`, `runtime-db-context`, `runtime-rls-isolation`, `runtime-auth-claims`.

**Estado: P1 — CONTROLE DE EXPOSIÇÃO.** Decisão operacional pendente antes de alteração.

### API-02 / SEC-03

Replay continua autorizado por `freight:update`, sem permissão dedicada.

**Estado: P1 — HARDENING PENDENTE.**

### CONFIG-01

O pacote `packages/config` centraliza definições, mas o AuthGuard continua consumindo `process.env` diretamente.

**Estado: P2 — DÍVIDA TÉCNICA**, a tratar somente após estabilização P0/P1.

### DB-03 / WORK

O worker verifica `current_user = tms_app` no startup, mas a prova da identidade efetiva e do fluxo de negócio em runtime continua pendente.

Nenhuma alteração funcional foi feita.


## 11. Avanço da Fase 2 — 2026-09-25 — DB-04 e limpeza de branches

### DB-04
A tentativa read-only mais recente de executar SQL no branch canônico continua rejeitada pelo backend por exigir project_id, embora o contrato exposto de run_sql não aceite esse campo. O projeto correto é tms / shiny-hall-34679912; o bloqueio é de integração da ferramenta, não de identificação.

**DB-04 permanece BLOQUEADO POR TOOLING / E4 PENDENTE.** Nenhuma mutation foi executada.

### Branches
A auditoria do GitHub identificou branches com ahead_by=0 em relação a main, portanto sem commits exclusivos no estado atual: hardening/p0-iam-tenant-20260915, hardening/durable-jobs-tenant-lifecycle-current-main, fix/blk-worker-01-freight-status-flow-2026-09-21, stage10.11-dr-safe-drill-evidence e stage10.10-backup-restore-readiness-v2.

Essas branches são candidatas a limpeza, não exclusões automáticas: antes de remover, deve-se verificar PR aberto/fechado, tags, referências operacionais e se a branch possui valor histórico que não esteja preservado em commits/docs.

Branches divergentes com commits exclusivos permanecem preservadas até reconciliação.

### Próximo passo
Resolver o bloqueio de DB-04 com uma sessão real tms_app; em paralelo, concluir a reconciliação de PRs/refs das branches ahead_by=0 antes de qualquer exclusão.


## 12. Avanço da Fase 2 — 2026-09-25 — reconciliação das branches candidatas

As cinco branches inicialmente candidatas foram reconciliadas com seus PRs: #34, #44, #63, #27 e #25 estão merged, e as branches estão `ahead_by=0` em relação a `main`.

Isso transforma a limpeza de hipótese em **candidatura tecnicamente fundamentada**, mas não em exclusão realizada. A conexão GitHub disponível não expõe uma operação de delete branch/ref nesta sessão.

Nenhuma branch divergente foi removida.


## 13. Avanço da Fase 2 — 2026-09-25 — DB-04: arquitetura runtime reconciliada

### DB-04 / runtime role

A sessão administrativa do Neon confirmou a postura completa de tms_app: LOGIN, NOSUPERUSER, NOBYPASSRLS e sem privilégios de criação de role/database ou replicação. A única membership observada é neondb_owner → tms_app.

A revisão do código confirma que API e worker usam conexão PostgreSQL direta via DATABASE_URL e validam current_user = tms_app; Neon Data API/Neon Auth não é o caminho efetivo do TMS. Não criar membership com authenticator sem requisito arquitetural.

A tentativa de obter a sessão runtime pela integração Railway não foi concluída porque a conexão disponível só lista tms-backup e não possui permissão de viewer para o recurso necessário. Portanto, o bloqueio restante é exclusivamente a observação/execução da sessão runtime e da matriz RLS.

Estado: DB-04 BLOQUEADO / E4 PENDENTE.

### Próxima ação

Obter uma sessão real autorizada como tms_app através do runtime existente ou de um cliente PostgreSQL autorizado. Não compartilhar credenciais. Executar own-tenant read, cross-tenant read, cross-tenant INSERT e cross-tenant UPDATE, registrando current_user e rolbypassrls na mesma evidência.


## 14. Avanço da Fase 2 — 2026-09-25 — prova operacional do API runtime role

Foi obtida evidência E4 adicional para a API de produção: `GET /ready` no domínio de produção respondeu HTTP 200 com `status=ready`. O código do controller executa `select current_user` e só retorna sucesso quando o papel é exatamente `tms_app`.

Isso permite elevar a evidência de adoção do papel runtime da API de estrutural para **operacionalmente comprovada**. A evidência não fecha DB-04 porque não demonstra `rolbypassrls=false` na mesma sessão nem as quatro operações de isolamento tenant.

As rotas autenticadas de diagnóstico `runtime-db-context` e `runtime-rls-isolation` também foram chamadas sem credencial e retornaram HTTP 401. Isso confirma a exigência de autenticação, mas não substitui o teste autenticado tenant-scoped.

### Estado / gates

- DB-03 (API runtime): **COMPROVADO operacionalmente**.
- DB-04: **BLOQUEADO / E4 PENDENTE**.
- Worker runtime role: **PENDENTE** por limitação de acesso ao Railway atual.
- AUTH-01: **PENDENTE** por ausência de token Auth0 real nesta sessão.

### Próxima ação

Priorizar uma sessão PostgreSQL real como `tms_app` para a matriz DB-04, ou evidência runtime equivalente que exponha `current_user` e `rolbypassrls` na mesma sessão e permita os testes own-tenant/cross-tenant de leitura e escrita. Manter schema/RLS imutados durante a prova.


## 15. Avanço da Fase 2 — 2026-09-25 — harness E4 de RLS confirmado sem promoção indevida

Foi identificado o harness `apps/worker/src/runtime-evidence.integration.test.ts`, que contém cenários reais para replay idempotente e isolamento cross-tenant. O cenário de isolamento cobre leitura, INSERT, UPDATE e DELETE negativos usando a conexão runtime separada da conexão administrativa de fixtures/cleanup.

A existência desse harness melhora a evidência de implementação/integrabilidade do controle, mas não substitui a execução no Neon de produção. Não foi disparado CI/redeploy para tentar fabricar evidência, pois a configuração de secrets poderia resultar em mutação de dados de ambiente.

Acesso Railway continua limitado ao projeto `tms-backup`, impedindo a observação direta do worker produtivo.

### Estado / gates

- DB-04: **BLOQUEADO / E4 PENDENTE**.
- DB-03 API: **COMPROVADO operacionalmente**.
- Worker runtime role: **PENDENTE**.
- Harness RLS: **E2/E3 COMPROVADO**.

### Próxima ação

Executar o harness somente em ambiente explicitamente autorizado, ou obter uma sessão `tms_app` equivalente no Neon de produção, preservando fixtures isoladas e sem compartilhar credenciais.


## 16. Auditoria adicional — contrato interno de emissão do outbox

### Achado

A cadeia `freight.status_changed → outbox_events → durable_jobs → handler → audit/telemetry` está implementada no caminho do serviço, mas a API do repositório permite um caminho alternativo sem outbox:

`PostgresFreightRepository.updateStatus()` → `updateStatusWithAudit()` sem `audit` → bloco de outbox condicionado a `if (audit)`.

O consumidor de produção atualmente observado (`FreightService.updateStatus()`) usa `updateStatusWithAudit()` com contexto de auditoria, portanto o achado é de **robustez de contrato interno**, não evidência de falha do endpoint atual.

### Classificação

- **WORK-02:** E2/E3 comprovado / E4 ainda aberto.
- **Novo subfinding:** `WORK-02a — status transition can bypass outbox through repository API`.
- **Prioridade:** P1.
- **Tipo:** correção funcional preventiva / endurecimento de contrato.
- **Sem mudança imediata em produção.**

### Lacuna de teste

`apps/worker/src/freight-status-flow.integration.test.ts` injeta diretamente um evento em `outbox_events` com conexão administrativa antes de executar o worker. Portanto, o teste não começa na operação de negócio `updateStatus` e não prova, sozinho, a atomicidade completa:

`status transition → outbox → durable job → handler → audit`.

### Correção planejada

1. criar teste de integração iniciando pela transição de status do serviço/repositório canônico;
2. afirmar que status e outbox são persistidos na mesma transação;
3. afirmar rollback conjunto quando a emissão do outbox falhar;
4. tornar a API de mudança de status incapaz de omitir os metadados necessários à emissão do evento, se isso for compatível com o desenho atual;
5. repetir CI e atualizar a evidência antes de qualquer promoção.

### Gate

Este achado não altera a classificação de DB-04, AUTH-01 ou E4 do worker. A próxima evidência operacional continua sendo uma sessão runtime real e, para o worker, um evento de negócio real no ambiente autorizado.


## 17. WORK-02a — refinamento de risco e garantia transacional

A auditoria de consumidores não encontrou uso interno de `PostgresFreightRepository.updateStatus()`. O caminho de produção conhecido usa `updateStatusWithAudit()` com contexto de auditoria.

A implementação de `withTransaction()` faz `BEGIN`, configura o tenant, executa o trabalho, só então faz `COMMIT`, e executa `ROLLBACK` em qualquer exceção. Isso sustenta a atomicidade do caminho canônico.

### Novo estado

- **WORK-02a:** P1 hardening/teste, não defeito funcional comprovado.
- **Risco atual:** API redundante/exportada pode permitir no futuro uma transição sem outbox/audit.
- **Lacuna de evidência:** falta teste de falha após o update e durante a gravação do outbox, verificando rollback conjunto.

### Próxima correção planejada

1. Adicionar teste de integração real para falha de outbox e rollback conjunto.
2. Avaliar remoção/privatização de `updateStatus()` ou tornar audit obrigatório.
3. Executar CI.
4. Só então considerar promoção da correção.

A auditoria continua sem mutation de produção.
