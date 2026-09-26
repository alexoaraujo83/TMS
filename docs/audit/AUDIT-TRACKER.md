# TMS — Rastreador de Auditoria e Execução

> **Status:** VIVO / lista de trabalho canônica  
> **Última atualização:** 2026-09-25 23:55 -03:00
> **Repositório:** `alexoaraujo83/TMS`  
> **Branch:** `main`  
> **HEAD de main verificado antes desta atualização:** `7cdf6b769624f9fed24446dc6ebe47ede4b1a827`
> **Último HEAD funcional de aplicação explicitamente auditado:** `d304b2cdfacc6d78282648b1d5bd1243811a7b78`  
> **HEAD de controle/documentação anterior:** `c4fcb3ba598a0218142c11911b52d7a032eb24a4`  
> **Regra:** este arquivo registra somente evidência concreta já observada, estado atual, próxima ação recomendada e evidência exigida para encerramento. Itens não verificados permanecem ABERTOS/BLOQUEADOS.

## 1. Escopo e leitura cruzada da auditoria

Esta versão consolida a auditoria técnica cruzada entre código, banco/migrações, autenticação/autorização, worker/outbox/durable jobs, CI/CD, Vercel, Railway, documentação e recuperação/DR.

A regra de evidência é:

- **Comprovado:** existe evidência direta e reproduzível no código, CI ou runtime observado.
- **Parcial:** parte do requisito está comprovada, mas falta evidência operacional ou de integração.
- **Aberto/Bloqueado:** a conclusão depende de uma verificação ainda não executada ou de acesso que não está disponível.
- **Dívida técnica:** não bloqueia necessariamente a operação atual, mas deve ser tratada para reduzir risco.
- **Não inferir:** sucesso de deploy não equivale a sucesso funcional; SHA diferente entre componentes não equivale a defeito; documentação histórica não equivale a estado atual.

## 2. Snapshot atual da release

| Componente | Evidência concreta | Estado efetivo | Próxima ação |
|---|---|---|---|
| GitHub / main | HEAD da aplicação auditada é `fb0025aea93aed9ad134a3266f2e7274fb9bcda5` | CANÔNICO | Usar este SHA como referência da aplicação neste ciclo. |
| Vercel API | tms-core-api, deployment dpl_CExsdt8aHv7DRhZvQwdJoou1AbSp, READY, production, SHA 20ff155544c99e587100fa17aedeeeb6eda5a284; aplicação funcional auditada permanece fb0025... | CONTROLE/DOCUMENTAÇÃO ATUAL / CÓDIGO DE APP INALTERADO | Separar SHA de controle/documentação do HEAD funcional da aplicação no manifesto. |
| Vercel Web | tms-web, deployment dpl_9zSdC58f8hhwg1ejaURTyGRLznbK, READY, production, SHA 20ff155544c99e587100fa17aedeeeb6eda5a284; código funcional auditado permanece fb0025... | CONTROLE/DOCUMENTAÇÃO ATUAL / CÓDIGO DE APP INALTERADO | Registrar SHA efetivo e diferenciar deploy de controle de mudança funcional. |
| Railway worker | Deployment do SHA atual `74c88ebf-7046-4d01-836b-c72847e08255` foi SKIPPED; último worker principal conhecido como SUCCESS é `9d938334-b80c-4064-bd40-683620f950a2`, SHA `6348d2926f0b0cac120ff9350bb77bc0fce0903d` | SHA EFETIVO ANTERIOR | Verificar regras de watch/build e registrar o SHA efetivo. Não forçar deploy apenas para igualar SHAs. |
| Railway backup worker | Deployment `21278249-58dc-4121-85de-d866a71a1003` está SUCCESS no SHA atual | ATUAL / EXECUÇÃO DE BACKUP NÃO PROVADA | Obter evidência de artefato real, checksum e retenção. |
| CI | Run `36081162875` / #1139 no SHA `2eb43e87bb8005cbfb6d65c7808e34dde725cca4` concluiu `success`; job `107903222930` passou architecture check, migration, RLS/IAM/worker integration, format, lint, typecheck, test e build | COMPROVADO NO HEAD ATUAL DE CONTROLE | Manter CI separado da prova operacional de produção e repetir após mudanças funcionais relevantes |

## 3. Tabela mestre de execução

| ID | Área | Concreto hoje | Estado | O que fazer | Evidência de encerramento | Prioridade |
|---|---|---|---|---|---|---|
| REL-01 | Manifesto de release | API está no HEAD; Web/Worker podem permanecer em SHA anterior porque foram pulados como não afetados | ABERTO | Criar manifesto versionado com SHA do repositório, SHA efetivo de Web/API/Worker, head de migração e referências de configuração | Um único registro reconcilia todos os componentes de produção | P0 |
| DB-01 | Head de migração Neon | Repositório contém até `0035_diagnostics_permission_and_admin_replay.sql`; evidência independente de produção/main continua pendente para o head atual | BLOQUEADO | Executar verificação read-only autoritativa do `schema_migrations` e dos checksums 0032/0033 | Banco live comprova head e checksums esperados | P0 |
| DB-02 | Pipeline de migração | Workflow de produção define sempre `TMS_ALLOW_EXISTING_SCHEMA_BASELINE=true` | REVISÃO | Restringir baseline a bootstrap explícito ou provar formalmente por que o modo permanente é seguro | Caminho normal de produção não transforma silenciosamente schema vazio em baseline canônico | P1 |
| DB-03 | Papel de banco em runtime | Worker verifica em código que o usuário atual deve ser `tms_app`; adoção em runtime de produção ainda não foi comprovada | PARCIAL | Provar identidade do worker e grants efetivos em runtime | Worker em produção confirma papel aprovado e least privilege | P1 |
| DB-04 | RLS comportamental | RLS/FORCE RLS e `NOBYPASSRLS` estão implementados; teste E4 cross-tenant em produção ainda não foi executado | BLOQUEADO | Executar teste controlado de leitura/escrita cross-tenant com a credencial real de runtime | Operação cross-tenant é negada em produção | P0 |
| AUTH-01 | Claim tenant Auth0 | Action versionada define `https://tms-platform.io/claims/tenant_id`; API valida token, subject e membership | ABERTO | Emitir novo token real e rastrear Auth0 → Web → API → DB | Token real com claim de tenant é aceito e operação tenant-scoped funciona; tenant incorreto é negado | P0 |
| AUTH-02 | Paridade Auth0 | Contrato de variáveis existe; valores/configuração exatos do tenant Auth0 de produção não foram verificados independentemente | ABERTO | Reconciliar domínio, aplicação, API, Action, audience, issuer e JWKS sem expor segredos | Fingerprint/configuração documentada + E2E real | P1 |
| API-01 | Cobertura de rotas protegidas | Freight usa AuthGuard + PermissionGuard e permissões específicas por operação | PARCIAL | Criar matriz rota × permissão × validação × tenant e executar smoke tests | Todas as rotas de negócio possuem evidência de proteção e isolamento | P1 |
| API-02 | Permissão de replay | Endpoint usa `freight:replay`; migrations 0034/0035 criam e concedem explicitamente a permissão ao admin | CORRIGIDO ESTRUTURALMENTE / E4 PENDENTE | Executar matriz negativa/positiva em runtime | Usuário sem `freight:replay` recebe 403; papel autorizado executa replay | P1 |
| API-03 | Semântica de replay | Cada replay gera `replay:<eventId>:<randomUUID>`; chamadas repetidas criam jobs distintos | DECISÃO NECESSÁRIA | Definir se replay manual é deliberadamente repetível ou deve ser idempotente | Semântica documentada + teste de chamadas repetidas | P1 |
| API-04 | Testes do replay | A busca atual ainda não encontrou suíte dedicada específica para `replayStatusChangedEvent`/endpoint | ABERTO | Testar sucesso, evento inexistente, aggregate divergente, payload inconsistente, 403, isolamento tenant e repetição | Suite direcionada passa e entra no CI | P1 |
| API-05 | Documentação do replay | Documentação geral de freight não reflete claramente a nova operação de replay | DRIFT DOCUMENTAL | Atualizar API/ops e controles operacionais | Docs, permissão e operação coincidem | P1 |
| API-06 | Endpoints de diagnóstico em produção | Quatro endpoints usam `ops:diagnostics`; migration 0035 cria a permissão e concede explicitamente ao admin; operator bootstrap não recebe a permissão | CORRIGIDO ESTRUTURALMENTE / E4 PENDENTE | Executar 403 para operador e 200 para admin, mantendo tenant-scoped | Usuário funcional comum recebe 403; operador sem `ops:diagnostics` recebe 403; admin autorizado recebe 200 | P1 |
| WORK-01 | Deploy do worker | SHA atual foi SKIPPED; worker anterior permanece como versão efetiva | PARCIAL | Confirmar regras de watch e registrar SHA efetivo | Versão do worker é conhecida, intencional e observável | P1 |
| WORK-02 | Contrato de negócio do worker | Agora existe caminho fonte-controlado: `freight.status_changed → outbox_events → durable_jobs → freight-status-changed.handler.ts → audit/telemetry`; há teste de integração CI | E2/E3 COMPROVADO / E4 ABERTO | Reconciliar contrato com Neon/Railway de produção e processar evento real | Evento real percorre todo o fluxo em runtime de produção | P1 |
| WORK-03 | Prontidão operacional | Worker valida `tms_app` e tenants ativos, mas ainda pode ficar idle quando `OUTBOX_TENANT_IDS` está vazio; métricas de ciclo/último sucesso ainda são insuficientes | ABERTO | Expor readiness/telemetria para processo, DB, role, tenants, outbox, durable jobs e último ciclo | É possível distinguir healthy-idle de unhealthy | P1 |
| WORK-04 | Idempotência Durable Jobs | TMS usa chave determinística do evento no fluxo normal; handler tem proteção de replay; deduplicação atômica no destino externo continua dependência externa | PARCIAL / CORRETO | Preservar chave e obter prova do destino quando integrações externas forem ativadas | Destino comprova deduplicação atômica pela mesma chave | P1 |
| BAK-01 | Execução de backup | Deploy do backup worker foi SUCCESS; isso não prova objeto, checksum, retenção ou execução recorrente | ABERTO | Capturar/realizar uma execução real e verificar artefato, checksum, manifesto e retenção | Artefato real + verificação independente | P1 |
| DR-01 | Restore independente | Branch isolada foi reconciliada até 0031; isso não prova restore do backup criptografado atual | ABERTO | Restaurar backup atual em infraestrutura isolada e medir execução | Restore real com RPO/RTO registrados | P1 |
| ENV-01 | Paridade de ambientes | Evidência histórica mostra development/staging atrás de produção e sem `schema_migrations` canônico | BLOQUEADO | Definir ownership/uso e então migrar ou aposentar de modo não destrutivo | Matriz aprovada + evidência de schema/version | P1 |
| ENV-02 | Contrato de variáveis | Há consumidores conhecidos, mas ainda existem variáveis diretas e históricas sem reconciliação completa | PARCIAL | Classificar cada variável como obrigatória, opcional, legada, documental ou indireta | Contrato completo por ambiente, sem segredos | P1 |
| SEC-01 | Isolamento tenant | AuthZ + membership + contexto transacional + RLS formam defesa em profundidade | FORTE / E3 ESTRUTURAL | Preservar arquitetura e fechar prova comportamental | DB-04 + AUTH-01 comprovados em runtime | P0 |
| SEC-02 | Centralização de configuração | `packages/config` existe, mas ainda há `process.env` direto em API/Auth0/Web/Worker | DÍVIDA TÉCNICA | Centralizar parsing/validação, mantendo exceções de bootstrap explícitas | Leituras de env restritas às fronteiras aprovadas | P2 |
| DB-05 | Tipagem dos repositórios | Outbox/Durable Jobs ainda usam `any` em pool/client/row nos caminhos auditados | DÍVIDA TÉCNICA | Substituir por `Pool`, `PoolClient` e interfaces de row | Typecheck sem `any` nesses caminhos | P2 |
| WEB-01 | Estrutura frontend | `apps/web/src/app/page.tsx` continua monolítico e concentra sessão, health, freight, formulário, erro e estado | DÍVIDA TÉCNICA | Extrair hooks/components/libs sem mudar comportamento primeiro | Mesmo comportamento com unidades testáveis menores | P2 |
| WEB-02 | Modelo de deploy Web/API | Vercel pulou o Web no commit API-only; isso é comportamento esperado de monorepo, não defeito automático | ACEITO / PRECISA DOCUMENTAÇÃO | Formalizar promoção por componente | Manifesto explica SHA efetivo por componente | P1 |
| DOC-01 | Fonte de verdade da auditoria | Existem documentos datados com estados históricos diferentes | PARCIAL | Manter históricos imutáveis e usar este tracker como estado corrente | Todo finding atual aparece aqui; históricos ficam explicitamente datados | P1 |
| DOC-02 | Diagramas | Conjunto versionado de Mermaid criado em `docs/architecture/`: contexto, deployment e domínio; índice e check estrutural entram no CI; CI atual passou no SHA de controle | IMPLEMENTADO NO REPOSITÓRIO / CI COMPROVADO / RUNTIME PENDENTE | Revisar os três diagramas contra runtime efetivo e, se necessário, ampliar para ERD/event-flow | Diagramas coincidem com runtime e relações de banco; CI verde no HEAD auditado | P2 |
| CI-01 | CI do HEAD atual | Run `36081162875` / #1139 no SHA `2eb43e87bb8005cbfb6d65c7808e34dde725cca4` terminou `success`; job `107903222930` passou todos os passos, incluindo architecture, migration, RLS/IAM/worker integration, format, lint, typecheck, test e build | FECHADO / COMPROVADO | Preservar esta evidência e repetir após mudanças funcionais relevantes | Gates configurados passam no SHA auditado | P0 |
| CI-02 | Gates de promoção | Web/API/Worker podem ser promovidos separadamente | ABERTO | Definir gates explícitos por componente e release | Componente desatualizado/falho não é confundido com release completa | P1 |
| SEC-03 | Replay sensível | Replay é mutação de produção que cria durable job e auditoria | PRECISA HARDENING | Permissão dedicada, motivo estruturado, rate/approval quando aplicável e auditoria | Replay controlado + testes negativos + trilha de auditoria | P1 |
| FINAL-01 | DoD final | P0/P1 ainda têm evidência operacional aberta | BLOQUEADO | Fechar P0, depois P1, executar regressão e reconciliar documentação | Gates finais verdes ou aceitos formalmente com evidência | P0 |

## 4. Correções importantes feitas nesta auditoria cruzada

### 4.1 Contrato do worker não está mais “sem fonte de verdade”

A auditoria anterior marcava `WORK-02` como bloqueado porque não havia contrato autoritativo suficiente. A leitura cruzada do HEAD atual encontrou:

`freight.status_changed → outbox_events → durable_jobs → freight-status-changed.handler.ts → audit/telemetry`

Evidências de código:
1. A transição de freight grava `freight.status_changed` no outbox na mesma transação.
2. O worker consome esse evento e cria `durable_jobs` com `idempotencyKey: event.id`.
3. O worker registra handler para `freight.status_changed`.
4. O handler grava conclusão idempotente em `audit_events`.
5. Existe teste do handler e teste de integração do fluxo completo.
6. A documentação operacional também registra esse fluxo.

**Nova classificação:** E2/E3 comprovado por código + CI; **E4 de produção continua aberto** até execução real no ambiente Neon/Railway atual.

### 4.2 O fluxo normal do Durable Job é diferente do replay manual

No fluxo normal, a chave de idempotência é determinística pelo ID do evento de outbox. No endpoint de replay, a chave contém UUID aleatório. Portanto:

- processamento normal: pode deduplicar o mesmo evento;
- replay manual: cada solicitação é uma nova intenção de replay.

Isso não é necessariamente um defeito; é uma decisão semântica que precisa ser explícita e testada.

### 4.3 Há endpoints de diagnóstico que merecem revisão antes do fechamento

O controller de Freight contém endpoints de diagnóstico de contexto, banco, RLS e claims. Eles estão protegidos por `freight:read`, mas alguns retornam dados de contexto operacional e fazem probes de isolamento.

Antes do DoD final, decidir se esses endpoints:
- ficam disponíveis somente para operadores/admin;
- ficam condicionados a feature flag/ambiente não produtivo; ou
- permanecem em produção com contrato explícito e testes de exposição.

### 4.4 CI e runtime devem continuar separados

Há evidência de qualidade/integração em CI para o fluxo do worker, mas isso não substitui:
- migration head do Neon;
- versão efetiva do worker em Railway;
- execução real de um evento em produção;
- prova comportamental de RLS;
- E2E Auth0 real.

## 5. Fatos concretos que não podem ser perdidos

1. **Não tratar diferença de SHA do Web/Worker como defeito por si só.** Vercel/Railway podem pular componentes não afetados. O controle correto é o SHA efetivo por componente.
2. **Não afirmar que Neon está em 0033.** O repositório contém 0033; a evidência live independente disponível continua em 0031.
3. **Não afirmar E2E Auth0 de produção.** Configuração em código/Action é intenção e evidência estrutural, não prova de token real recém-emitido.
4. **Não afirmar backup/DR E4 a partir de deploy SUCCESS ou reconciliação de schema.** É necessário artefato de backup e restore independente.
5. **O contrato `freight.status_changed` agora existe no código e nos testes.** O que falta é prova E4 no runtime produtivo atual.
6. **Não forçar deploy apenas para alinhar SHAs.** Primeiro confirmar se o componente foi realmente afetado.
7. **Não executar sincronização destrutiva de development/staging.** Definir ownership e consumidores antes.
8. **Não apagar documentos históricos.** Eles continuam úteis como trilha temporal; este tracker é o estado corrente.
9. **Não confundir replay manual com idempotência do fluxo normal.** O replay atual gera uma nova chave por solicitação.
10. **Não considerar endpoints de diagnóstico automaticamente seguros só porque possuem `freight:read`.** A superfície de exposição precisa ser decidida e testada.

## 6. Ordem recomendada de execução

### P0 — fechar primeiro

1. Confirmar CI real do HEAD atual e registrar run/job.
2. Confirmar head de migração Neon e checksums de 0032/0033.
3. Executar prova comportamental de RLS com o papel de runtime real.
4. Executar E2E Auth0: token real → Web → API → DB tenant-scoped.
5. Criar manifesto de release com SHA efetivo de Web/API/Worker e migration head.

### P1 — executar depois

6. Criar permissão dedicada de replay.
7. Definir semântica de replay e adicionar testes dedicados.
8. Revisar e restringir endpoints de diagnóstico.
9. Provar runtime do worker e executar evento real `freight.status_changed`.
10. Provar backup real.
11. Fazer restore independente do backup criptografado atual.
12. Resolver governança de development/staging.
13. Executar matriz de rotas protegidas.
14. Reconciliar documentação operacional.

### P2 — após fechamento operacional

15. Centralizar configuração de ambiente.
16. Remover `any` dos repositórios auditados.
17. Refatorar `page.tsx` sem alterar comportamento.
18. Revisar os diagramas Mermaid versionados contra runtime efetivo e relações de banco; adicionar ERD/event-flow somente se a reconciliação da auditoria demonstrar necessidade.

## 7. Novos achados da auditoria estrutural

- **DOC-03 — Drift documental concreto:** docs/PROJECT-DOCUMENTATION.md e docs/architecture/FOUNDATION.md ainda descrevem packages/contracts, mas esse diretório não existe no repositório atual e não há pacote @tms/contracts. A documentação corrente também afirma 31 migrações como estado atual, enquanto o repositório contém 0032–0035, incluindo observabilidade/audit context, durable-job idempotency, replay permission e diagnostics permission. docs/INTEGRATIONS-OPERATIONS.md ainda descreve Railway como destino pretendido do API, enquanto a infraestrutura observada mantém tms-core-api em Vercel. **Estado: DRIFT DOCUMENTAL / P1.**
- **CONFIG-01 — Boundary de configuração incompleta:** packages/config implementa loadConfig, mas a busca estrutural não encontrou consumidores runtime; API, Web, Worker, observability e migration script continuam lendo process.env diretamente. Isso reforça SEC-02: o pacote de configuração hoje funciona mais como biblioteca isolada/testada do que como fonte efetiva de configuração do runtime. **Estado: DÍVIDA TÉCNICA / P2.**
- **BUILD-01 — Toolchain/runtime duplicado e parcialmente divergente:** o repositório fixa Node 24.20.0, CI usa Node 24 e o Dockerfile raiz usado pelo Railway usa Node 24.20.0; porém existe um apps/worker/Dockerfile paralelo com Node 22. O serviço Railway observado usa o Dockerfile raiz, portanto o arquivo Node 22 é uma fonte potencial de drift e deve ser classificado/limpo posteriormente. Além disso, vercel.json/apps/api/vercel.json usam --no-frozen-lockfile, reduzindo a reprodutibilidade do deploy frente ao lockfile versionado. **Estado: PRECISA REVISÃO / P1-P2.**
- **PKG-01 — Chave JSON duplicada:** package.json contém architecture:check duas vezes. O JSON é aceito pelo parser com prevalência da última chave, mas a duplicidade é uma inconsistência de manutenção e pode mascarar alterações futuras. **Estado: DÍVIDA TÉCNICA / P2.**
- **CI-03 — Proteção/promotion gates ainda não auditáveis pelo conector atual:** a leitura do endpoint de branch protection/rulesets de main retornou 403 para a integração disponível. Portanto não há, nesta etapa, prova independente das regras de proteção/required checks da branch. Isso permanece como lacuna de auditoria, não como afirmação de que a branch está desprotegida. **Estado: ABERTO / P1.**

## 8. Novos achados da auditoria de testes

- **API-07 — Cobertura direta da camada HTTP/aplicação:** a inspeção atual não encontrou arquivos de teste dedicados para freight.service, operations.service, compliance.service, finance.service ou controllers de negócio. Existem testes de guards, middleware, health, CORS e integrações do banco/worker, mas a camada de serviço/controller de negócio fica principalmente coberta de forma indireta. **Estado: LACUNA DE COBERTURA / P1.**
- **WEB-03 — Cobertura de rotas/componentes Web:** não foram encontrados testes dedicados para as rotas proxy TMS, runtime-context, auth-runtime, freight/status ou para page.tsx. O teste existente identificado cobre utilitário de API. **Estado: LACUNA DE COBERTURA / P1-P2.**
- **TEST-01 — CI atual não deve ser interpretado como cobertura percentual:** o pipeline comprova execução e sucesso da suíte configurada, mas o repositório não apresenta gate de cobertura nem limiar mínimo de cobertura no CI. Isso não prova baixa cobertura, apenas ausência de um controle quantitativo. **Estado: CONTROLE AUSENTE / P2.**

## 9. Novos achados desta atualização do tracker

- **AUDIT-01 — Estado do tracker reconciliado:** esta atualização restaura o conteúdo canônico do tracker e mantém separados o HEAD funcional auditado e o HEAD de controle/documentação. **Estado: ATUALIZAÇÃO EXECUTADA.**
- **AUDIT-02 — Auditoria continua antes de qualquer hardening/refactor:** nenhum finding P0/P1 foi marcado como encerrado por inferência. As correções estruturais permanecem condicionadas à conclusão da auditoria e à obtenção das evidências definidas. **Estado: REGRA ATIVA.**
- **AUDIT-03 — Próximo eixo de auditoria:** completar a leitura de worker, Web, CI/CD, infraestrutura, dependências entre packages, acesso SQL direto e cobertura de RLS/migrações antes de iniciar correções. **Estado: ABERTO / PRÓXIMA ETAPA.**

## 10. Definition of Done

Um item só pode virar **FECHADO/COMPROVADO** quando a evidência de encerramento definida na tabela existir.

Código-fonte, deploy SUCCESS, documentação ou teste isolado não bastam para uma afirmação operacional E3/E4.

**Estado geral atual:** P0/P1 ainda possuem evidência de runtime aberta. O DoD final **não foi atingido**.

## 11. Histórico de atualizações do tracker

- 2026-09-24: tracker criado como lista canônica de execução.
- 2026-09-24: master controller passou a apontar para este tracker como ledger corrente.
- 2026-09-24: auditoria cruzada atualizada para português.
- 2026-09-24: `WORK-02` corrigido de “contrato ausente” para “E2/E3 comprovado, E4 aberto”, após confirmação do fluxo e testes do worker.
- 2026-09-24: adicionados `API-06` e `SEC-03` para revisão da superfície de diagnóstico e endurecimento do replay.
- 2026-09-24: adicionados diagramas Mermaid versionados de contexto, deployment e domínio; índice e `architecture:check` passaram a fazer parte do CI. DOC-02 permanece pendente de validação contra runtime efetivo.
- 2026-09-24: CI run `36074378568` / job `107882428713` comprovou no HEAD de controle `9c0d786...` architecture check, migration, RLS/IAM/worker integration, format, lint, typecheck, test e build.
- 2026-09-24: auditoria estrutural encontrou drift documental entre 31 e 33 migrações, referência a packages/contracts inexistente e descrição de Railway como destino do API apesar do API atual observado em Vercel.
- 2026-09-24: auditoria de toolchain encontrou Dockerfile secundário do worker em Node 22 enquanto o runtime efetivo usa o Dockerfile raiz em Node 24; Vercel mantém --no-frozen-lockfile no install.
- 2026-09-24: auditoria de governança registrou lacuna de prova sobre branch protection/rulesets porque o endpoint disponível retornou 403.
- 2026-09-24: auditoria de testes não encontrou testes dedicados para serviços/controllers de negócio da API nem para as rotas proxy/componentes principais do Web; CI comprova execução da suíte existente, mas não possui gate quantitativo de cobertura.
- 2026-09-24: tracker atualizado novamente para manter a distinção entre HEAD funcional, HEAD de controle/documentação e evidência operacional ainda pendente; auditoria permanece em fase de cobertura estrutural, sem fechamento de P0/P1 por inferência.
- 2026-09-24: auditoria de SQL/RLS confirmou RLS/FORCE RLS nas tabelas tenant-scoped encontradas e acesso direto ao banco concentrado em database/worker; também identificou lacuna no baseline validator: colunas 0032/0033 e invariantes 0030/0031 ainda não são verificadas antes do registro canônico.

## 12. Continuação da auditoria — workspace e dependências

- **PKG-02 — Dependência de workspace não declarada no pacote:** `packages/freight/package.json` não declara dependências, embora o pacote seja consumido por `apps/api` e o código de domínio de freight seja importado em runtime. Nesta etapa não foi encontrado import interno do próprio pacote que prove uma dependência ausente; portanto o achado é de **revisão de contrato de package**, não de falha confirmada. **Estado: ABERTO / P2.**
- **PKG-03 — Package `@tms/audit` sem consumidor runtime identificado:** o package existe e depende de `@tms/tenancy`, porém a busca de imports runtime não encontrou `from "@tms/audit"` no repositório. O worker grava auditoria por meio de `@tms/database`. **Estado: CANDIDATO A ORFÃO / P2.**
- **PKG-04 — `@tms/config` continua sem consumidor runtime:** além do achado CONFIG-01, o próprio `package.json` não declara dependências de runtime; a evidência atual reforça que é uma biblioteca de configuração isolada, não a fronteira efetiva de configuração dos apps. **Estado: DÍVIDA TÉCNICA / P2.**
- **PKG-05 — Grafo de dependências observado sem ciclo evidente no nível de manifestos:** `@tms/api` depende de auth/database/freight/matching/observability/security; `@tms/auth` depende de tenancy/security; `@tms/security` depende de tenancy; `@tms/matching` depende de freight; `@tms/worker` depende de database/observability. A partir desses manifests não aparece ciclo direto. **Estado: ESTRUTURALMENTE CONSISTENTE / REVISÃO DE IMPORTS AINDA ABERTA.**
- **PKG-06 — Turbo inclui variáveis sensíveis no ambiente de build:** `turbo.json` declara `AUTH0_SECRET` e `AUTH0_CLIENT_SECRET` entre as variáveis do task `build`. Isso não prova vazamento, mas aumenta a superfície de propagação/cache do ambiente de build e precisa ser reconciliado com a necessidade real dessas variáveis durante compilação. **Estado: PRECISA REVISÃO DE SEGURANÇA / P1.**
- **PKG-07 — Lockfile e manifests precisam de reconciliação contínua:** `pnpm-lock.yaml` referencia os packages workspace, enquanto Vercel usa instalação sem `--frozen-lockfile`. O controle de dependências no CI é mais rígido que no deploy. **Estado: REFORÇA BUILD-01 / P1.**

## 13. Próxima etapa da auditoria

A auditoria segue sem correções de código. O próximo bloco deve cobrir: imports efetivos dos packages, acesso SQL direto fora de `packages/database`, todas as policies/RLS das migrações 0001–0033, worker completo (leases, retries, shutdown e erro), Web completo (Auth0, proxy e tenant), workflows de CI/CD e contratos de deploy Vercel/Railway. Somente depois de fechar esse inventário será iniciada a fase de evidências/correções/refatoração.

## 14. Continuação — worker, Web e fronteira de autenticação

- **WORK-05 — Durable Jobs não são processados por padrão:** `apps/worker/src/main.ts` sempre enfileira `freight.status_changed` em `durable_jobs`, mas o processamento desse store só ocorre quando `DURABLE_JOBS_ENABLED=true`. O default é `false`. Portanto, uma instalação válida com tenants configurados pode produzir durable jobs pendentes indefinidamente se a variável não estiver explicitamente habilitada. **Estado: RISCO OPERACIONAL / P1.** Evidência de encerramento: runtime do worker confirma a variável e há métrica/alerta para backlog quando o produtor está ativo e o consumidor desabilitado.
- **WORK-06 — Lease/heartbeat possui boa defesa estrutural:** Outbox renova leases enquanto processa e Durable Jobs renova lease durante o handler; há testes dedicados para esses caminhos. O risco residual é operacional: ausência de métrica/alerta explícito para perda de lease, backlog ou jobs em estado running. **Estado: PARCIAL / P1.**
- **WORK-07 — Falha de acknowledgement do outbox pode causar repetição:** se o handler conclui o efeito mas `markPublished` falha, o evento permanece para replay após expiração do lease. O próprio código documenta que handlers devem ser idempotentes usando `event.id`. **Estado: COMPORTAMENTO DELIBERADO / P1 para prova de idempotência.** Evidência necessária: cada handler com side effect comprova idempotência ou efeito externo com chave idempotente.
- **WEB-04 — Proxy Web preserva autenticação no backend:** as rotas TMS usam `auth0.createFetcher(...).fetchWithAuth()`, enquanto `proxy.ts` aplica o middleware Auth0 a todas as rotas não-estáticas. Isso fornece uma barreira de sessão no Web e propagação de access token para a API. **Estado: ESTRUTURALMENTE COMPROVADO / E2-E3.** E2E real ainda depende de AUTH-01.
- **WEB-05 — Query string não é propagada pelo proxy de freight:** `GET /api/tms/freights` chama sempre `/freights` sem copiar search params da Request. Caso a API suporte paginação/filtros/ordenação, essa fronteira os descarta silenciosamente. **Estado: CONTRATO INCOMPLETO / P1-P2.** Evidência necessária: contrato da rota documentado e teste de query forwarding ou confirmação de que a API não possui parâmetros.
- **WEB-06 — Rotas de diagnóstico também têm proxy autenticado, mas continuam dependentes da autorização da API:** `auth-runtime` e `runtime-context` obtêm token via Auth0 e chamam endpoints diagnósticos. A proteção final continua sendo o PermissionGuard da API. **Estado: PARCIAL / P1.** Reconciliar com API-06.
- **WEB-07 — Tratamento de erro do proxy pode devolver detalhes do SDK:** algumas rotas retornam `detail: error.message` ao cliente quando a autenticação falha. Isso pode expor informação de implementação/infraestrutura desnecessária. **Estado: HARDENING / P2.** Evidência necessária: mensagens externas padronizadas sem detalhes internos, preservando logs correlacionáveis no servidor.
- **WEB-08 — `page.tsx` permanece concentrado, mas não acessa API de negócio diretamente sem autenticação:** chamadas de freight passam pelos Route Handlers do Next e pelo `createFetcher`. A principal dívida do frontend continua sendo separação de responsabilidades e cobertura, não bypass de autenticação observado. **Estado: DÍVIDA TÉCNICA / P2.**
- **API-08 — Bootstrap HTTP valida entrada globalmente:** `ValidationPipe` usa `whitelist: true`, `forbidNonWhitelisted: true` e `transform: true`; há filtro global de exceções e CORS com allowlist. **Estado: ESTRUTURALMENTE COMPROVADO.** Ainda falta matriz de smoke/E2E para provar comportamento em produção.
- **SEC-04 — Configuração Auth0 usa non-null assertions:** `apps/web/src/lib/auth0.ts` usa `process.env.AUTH0_*!` sem validação explícita de startup. Falta de secret pode gerar falha tardia e pouco diagnóstica. **Estado: DÍVIDA DE ROBUSTEZ / P2.**

## 15. Novos achados — banco e contratos de package

- **DB-06 — Validação de baseline não cobre integralmente o schema 0033:** `packages/database/scripts/migrate.ts` declara `durable_jobs` sem a coluna `idempotency_key` adicionada em 0033 e `audit_events` sem as colunas adicionadas em 0032 (`correlation_id`, `actor_subject`, `ip_address`, `user_agent`, `outcome`). A rotina também não valida explicitamente as constraints compostas introduzidas em 0030/0031. Portanto, quando `TMS_ALLOW_EXISTING_SCHEMA_BASELINE=true`, a validação existente pode aceitar um schema compatível sem provar integralmente o contrato das migrações finais antes de registrar todos os checksums. **Estado: LACUNA DE CONTROLE / P1.** Evidência necessária: baseline validator deve verificar colunas/constraints críticas de 0030–0033 antes de registrar a baseline.
- **PKG-08 — Código IAM potencialmente órfão:** `packages/database/src/iam.ts` exporta `findTenantMembership`, mas a busca de referências no repositório encontrou somente a própria definição. O runtime atual usa o resolver SQL `check_tenant_membership` e `verifyTenantMembership`. **Estado: CANDIDATO A ORFÃO / P2.**

## 15. Estado após esta etapa

A auditoria estrutural avançou por workspace, worker, Web, proxy de autenticação, CI, acesso SQL e matriz inicial de RLS/migrações. Foi identificado também que o validador de baseline não cobre integralmente o contrato introduzido em 0030–0033. O inventário funcional ainda não está completo: falta terminar a revisão integral dos repositories, módulos da API e workflows de deploy. **Nenhum P0/P1 foi encerrado por inferência e nenhuma correção funcional foi iniciada.**

## 16. Continuação — repositories e invariantes de domínio

- **REPO-01 — Fronteira transacional tenant-scoped consistente:** os repositories principais de Freight, Assignment, Operations, Compliance, Trip e Trip Execution usam `withTransaction(... tenantId ...)`, que inicia transação e define `app.tenant_id` localmente. As queries também repetem `tenant_id = $1`, fornecendo defesa em profundidade. **Estado: ESTRUTURALMENTE COMPROVADO / E2-E3.** Ainda falta prova runtime de produção, coberta por DB-04/SEC-01.
- **REPO-02 — Transições de Freight/Trip possuem atomicidade com auditoria/outbox:** alterações críticas são feitas dentro da mesma transação que os efeitos derivados e, no fluxo de status de freight, o audit e o `freight.status_changed` são gravados atomicamente. Trip também atualiza freight/assignment e auditoria no mesmo contexto. **Estado: ESTRUTURALMENTE FORTE / E2-E3.** A matriz de testes negativos e a prova E4 permanecem abertas.
- **REPO-03 — Compliance/GR têm máquina de estados explícita:** `ComplianceRepository` e `GR` restringem transições e usam lock pessimista antes da mutação; há testes de integração para isolamento e invariantes. **Estado: COMPROVADO NO CÓDIGO/TESTES / E4 ABERTO.** A semântica de seleção do último check/GR para release continua merecendo teste específico por assignment quando existirem checks globais e específicos simultaneamente.
- **REPO-04 — Financeiro possui auditoria transacional:** `FinanceRepository.create()` e `settle()` agora exigem `AuditInput` e chamam `appendAuditEvent` na mesma transação da mutação. **Estado: CORRIGIDO ESTRUTURALMENTE / E4 E TESTE DE REGRESSÃO PENDENTES.** A evidência atual confirma a implementação e a propagação de `actorUserId`, `requestId` e metadados pelo `FinanceService`; permanece necessário confirmar a suíte no CI e o rollback conjunto quando a gravação de auditoria falhar.
- **REPO-05 — Validação de relações cross-entity é consistente, mas depende de FK + código:** Finance, Compliance, Assignment e Trip validam tenant e pertencimento dos relacionamentos antes de mutar. As migrações também possuem FKs compostas em pontos críticos. **Estado: ESTRUTURALMENTE COMPROVADO / E2-E3.** A reconciliação integral de todas as constraints 0001–0033 continua pendente.
- **REPO-06 — Repositórios de Outbox/Durable Jobs mantêm lease/idempotência, mas tipagem continua fraca:** os caminhos auditados usam `withTenantContext`, `FOR UPDATE SKIP LOCKED`, lease token e chave de idempotência; porém `Pool/client/row` ainda usam `any`. **Estado: FUNCIONALMENTE FORTE / DÍVIDA P2**, já registrada em DB-05.
- **REPO-07 — SQL direto fora de `packages/database` é limitado e identificável:** a busca por `client.query(` encontrou caminhos adicionais no worker (stores/contexto), migration script, diagnóstico de RLS e replay do Freight. Não foi encontrado acesso SQL arbitrário espalhado pelos controllers/services de negócio além dos pontos já conhecidos. **Estado: INVENTÁRIO PARCIALMENTE CONCLUÍDO / P1 para fechar.** Próximo passo é revisar cada acesso fora de `packages/database` e classificar se é fronteira legítima de infraestrutura, teste ou regra de negócio que deveria ser centralizada.
- **REPO-08 — Replay cria job e auditoria na mesma transação:** o endpoint de replay lê e valida o evento, insere durable job e registra `durable_job.replay_requested` dentro de `withTenantContext`. **Estado: ESTRUTURALMENTE COMPROVADO.** Permissão dedicada e semântica de repetição continuam abertas em API-02/API-03/API-04.

## 17. Estado após auditoria dos repositories

A camada de persistência principal foi percorrida: transações tenant-scoped, Freight/Assignment, Operations, Compliance/GR, Finance, Trip/Trip Execution, Audit, Outbox e Durable Jobs. O achado funcional novo mais relevante é a ausência de auditoria explícita nas mutações financeiras; os demais fluxos críticos mostram atomicidade e validações de relacionamento consistentes no código. A auditoria ainda não entra em correções: permanecem abertos o inventário integral de SQL fora da camada de database, todos os controllers/services da API, workflows CI/CD e infraestrutura/deploy.

**Regra preservada:** nenhum P0/P1 foi encerrado por inferência e nenhuma correção/refatoração funcional foi iniciada.

## 18. Continuação — API, autorização e contratos HTTP

- **API-09 — Cobertura estrutural de autorização:** os cinco módulos de negócio auditados (Freight, Operations/Trip, Trip Execution, Compliance e Finance) aplicam AuthGuard + PermissionGuard no controller e cada endpoint possui @RequirePermission. **Estado: E2-E3 COMPROVADO.** Permanece necessária a matriz negativa em runtime (sem token, tenant divergente, membership inativa, permissão ausente).
- **API-10 — TenantGuard é código órfão na superfície HTTP:** o guard valida x-tenant-id contra o contexto autenticado, mas os controllers auditados não o utilizam; a mesma proteção já está implementada no AuthGuard. **Estado: CANDIDATO A ORFÃO / P2.** Não será removido durante a auditoria.
- **API-11 — Diagnósticos de runtime expostos dentro da superfície autenticada:** runtime-context, runtime-db-context, runtime-rls-isolation e runtime-auth-claims estão sob freight:read. Eles retornam tenant/user/roles/permissões e detalhes de banco/OIDC, e um deles executa uma sonda RLS contra um tenant sintético. **Estado: CONTROLE DE EXPOSIÇÃO / P1.** A decisão deve ser separar esses endpoints da permissão funcional de leitura de freight, restringi-los a operação/admin e definir se devem existir em produção.
- **API-12 — Replay continua com privilégio amplo:** POST /freights/:id/status-events/:eventId/replay usa freight:update, embora seja uma ação operacional distinta. **Estado: P1**, já coberto por API-02/SEC-03; auditoria confirma que a implementação não criou uma permissão dedicada.
- **API-13 — Contrato de listagem de Freight não suporta query string no controller:** GET /freights recebe somente RequestContext e ignora parâmetros HTTP. **Estado: P1/P2 conforme contrato pretendido.** Se paginação, filtros ou ordenação fizerem parte do contrato, há perda silenciosa de parâmetros; se não fizerem, deve existir evidência/documentação explícita dessa decisão.
- **API-14 — DTOs e validação de entrada estão amplamente presentes:** os módulos auditados usam class-validator, UUIDs para identificadores e enums/allowlists para estados e tipos; o bootstrap global usa whitelist + forbidNonWhitelisted. **Estado: E2-E3 COMPROVADO.** Ainda falta testar limites/erros por endpoint em E4 e verificar consistência dos DTOs de query (freightId em Finance é DTO validado; freightId em Compliance é string cru no controller).
- **API-15 — Mapeamento de erros de domínio para HTTP é explícito, mas heterogêneo:** Operations/Compliance/Freight traduzem erros conhecidos para 404/409/400; Finance/Trip Execution deixam mais da semântica para o filtro global. **Estado: P2 de consistência de contrato**, sem evidência atual de vazamento de stack trace.
- **API-16 — Acesso SQL direto na API está concentrado em diagnósticos e replay:** fora dos repositories, os pontos encontrados são runtime-db-context, runtime-rls-isolation e o replay do evento. **Estado: E2-E3 INVENTARIADO.** Esses acessos são infraestrutura/diagnóstico ou operação controlada; não foi encontrado SQL arbitrário nos serviços de negócio durante esta etapa.

## 19. Estado após auditoria da API

A superfície HTTP dos módulos de negócio foi percorrida em controllers, services e DTOs. O modelo de autorização está estruturalmente consistente; os principais riscos restantes são exposição dos endpoints diagnósticos, privilégio de replay, contrato de listagem e consistência de erros/DTOs. A auditoria continua sem alterações funcionais.

**Regra preservada:** nenhuma correção/refatoração foi iniciada; P0/P1 permanecem abertos até evidência e validação completa.


## 20. Continuação — worker, processamento assíncrono e idempotência

- **WORK-08 — Pipeline Outbox → Durable Jobs mantém deduplicação determinística no fluxo normal:** o worker usa `event.id` como `idempotencyKey` ao criar o durable job de `freight.status_changed`. Se o acknowledgement do outbox falhar depois do enqueue, uma nova tentativa pode reencontrar o mesmo evento, mas a chave determinística impede a criação de um segundo durable job lógico. **Estado: ESTRUTURALMENTE FORTE / E2-E3.** E4 ainda depende de execução real no ambiente de produção.
- **WORK-09 — Todos os side effects atualmente identificados possuem mecanismo de repetição, mas um deles depende do contrato do destino externo:** `freight-status-changed.handler` verifica `event_id` antes de registrar auditoria; `WebhookPublisher` envia `idempotency-key` determinística e assina o payload com HMAC. Porém a atomicidade da deduplicação no receptor do webhook não está sob controle do TMS. **Estado: PARCIAL / P1.** Evidência de encerramento: contrato do destino externo comprova que a mesma chave é tratada atomicamente/idempotentemente.
- **WORK-10 — Retry/lease/fencing possuem cobertura de testes relevante:** Durable Jobs usa `FOR UPDATE SKIP LOCKED`, lease token, heartbeat, backoff exponencial, limite de tentativas e fencing no complete/fail; Outbox usa lease token, heartbeat, retry e fencing no publish/fail. Há testes unitários e integração PostgreSQL para concorrência e ownership de lease. **Estado: E2-E3 COMPROVADO.** Falta apenas prova E4 e observabilidade operacional de backlog/lease loss.
- **WORK-11 — Falha de acknowledgement é tratada como at-least-once, não como exactly-once:** depois que o handler conclui, `markPublished`/finalização pode falhar e o evento/job pode ser processado novamente após expiração do lease. O código deliberadamente preserva essa possibilidade e exige idempotência no side effect. **Estado: COMPORTAMENTO DELIBERADO / P1.** Não deve ser “corrigido” antes de definir o contrato de entrega.
- **WORK-12 — Shutdown é ordenado para impedir novo ciclo antes de fechar o pool:** SIGINT/SIGTERM interrompem o timer, aguardam `activeRun` e somente então executam `pool.end()`; existe teste estrutural desse ordering. **Estado: E2-E3 COMPROVADO.** Ainda não há teste runtime de sinal/terminação contra um job longo real.
- **WORK-13 — Configuração do worker é validada parcialmente e possui default operacional importante:** UUIDs de tenants e inteiros positivos são validados; URLs de webhook e timeout são validados pelo publisher. Entretanto `DURABLE_JOBS_ENABLED` usa comparação booleana simples e default `false`, enquanto o produtor de durable jobs continua ativo. Isso mantém o risco já registrado em WORK-05. **Estado: RISCO OPERACIONAL / P1.**
- **WORK-14 — Não existe readiness/health endpoint ou sinal equivalente no processo do worker:** o processo registra `service.started`, verifica papel de banco e tenants, e pode entrar em estado idle; porém não foi encontrado mecanismo externo que diferencie processo vivo, DB saudável, configuração válida, worker ativo, backlog ou último ciclo bem-sucedido. **Estado: LACUNA OPERACIONAL / P1.** Evidência de encerramento: readiness/telemetria observável com estados healthy, idle e unhealthy e métricas/alertas para backlog, lease loss e failure rate.
- **WORK-15 — Produção continua sem prova de processamento efetivo:** evidência histórica mostra o worker iniciando e ficando idle com `configuredTenants=0`, `durableJobsEnabled=false` e nenhum webhook configurado. O código atual continua compatível com esse modo. **Estado: E4 ABERTO / P1.** Não inventar tenant IDs nem forçar deploy; primeiro reconciliar lifecycle dos tenants e configuração aprovada.
- **WORK-16 — Webhook security boundary está estruturalmente forte:** somente HTTPS é aceito, redirects são proibidos, timeout usa AbortController, HMAC-SHA256 é obrigatório quando endpoints existem e segredos/URLs não são registrados no log. **Estado: E2-E3 COMPROVADO.** Falta prova operacional do receptor e rotação/ownership do segredo.
- **WORK-17 — Build/runtime do worker possui divergência de Dockerfile potencial:** `apps/worker/Dockerfile` usa Node 22, enquanto o Dockerfile raiz efetivamente observado para Railway usa Node 24. O serviço atual não prova uso do Dockerfile secundário. **Estado: DRIFT POTENCIAL / P1-P2.** Classificar explicitamente o Dockerfile secundário antes da fase de limpeza; não remover durante a auditoria.

## 21. Estado após auditoria do worker

O processamento assíncrono foi percorrido em entrypoint, configuração, Outbox, Durable Jobs, stores PostgreSQL, leases, retries, heartbeat, fencing, shutdown, handlers, webhook publisher e testes unitários/integrados. O desenho atual é **at-least-once com idempotência por contrato**, não exactly-once. Os mecanismos de lease, concorrência e retry estão estruturalmente bem cobertos, mas permanecem abertos a prova E4, readiness/telemetria operacional, ativação explícita de Durable Jobs e prova de idempotência no receptor externo.

**Regra preservada:** nenhuma correção/refatoração foi iniciada. A auditoria continua avançando para o próximo eixo; P0/P1 permanecem abertos até evidência concreta.

## 22. Continuação — Web completo e CI/CD versionado

- **WEB-09 — Superfície de proxy Web atualmente inventariada:** o middleware src/proxy.ts aplica Auth0 a todas as rotas não-estáticas; as Route Handlers TMS usam auth0.createFetcher(...).fetchWithAuth(...). Foram identificadas as superfícies freights, freights/:id/status, auth-runtime e runtime-context. **Estado: E2-E3 ESTRUTURALMENTE COMPROVADO.** A prova E4 continua dependente de AUTH-01 e do deployment efetivo do Web.
- **WEB-10 — Proxy de Freight não propaga query string:** GET /api/tms/freights encaminha para /freights sem copiar request.nextUrl.search. O backend também não recebe parâmetros no controller atual. **Estado: CONTRATO A RECONCILIAR / P1-P2.** Não corrigir antes de fechar o contrato funcional de listagem.
- **WEB-11 — Erros de autenticação expõem error.message em algumas Route Handlers:** freights, runtime-context e freights/:id/status retornam detail derivado da exceção do SDK. **Estado: HARDENING / P2.** Definir mensagem externa estável e manter detalhes somente em logs correlacionáveis.
- **WEB-12 — Configuração Auth0 no Web continua sem validação explícita de startup:** AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET e AUTH0_SECRET são consumidos com non-null assertions. NEXT_PUBLIC_API_BASE_URL possui validação local nas rotas/client helper. **Estado: P2.** O risco é diagnóstico tardio, não bypass de autenticação.
- **WEB-13 — O contrato de deploy do Web não está duplicado em apps/web/vercel.json:** o arquivo não existe no HEAD atual; há vercel.json na raiz com pnpm install --no-frozen-lockfile. Portanto, o comportamento de instalação do Web depende da configuração raiz/Vercel observada, e não de um contrato local ao app. **Estado: BUILD-01 / P1.** Reconciliar root directory, install/build commands e lockfile policy na fase de infraestrutura.
- **CI-04 — CI principal é determinístico na instalação, mas não é gate de promoção por si só:** .github/workflows/ci.yml roda em push/PR para main, usa Node 24.20.0 e pnpm install --frozen-lockfile, cria PostgreSQL 17 efêmero e executa architecture check, migrations, role/RLS/IAM/worker integration, format, lint, typecheck, test e build. **Estado: E2-E3 COMPROVADO.** Ainda falta evidência do run no HEAD funcional corrente e regra de promoção/branch protection independente.
- **CI-05 — Workflow de migration de produção usa baseline permissivo permanente:** .github/workflows/database-migrate.yml define TMS_ALLOW_EXISTING_SCHEMA_BASELINE=true em toda execução de produção; o workflow não contém uma etapa explícita de verificação do head/checksum antes de aplicar. **Estado: REFORÇA DB-02/DB-06 / P1.** Não alterar durante a auditoria.
- **CI-06 — Workflow non-prod também força baseline permissivo:** database-migrate-nonprod.yml recebe development ou staging manualmente e define o mesmo flag. **Estado: REFORÇA ENV-01/DB-02 / P1.** O desenho atual não prova que os ambientes possuam o schema canônico nem que o baseline seja restrito a bootstrap.
- **CI-07 — Não foi encontrado workflow versionado de deploy de Vercel/Railway no diretório .github/workflows:** o repositório contém CI e workflows de migration, mas não um pipeline GitHub explícito de promoção de Web/API/Worker. **Estado: CONTRATO DE DEPLOY ABERTO / P1.** Isso não significa que Vercel/Railway não façam deploy por integração externa; significa somente que a promoção não está versionada nesses workflows.
- **BUILD-02 — Lockfile policy divergente entre CI e Vercel:** CI e Docker usam --frozen-lockfile, enquanto o vercel.json raiz define pnpm install --no-frozen-lockfile. **Estado: DRIFT DE BUILD / P1.** Reconciliar depois da auditoria para evitar resolução diferente entre CI e produção.
- **BUILD-03 — Node 22 permanece em Dockerfile secundário do Worker:** o Dockerfile raiz usa Node 24.20.0 e é o caminho observado no Railway; apps/worker/Dockerfile usa Node 22. **Estado: DRIFT POTENCIAL / P1-P2.** Classificação mantida; nenhuma remoção durante auditoria.

## 23. Estado após Web e CI/CD

A superfície Web foi percorrida em middleware Auth0, Route Handlers, cliente de API e contrato de ambiente; a fronteira autenticada está estruturalmente consistente, mas query forwarding, exposição de mensagens de erro e validação explícita de configuração permanecem abertos. O conjunto de workflows versionados também foi percorrido: CI é determinístico e abrangente em qualidade/integração, enquanto os workflows de migration mantêm baseline permissivo e não existe pipeline GitHub versionado de promoção de aplicações.

**Regra preservada:** nenhum P0/P1 foi encerrado por inferência e nenhuma correção/refatoração funcional foi iniciada. O próximo bloco deve auditar os contratos efetivos de Vercel/Railway, root directories, build/install commands, watch paths, variáveis por ambiente, deployments/skips e infraestrutura restante; depois disso, fechar o inventário de auditoria antes de iniciar evidências/correções.

## 24. Continuação — contrato efetivo Vercel/Railway e deploy observado

- **DEPLOY-01 — Vercel está conectado diretamente ao GitHub/main e recebeu o commit do tracker:** após o commit 41b9463, os projetos tms-core-api e tms-web criaram deployments de produção para exatamente esse SHA. Isso demonstra promoção automática por integração Vercel→GitHub, fora de .github/workflows. **Estado: E2-E3 COMPROVADO.** O pipeline de promoção, portanto, existe externamente ao GitHub Actions e precisa ser tratado como parte do contrato operacional.
- **DEPLOY-02 — Web efetivamente construiu no SHA do tracker e publicou com sucesso:** deployment dpl_834aWqoicxSQfwcHozfvUepcH1zG, production, READY, SHA 41b9463. O build executou Next.js 16.3.3, Turbo e as Route Handlers TMS, incluindo Proxy/Auth0. **Estado: BUILD E2-E3 COMPROVADO.** Isso não substitui E2E autenticado.
- **DEPLOY-03 — API recebeu deployment de produção do mesmo SHA, mas a coleta observada permaneceu em QUEUED:** deployment dpl_2YEncddnyd4WQGRw4m4Pgj5s9W4L, production, SHA 41b9463; os logs mostram Vercel iniciando o build e usando install command cd ../.. && pnpm install --no-frozen-lockfile. **Estado: BUILD EM ANDAMENTO/ABERTO NA OBSERVAÇÃO.** Não classificar como falha sem estado final.
- **DEPLOY-04 — Root Directory efetivo do API é inferível pelos logs, mas ainda não há leitura de configuração nativa:** o comando cd ../.. durante a instalação indica execução a partir de subdiretório do monorepo, compatível com rootDirectory do app. **Estado: EVIDÊNCIA INDIRETA.** Falta evidência direta do setting para fechar o contrato de build.
- **DEPLOY-05 — Vercel confirma Node 24.x no projeto API e Web:** get_project reporta nodeVersion 24.x para tms-core-api e tms-web. O build Web, contudo, registrou Node 24.21.0 enquanto package.json fixa 24.20.0, gerando warning de engine. **Estado: DRIFT DE PATCH / P1-P2.** CI/Docker fixam 24.20.0; Vercel usa 24.x com patch superior.
- **DEPLOY-06 — Vercel realmente usa --no-frozen-lockfile:** o build Web registrou literalmente pnpm install --no-frozen-lockfile; o build API iniciou com cd ../.. && pnpm install --no-frozen-lockfile. **Estado: COMPROVADO / REFORÇA BUILD-02.**
- **DEPLOY-07 — Railway disponível nesta conexão expõe somente o projeto tms-backup:** a listagem atual de projetos/workspaces retorna um único projeto, tms-backup, sem tms-worker. Portanto não é possível renovar a evidência do serviço worker por esta conexão atual. **Estado: EVIDÊNCIA DE ACESSO LIMITADO.** Não inferir que tms-worker deixou de existir; manter as evidências históricas já registradas e marcar nova leitura como indisponível.
- **DEPLOY-08 — Não há workflow GitHub de deploy, mas há integração Vercel externa:** o achado CI-07 deve ser interpretado como ausência de pipeline versionado de promoção no GitHub, não como ausência de automação de deploy. **Estado: CONTRATO DE PROMOÇÃO PARCIALMENTE RECONCILIADO.**
- **DEPLOY-09 — Commits somente de auditoria também acionam promoção Vercel:** o próprio update do tracker gerou deployments de produção em API/Web. **Estado: CONTROLE OPERACIONAL IMPORTANTE / P1.** O processo atual não diferencia mudanças de documentação/auditoria de mudanças que devem ser promovidas automaticamente pela integração GitHub→Vercel; isso deve ser decidido e, se necessário, controlado na fase de correção.

## 25. Estado após auditoria dos contratos de deploy

A fronteira de deploy foi avançada com evidência real: Vercel está integrado ao GitHub e promove automaticamente commits de main para os projetos API e Web; o Web publicou o SHA do tracker com sucesso e o API iniciou build no mesmo SHA. A política de instalação não é determinística no Vercel e o Node efetivo é 24.x, com Web observando 24.21.0 contra 24.20.0 do repositório. A conexão Railway atual não expõe o serviço tms-worker, portanto a auditoria desse componente permanece baseada na evidência histórica já registrada.

**Regra preservada:** nenhuma correção foi iniciada. O próximo bloco deve fechar infraestrutura restante, contratos de ambientes/variáveis sem expor valores, observabilidade/deploy health, backup/restore e, por fim, uma varredura final de lacunas para confirmar que a auditoria inteira está coberta antes da fase de evidências/correções.

## 26. Continuação — Railway efetivo, backup real e observabilidade do worker

- **RAIL-01 — Serviço tms-worker efetivo foi reconciliado:** projeto Railway tms-backup, ambiente production, serviço tms-worker usa repo alexoaraujo83/TMS/main, builder DOCKERFILE e Dockerfile raiz. Watch patterns cobrem Dockerfile, apps/worker, packages/database, packages/observability, package/lock/workspace/turbo. **Estado: E2-E3 COMPROVADO.** O último deployment SUCCESS observado é c0b73296-5f3b-404d-b447-4c7a037a6833, SHA 505bb50fa437241af6aaaf10191db02c98c71e90; commits posteriores de auditoria foram SKIPPED pelo watch/build contract.
- **RAIL-02 — Worker não possui healthcheck configurado no serviço Railway:** get_service_config não reporta healthcheckPath e o processo também não possui readiness externo. **Estado: LACUNA OPERACIONAL / P1.** Reforça WORK-14/WORK-03.
- **RAIL-03 — Worker possui variáveis de produção definidas, mas os valores estão redacted nesta conexão:** DATABASE_URL, DURABLE_JOBS_ENABLED, OUTBOX_TENANT_IDS, polling/batch e webhook timeout estão presentes. **Estado: CONFIGURAÇÃO PARCIALMENTE COMPROVADA.** Não inferir valores de segredo/flags.
- **RAIL-04 — Logs do worker mostram telemetria real de durable_job com status pending para um tenant:** no deployment SUCCESS c0b732... há registros repetidos de durable_job.telemetry entre 00:23 e 00:31 UTC, com tenant_id e status pending. **Estado: E4 PARCIAL / NÃO CONCLUI PROCESSAMENTO.** A evidência prova que o processo está emitindo telemetria sobre jobs pendentes, mas não prova que um evento de negócio percorreu outbox→durable job→handler→audit nem que jobs pendentes estejam sendo consumidos com sucesso.
- **RAIL-05 — Deployment atual do worker continua atrás do HEAD auditado:** último SUCCESS é SHA 505bb50..., enquanto deployments dos commits 41b9463 e 92ac715... foram SKIPPED. **Estado: WORK-01 PARCIAL / P1.** A regra de watch explica o skip de alterações apenas no tracker; ainda falta confirmar se alterações funcionais futuras do worker acionam o serviço.
- **RAIL-06 — Backup worker possui contrato operacional explícito:** serviço tms-backup-worker usa infra/backup/Dockerfile, start /app/backup.sh, cron 02:00 UTC, uma réplica em sfo e restartPolicy NEVER. Variáveis de backup/restore estão definidas e valores permanecem redacted. **Estado: E2-E3 COMPROVADO.**
- **BAK-02 — Backup real está evidenciado por logs de produção:** execuções em 2026-09-22, 2026-09-23 e 2026-09-24 emitiram backup_status=verified, checksum SHA-256, bytes, duração, postgres_version 17.11, 21 tabelas e migration_count=33. A execução de 2026-09-24 teve backup_id 20260924T020335Z, 136096 bytes e duração de 32s. **Estado: E4 PARCIALMENTE COMPROVADO.** Falta recuperar/inspecionar independentemente o objeto e executar restore real para fechar BAK-01/DR-01.
- **BAK-03 — Evidência de backup sugere fonte com 33 migrações, mas não identifica independentemente a conexão alvo:** o log do backup registra migration_count=33, porém o valor de NEON_DATABASE_URL está redacted e não houve consulta live independente nesta etapa. **Estado: SINAL RELEVANTE, NÃO PROVA DB-01.** Não substituir a evidência P0 de schema live por este log.
- **BAK-04 — Retenção é executada pelo script e verificada nos logs:** as execuções observadas reportam retention_days=14, retention_deleted_objects=0 e retention_status=verified. **Estado: E2-E4 PARCIAL.** Falta confirmar a política do bucket/provedor e RPO/RTO aprovados.
- **BAK-05 — Criptografia do backup usa AES-256-CBC + PBKDF2 e SHA-256 separado:** o script usa openssl enc -aes-256-cbc -pbkdf2 -iter 600000 e armazena sidecar SHA-256. **Estado: CONTROLE ESTRUTURAL / P1-P2.** CBC não fornece autenticação criptográfica por si só; a integridade atual depende do SHA sidecar e do controle de acesso ao objeto/sidecar. Revisar na fase de hardening, sem alterar agora.
- **RAIL-07 — Backup worker é cron com restartPolicy NEVER:** falha do processo não recebe restart automático, embora o cron seguinte possa iniciar nova execução. **Estado: DECISÃO OPERACIONAL / P1-P2.** A política deve ser confrontada com o requisito de alerta de falha e RPO.
- **RAIL-08 — A conexão Railway atual permite inspeção completa do projeto tms-backup:** a limitação anterior de acesso ao tms-worker foi resolvida ao localizar o serviço no projeto tms-backup. **Estado: EVIDÊNCIA ATUALIZADA.** Manter os dados anteriores somente como histórico e usar esta leitura para o estado corrente.
  
## 27. Estado após infraestrutura Railway e backup

A auditoria de infraestrutura avançou até o runtime efetivo Railway. O serviço tms-worker foi reconciliado com seu Dockerfile raiz, watch patterns e deployments; o último SUCCESS permanece em SHA antigo e os commits de auditoria posteriores foram corretamente SKIPPED. Há telemetria real de durable jobs pendentes, mas ainda não há prova E4 do processamento completo. O backup worker tem cron e contrato de armazenamento/criptografia definidos e agora possui evidência real de execuções verificadas, inclusive migration_count=33 em logs de produção; isso reduz BAK-01 de “sem evidência” para evidência operacional parcial, mas não fecha restore nem RPO/RTO.

**Regra preservada:** nenhuma correção/refatoração foi iniciada. O próximo bloco deve fechar a varredura final de infraestrutura, segurança de segredos, observabilidade, health/readiness, ambientes, matriz de deploy e documentação; somente então será feita a consolidação final da auditoria e iniciada a fase separada de evidências/correções.


## 28. Continuação — contrato de ambientes, observabilidade e CI do HEAD

- CI-08 — CI do HEAD atual foi comprovado: workflow CI run 36077970795 (run #1134) concluiu success no SHA c6606af28861e05f14c80bc50c89192907d02378, o commit atual do tracker. Estado: E3 COMPROVADO. Isso fecha a lacuna anterior de CI apenas no HEAD de controle para o HEAD efetivamente auditado, sem substituir as provas E4 de produção.
- CI-09 — Houve run de auditoria anterior cancelado: run 36076682893 no SHA 50314de terminou cancelled; não é evidência de falha de qualidade do código. Estado: HISTÓRICO / SEM AÇÃO FUNCIONAL.
- ENV-03 — .env.example não cobre o contrato completo do worker: o arquivo raiz documenta WORKER_ENABLED e WORKER_CONCURRENCY, mas o worker efetivo consome também OUTBOX_TENANT_IDS, OUTBOX_WEBHOOK_URLS, OUTBOX_POLL_INTERVAL_MS, OUTBOX_BATCH_SIZE, OUTBOX_WEBHOOK_TIMEOUT_MS, OUTBOX_WEBHOOK_SECRET, DURABLE_JOBS_ENABLED e LOG_SERVICE. Existe documentação específica de reconciliação dessas variáveis, mas o contrato central ainda não é único. Estado: DRIFT DE CONTRATO / P1.
- ENV-04 — packages/config valida um subconjunto diferente do runtime real: loadConfig() exige APP/DATABASE/Auth0 e worker básico, mas não representa as variáveis operacionais do worker nem BACKUP/observability/Web. Estado: DÍVIDA DE ARQUITETURA DE CONFIGURAÇÃO / P2, reforçando SEC-02/CONFIG-01.
- SEC-04 — Segredos entram no grafo de build do Turbo: turbo.json declara AUTH0_SECRET e AUTH0_CLIENT_SECRET como variáveis do task build. A declaração não prova vazamento, e o valor não foi exposto; porém faz com que mudanças nesses segredos participem do ambiente/assinatura do build. Estado: REVISÃO DE SEGURANÇA/BUILD / P1.
- OBS-01 — Observabilidade atual é predominantemente logging estruturado: packages/observability fornece níveis de log, correlation/request IDs e redaction de chaves sensíveis. A busca estrutural não encontrou implementação versionada de métricas Prometheus/OpenTelemetry, Alertmanager, ou política de alertas/uptime. Estado: E2-E3 PARCIAL / LACUNA OPERACIONAL P1. Não significa ausência de monitoramento externo; apenas não há evidência versionada suficiente no repositório para fechar o contrato.
- OBS-02 — Redaction está implementado, mas erros ainda podem carregar stack/message: o logger redige chaves sensíveis e preserva Error.name/message/stack. Isso é adequado para diagnóstico interno, mas exige revisar os sinks/retention do provedor antes de considerar logs como canal seguro para produção. Estado: CONTROLE ESTRUTURAL / REVISÃO P2.
- WORK-18 — Worker continua sem sinal de readiness/liveness próprio: o código faz validação de role/tenants no startup e emite service.started, worker.idle, worker.error e durable_job.telemetry, mas não expõe endpoint/porta de health nem estado externo de último ciclo bem-sucedido. Estado: P1 ABERTO, reforçando WORK-03/WORK-14/RAIL-02.
- AUTH-03 — Contrato Auth0 está bem documentado, mas a capacidade específica do plugin não está disponível nesta conexão: a infraestrutura versionada mantém tenant.yaml, Action e instruções de dry-run/deploy; não foi obtida uma ferramenta/plugin Auth0 operacional nesta sessão para executar a verificação externa. Estado: E2-E3 DOCUMENTAL / E4 BLOQUEADO. Não considerar a documentação como prova de Action implantada/associada nem de token real.
- DOC-04 — docs/SSOT-OPERATIONS.md contém snapshot operacional histórico que diverge do estado mais recente do backup: ele ainda registra schema_migrations em 0031 e outbox/durable_jobs/audit_events vazios. O documento deve permanecer histórico, mas precisa ser explicitamente datado/rotulado para não ser lido como estado corrente. Estado: DRIFT TEMPORAL / P1.
- AUDIT-01 — Varredura de observabilidade/configuração não encontrou novo vetor crítico além dos itens já rastreados: não foram encontrados, no índice de código pesquisado, implementações versionadas de Prometheus/OpenTelemetry/Alertmanager ou health/readiness que fechem os gaps existentes. Estado: COBERTURA ESTRUTURAL AVANÇADA; E4 CONTINUA PENDENTE.

## 29. Estado após ambientes, observabilidade e CI

O HEAD atual do tracker agora possui CI verde comprovado (36077970795) e a auditoria de configuração confirmou que o contrato de ambiente ainda está fragmentado: o .env.example, packages/config, worker e infraestrutura não compartilham uma única fonte de verdade para todas as variáveis. A observabilidade possui logging estruturado, correlação e redaction, mas não há evidência versionada suficiente de métricas/alertas nem readiness externo do worker. O contrato Auth0 está fonte-controlado, porém continua sem prova E4 de deployment/trigger/token real.

Regra preservada: nenhuma correção, limpeza, refatoração ou mudança funcional foi iniciada. Com esta etapa, os eixos estruturais principais de código, banco, Auth0, API, Web, worker, CI/CD, Vercel, Railway, backup, configuração, observabilidade e documentação já foram percorridos. A próxima etapa deve ser uma consolidação final da auditoria, separando P0/P1/P2 e explicitando o que ainda depende de evidência operacional externa antes da transição para a fase de evidências/correções.


## 30. Consolidação final da fase de auditoria estrutural

### 30.1 Controle de HEAD e governança Git

- O HEAD atual de main é `c4fcb3ba598a0218142c11911b52d7a032eb24a4`.
- O CI correspondente é o run `36080140034` (#1135), disparado pelo próprio commit do tracker e ainda `in_progress` no momento desta coleta. Portanto, **não fechar CI-01 como verde neste SHA ainda**. O último HEAD de tracker com resultado final é `c6606af...`, run `36077970795`, `success`.
- A API de branch protection agora forneceu evidência direta: `main` está **sem proteção habilitada**, sem required status checks. Isso converte a limitação anterior de acesso a branch protection em finding concreto. **CI-10 — GOVERNANÇA DE MAIN / P1:** o branch principal atualmente não exige checks antes de merge/push. Não significa que todo push seja inseguro por si só; significa que não existe enforcement GitHub versionado/efetivo impedindo avanço sem CI.
- Não foi criada proteção durante a auditoria. Este é um finding para a fase de correção/governança.

### 30.2 Matriz consolidada de P0

| ID | Finding | Evidência atual | Fechamento exigido |
|---|---|---|---|
| DB-01 | Migration head/checksum de produção não reconciliado independentemente | Repo até 0033; logs de backup indicam migration_count=33, mas não identificam independentemente a conexão alvo | Consulta read-only live em schema_migrations + checksums 0032/0033 |
| DB-04 | RLS comportamental em produção | Código/RLS/runtime role estruturalmente fortes; teste cross-tenant produtivo não executado | Teste controlado com credencial runtime real |
| AUTH-01 | E2E Auth0 tenant claim | Action/guards/membership existem no repo; token real e trigger não foram comprovados | Token novo + Web→API→DB + negativo cross-tenant |
| SEC-01 | Isolamento tenant E4 | Defesa em profundidade comprovada estruturalmente | Fechar com DB-04 + AUTH-01 |
| REL-01 | Manifesto de release | SHAs efetivos e migration head ainda estão dispersos entre evidências | Manifesto versionado após reconciliação operacional |
| FINAL-01 | DoD final | P0 acima permanecem abertos | Só fechar após evidências P0 e regressão |

### 30.3 Matriz consolidada de P1

- **DB:** DB-02 baseline permissivo permanente; DB-03 role runtime; DB-06 validação incompleta de baseline/checksums.
- **Auth/API:** AUTH-02 paridade Auth0; API-01 matriz de rotas; API-02/03/04/05 replay; API-06 diagnóstico; SEC-03 replay hardening.
- **Worker:** WORK-01/02/03/04; WORK-06/07/14/15 e RAIL-02/05; falta prova E4 do processamento completo.
- **Backup/DR:** BAK-01/02 parcial; DR-01; BAK-04 RPO/RTO; BAK-05 hardening criptográfico.
- **Ambientes/build/deploy:** ENV-01/02/03; BUILD-01/02/03; CI-02/05/06/07/10; WEB-02/10/13; DEPLOY-09.
- **Observabilidade:** OBS-01 e readiness/alerting do worker.
- **Documentação:** DOC-01/03/04 e reconciliação dos documentos históricos.
- **Segurança de build:** SEC-04 revisão de segredos declarados no ambiente do Turbo build.

### 30.4 Matriz consolidada de P2

- SEC-02 / CONFIG-01: centralização efetiva de configuração.
- DB-05 / PKG-08: tipagem e limpeza de código/repositórios órfãos.
- PKG-01/02/05/06/07/08: higiene do monorepo, dependências e build graph.
- WEB-01/03/11/12: refatoração frontend, testes e mensagens de erro/configuração.
- TEST-01: cobertura/gates adicionais.
- DOC-02: reconciliação runtime dos diagramas Mermaid.
- BUILD-03: Dockerfile secundário Node 22.
- OBS-02: revisão de sinks/retention dos logs.

### 30.5 Limites da auditoria

A auditoria estrutural percorreu código, banco/migrações, RLS, Auth0 fonte-controlado, API/AuthZ, Web, worker/outbox/durable jobs, CI, Vercel, Railway, backup/restore, configuração, observabilidade, documentação e governança Git. Os itens restantes não são “desconhecidos”: estão classificados como evidência operacional externa pendente, decisão de arquitetura/governança ou dívida técnica.

A conexão atual não disponibiliza uma capacidade operacional Auth0 específica, portanto não foi simulada nem inferida prova E4 de Auth0. Da mesma forma, o CI do novo commit do tracker estava em andamento no instante da coleta e permanece aberto até resultado final.

### 30.6 Fronteira de fase

**FASE 1 — AUDITORIA ESTRUTURAL: CONCLUÍDA.**

A partir deste ponto, o trabalho pode mudar de natureza para **FASE 2 — EVIDÊNCIAS OPERACIONAIS E CORREÇÕES**, mas os P0 devem ser tratados primeiro e toda alteração deve continuar sendo registrada no tracker.

**Regra preservada nesta consolidação:** nenhuma correção funcional, refatoração, limpeza, alteração de permissões, alteração de banco ou mudança de infraestrutura foi realizada durante a auditoria. O único conteúdo alterado nesta fase foi documentação do tracker.


## 31. Início da FASE 2 — evidências operacionais e correções

### 31.1 Roadmap priorizado criado

Foi criado o arquivo `docs/audit/CORRECTIONS-ROADMAP.md`, derivado deste tracker, com a ordem estruturada de execução para:

1. evidência/correção funcional P0;
2. segurança e infraestrutura P1;
3. refatoração, limpeza e hardening P2.

O roadmap não altera a prioridade canônica do tracker; ele organiza a execução por dependência e risco.

### 31.2 P0 — DB-01: primeira tentativa de evidência live

Foi iniciada uma consulta read-only em Neon usando o branch de produção previamente registrado (`br-lingering-shadow-act0vvi9`) para consultar `schema_migrations`. A ferramenta Neon disponível nesta sessão exige adicionalmente o `project_id` e rejeitou a chamada sem esse identificador.

**Estado:** DB-01 permanece BLOQUEADO.  
**Não houve mutation, migration, alteração de branch ou alteração de produção.**

A evidência histórica continua válida apenas como histórico: `schema_migrations` anteriormente observado em 31 migrações não é usado para afirmar o estado atual.

### 31.3 P0 — AUTH-01: capacidade operacional Auth0

A capacidade específica do plugin Auth0 solicitada para esta etapa não está exposta entre as ferramentas disponíveis nesta conexão. Portanto não foi possível executar emissão/validação de token real, nem inferir que a Action esteja implantada/associada em produção.

**Estado:** AUTH-01 permanece ABERTO/BLOQUEADO para E4.  
**Nenhum segredo, token ou configuração sensível foi exposto ou alterado.**

### 31.4 P0 — CI-01: atualização da evidência

O run `36080140034` / #1135 no SHA `c4fcb3ba598a0218142c11911b52d7a032eb24a4` terminou `cancelled` e foi corretamente descartado como evidência verde. Em seguida, o run `36081162875` / #1139 foi executado no SHA `2eb43e87bb8005cbfb6d65c7808e34dde725cca4` e terminou `success`.

O job `107903222930` passou integralmente por: instalação frozen do lockfile, validação dos diagramas, migration, roles/RLS/IAM, integração outbox/durable jobs/replay, format, lint, typecheck, test e build.

**Estado:** CI-01 FECHADO/COMPROVADO para o HEAD de controle/documentação `2eb43e87...`. Isso não fecha DB-01/DB-04/AUTH-01 e não substitui evidência operacional de produção.

### 31.5 Regra operacional desta fase

Nenhuma correção funcional, migration, alteração de RLS, alteração de Auth0, mudança de infraestrutura ou refatoração foi executada nesta primeira entrada da Fase 2. O único write funcional/documental desta etapa foi a criação do roadmap de execução.

Próximo alvo P0: obter o `project_id` Neon necessário para a consulta read-only de DB-01; em seguida executar DB-04 e AUTH-01 somente com credenciais/ambientes operacionais apropriados, sem fabricar evidência.


## 32. FASE 2 — DB-01: projeto Neon identificado, consulta live ainda bloqueada pelo contrato da ferramenta

### 32.1 Identificação do projeto canônico

A busca no repositório encontrou evidência versionada em `docs/operations/BACKUP-RESTORE-DRILL.md` que identifica o projeto Neon canônico como `tms` com identificador `shiny-hall-34679912`. Isso resolve a identificação nominal do projeto, mas não substitui a consulta live.

### 32.2 Limitação operacional reproduzida

Foram tentadas as operações Neon necessárias para resolver a branch/consulta live. O backend da ferramenta rejeitou as chamadas por ausência de `project_id`, enquanto o schema exposto pela própria ferramenta não aceita esse campo nos métodos `list_branches`/`describe_branch`/`run_sql`. Portanto existe uma incompatibilidade entre o contrato exposto da conexão e o requisito interno do backend.

**Estado:** DB-01 continua **BLOQUEADO por tooling**, não por ausência de identificação do projeto.

### 32.3 Checksums esperados no repositório

O script `packages/database/scripts/migrate.ts` define o checksum de cada migration como SHA-256 do conteúdo UTF-8 integral do arquivo. Com os arquivos atuais:

| Migration | SHA-256 esperado |
|---|---|
| `0032_observability_audit_context.sql` | `1c8e70d30f1bbd9442682035b7c08e8fdc3ed619b83615f8eb033bbb4cc45e78` |
| `0033_durable_job_idempotency.sql` | `d18c0849023fd07407350cbd1bb38a1b4caf0074242b7ff4bf8cd59d426b2a3c` |

Os hashes acima são **baseline de código**, não evidência do banco live. O fechamento de DB-01 exige comparar esses valores com `schema_migrations` da branch de produção.

### 32.4 Segurança operacional

Nenhuma migration foi aplicada, nenhuma branch foi criada/resetada/deletada e nenhum dado de produção foi alterado nesta etapa. O próximo passo continua sendo uma consulta read-only de `schema_migrations` assim que a conexão Neon puder receber o identificador do projeto de forma compatível.

### 32.5 Próximo avanço P0
1. Resolver a incompatibilidade do conector Neon para executar a consulta read-only no projeto `shiny-hall-34679912`.
2. Registrar head, checksums e `current_user`/database somente como evidência mínima necessária.
3. Se houver drift de checksum/head, interromper qualquer migration automática e abrir correção específica; não equalizar SHA cegamente.
4. Com DB-01 fechado, avançar para DB-04 comportamental.

**Estado da Fase 2 antes deste avanço:** P0 ainda aberto; nenhuma correção funcional executada.


## 33. FASE 2 — CI-01 fechado no HEAD de controle atual

### 33.1 Evidência CI atual

O GitHub Actions run `36081162875` / #1139, workflow `CI`, foi executado por push no SHA `2eb43e87bb8005cbfb6d65c7808e34dde725cca4` e terminou com **status=completed / conclusion=success**.

Job: `107903222930` (`quality`). Todos os passos concluíram com sucesso, incluindo:
- instalação `pnpm install --frozen-lockfile`;
- validação da documentação arquitetural versionada;
- migration;
- validação de atributos do runtime role;
- RLS com role non-bypass;
- IAM runtime resolver;
- integração PostgreSQL de Durable Jobs;
- fluxo `freight.status_changed` de outbox para durable job;
- replay e evidência cross-tenant em runtime de CI;
- format, lint, typecheck, test e build.

### 33.2 Limite da evidência

Esta evidência fecha **CI-01** para o SHA de controle/documentação atual. Ela comprova os gates automatizados configurados no CI, mas não comprova:
- head/checksum do `schema_migrations` no Neon de produção;
- RLS comportamental com a credencial real de produção;
- E2E Auth0 real em produção;
- execução E4 do worker em produção;
- release funcional completa por componente.

Os quatro status externos associados ao commit `2eb43e87...` também retornaram `success` para tms-worker, tms-backup-worker, tms-web e tms-core-api. Esses status são registrados como evidência de integração/deploy, não como substitutos dos gates P0 operacionais.

### 33.3 Estado após este avanço

- **CI-01: FECHADO/COMPROVADO.**
- **DB-01: BLOQUEADO por incompatibilidade do conector Neon.**
- **DB-04: BLOQUEADO aguardando credencial/runtime de produção.**
- **AUTH-01: ABERTO/BLOQUEADO aguardando capacidade operacional Auth0.**
- **SEC-01: permanece dependente de DB-04 + AUTH-01.**
- **REL-01: ainda não iniciado, pois o manifesto deve reconciliar migration head e versões efetivas dos componentes.**

Nenhuma migration, alteração de RLS, Auth0, infraestrutura ou refatoração foi executada neste avanço.

### 33.4 Próximo alvo

Continuar P0 pelo desbloqueio de DB-01; em paralelo, preservar a evidência CI-01 recém-fechada e não reclassificar os demais P0 por inferência.

## 34. FASE 2 — DB-01: incompatibilidade confirmada também no resolvedor de branch

### 34.1 Nova tentativa read-only

Foi testado o método Neon `get_branch` diretamente para a branch de produção já identificada (`br-lingering-shadow-act0vvi9`). O contrato exposto declara apenas `branch_id`, porém o backend retornou erro de validação informando que `project_id` é obrigatório e estava ausente.

Isso confirma que a incompatibilidade não está limitada a `run_sql`, `list_branches` ou `describe_branch`: também afeta a resolução direta de uma branch conhecida.

### 34.2 Conclusão operacional

- **DB-01 permanece BLOQUEADO por tooling.**
- O projeto canônico continua identificado como `tms / shiny-hall-34679912`.
- A branch de produção continua identificada como `br-lingering-shadow-act0vvi9` por evidência versionada prévia.
- Não foi obtida nenhuma leitura live de `schema_migrations` nesta tentativa.
- Nenhuma migration, branch, dado ou configuração de produção foi alterado.

### 34.3 Limite importante

O método `get_connection_string` também não é um substituto adequado para esta auditoria: além de poder expor credencial privilegiada, seu contrato não oferece um campo `project_id` e a própria documentação da ferramenta informa que a string é indisponível em modo somente leitura. Portanto não será usado para contornar o bloqueio nem para expor segredo.

### 34.4 Próximo alvo

Continuar buscando uma capacidade Neon compatível com o identificador do projeto ou uma correção de integração que preserve consulta read-only. Se isso não for possível nesta sessão, o finding deve permanecer BLOQUEADO e nenhuma evidência live deve ser inferida de contagens históricas, logs de backup ou sucesso de CI.


## 35. FASE 2 — Reconciliação Neon Data API / Auth / RLS

### 35.1 Objetivo

Foi realizada a comparação da implementação atual do TMS com o quickstart oficial do Neon Data API fornecido para esta auditoria, cobrindo Neon Auth, Auth0 como provedor externo, `@neondatabase/neon-js`, Data API e PostgreSQL RLS.

### 35.2 Evidência do repositório

A implementação atual do TMS **não utiliza Neon Data API nem `@neondatabase/neon-js`**.

Não foram encontrados no código/lockfile:
- `@neondatabase/neon-js`;
- `createClient({ dataApi: ... })`;
- `VITE_NEON_DATA_API_URL`;
- `VITE_NEON_AUTH_URL`;
- `BetterAuthReactAdapter`;
- chamadas ao endpoint `apirest.*.neon.tech/neondb/rest/v1`.

A arquitetura comprovada permanece:

`Auth0 → NestJS API → pg → PostgreSQL/Neon → PostgreSQL RLS`.

### 35.3 Autenticação atual

O Web utiliza `@auth0/nextjs-auth0`. O pacote `@tms/auth` define o claim `https://tms-platform.io/claims/tenant_id`, enquanto a API valida identidade/token e resolve membership no PostgreSQL antes de anexar o tenant ao contexto da requisição.

A documentação arquitetural estabelece explicitamente que o claim de tenant não substitui membership, que `X-Tenant-Id` é apenas seleção de contexto e que PostgreSQL RLS permanece a barreira final.

### 35.4 RLS atual

A camada de banco utiliza conexão PostgreSQL direta com `pg`. Transações tenant-aware executam `set_config('app.tenant_id', tenantId, true)` dentro da transação. As migrations habilitam/forçam RLS e o runtime role é configurado sem `BYPASSRLS`.

Os testes de segurança e integração existentes cobrem isolamento cross-tenant no runtime de CI. A prova equivalente com a credencial real de produção permanece DB-04/P0 aberto.

### 35.5 Neon Auth

Há evidência histórica de nove tabelas `neon_auth` no banco Neon de produção observado anteriormente, porém **não existe integração do SDK Neon Auth no aplicativo**. A presença de objetos `neon_auth` no banco não é tratada como prova de que Neon Auth seja o IdP ativo do TMS.

### 35.6 Comparação com o quickstart

O quickstart apresenta duas arquiteturas possíveis:

1. Neon Auth + `createClient({ auth, dataApi })`.
2. Provedor externo, como Auth0, + `createClient({ dataApi: { getToken } })`.

A segunda opção é conceitualmente compatível com o Auth0 existente, mas sua adoção exigiria preservar ou redesenhar explicitamente as regras atuais de membership, RBAC, seleção de tenant, auditoria e RLS.

### 35.7 Decisão de auditoria

**Não migrar para Neon Data API nesta etapa.**

A ausência de `neon-js` é classificada como **arquitetura alternativa não adotada**, e não como defeito funcional. Introduzir Data API agora criaria uma segunda superfície de acesso ao banco antes do fechamento dos P0 operacionais (DB-01, DB-04 e AUTH-01).

Se houver requisito explícito posterior de Data API, deverá ser aberto um finding arquitetural próprio com matriz de equivalência de:
- autenticação;
- membership;
- RBAC;
- tenant context;
- RLS;
- auditoria;
- transações;
- operações administrativas;
- observabilidade;
- performance/limites da Data API.

### 35.8 Classificação

| ID | Finding | Estado | Prioridade |
|---|---|---|---|
| NEO-01 | Neon Data API não integrada | ARQUITETURA NÃO ADOTADA | P2 / sob demanda |
| NEO-02 | Neon Auth SDK não integrado | ARQUITETURA NÃO ADOTADA | P2 / sob demanda |
| NEO-03 | Auth0 + Neon Data API é tecnicamente compatível em princípio | NÃO IMPLEMENTADO | P2 / decisão arquitetural |
| NEO-04 | PostgreSQL RLS existente e tenant-aware | ESTRUTURALMENTE COMPROVADO; E4 produção pendente | P0 via DB-04 |
| NEO-05 | Neon Auth objects presentes historicamente no banco | EVIDÊNCIA HISTÓRICA, NÃO PROVA DE IdP ATIVO | P1/P2 documental |

### 35.9 Regra preservada

Nenhuma dependência foi adicionada, nenhuma rota foi migrada para Data API, nenhuma policy RLS foi alterada e nenhuma configuração Auth0/Neon foi modificada neste avanço.

Próximo alvo P0 permanece **DB-01**, seguido de **DB-04** e **AUTH-01** quando as capacidades operacionais necessárias estiverem disponíveis.


## 36. FASE 2 — Evidência de schema fornecida e DB-01

### 36.1 Artefato recebido

Foi fornecido um DDL contendo o schema TMS com 21 tabelas públicas, incluindo `public.schema_migrations`, e nove tabelas em `neon_auth`. O artefato também contém os campos adicionados pelas migrations `0032_observability_audit_context.sql` (`correlation_id`, `actor_subject`, `ip_address`, `user_agent`, `outcome`) e `0033_durable_job_idempotency.sql` (`durable_jobs.idempotency_key`). O arquivo recebido é evidência do **formato estrutural** do schema, não da sequência de migrations aplicadas em produção. fileciteturn54file0L5-L23

### 36.2 Lacunas do artefato

O DDL fornecido não contém:
- linhas de dados de `schema_migrations` com versão/checksum;
- `CREATE POLICY` das tabelas RLS;
- `FORCE ROW LEVEL SECURITY`;
- grants/atributos da role `tms_app`;
- funções/triggers de suporte ao runtime.

Portanto, ele **não pode fechar DB-01 nem DB-04**. Em particular, a presença de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` demonstra intenção/estado estrutural parcial, mas sem policies e sem prova da role não demonstra isolamento efetivo. fileciteturn54file0L23-L34

### 36.3 Sinal adicional sobre Neon Auth/Data API

O artefato cria os schemas `auth`, `neon_auth` e `pgrst`, e contém as nove tabelas de `neon_auth`. Isso é consistente com objetos de plataforma/integração Neon presentes no banco, mas **não prova que o aplicativo utiliza Neon Auth ou Neon Data API**. O código do TMS continua sem integração `@neondatabase/neon-js`, conforme registrado em NEO-01..NEO-05.

### 36.4 DB-01 permanece bloqueado

A tentativa read-only de usar o conector Neon continua impedida por incompatibilidade entre o schema exposto da ferramenta e a validação do backend: o backend exige `project_id`, enquanto o contrato exposto dos métodos testados não o aceita. O projeto/branch canônicos já estão identificados documentalmente como `shiny-hall-34679912 / br-lingering-shadow-act0vvi9`, mas isso não substitui a consulta live.

**Estado:** DB-01 = **BLOQUEADO POR TOOLING**.

**Regra:** não marcar 0033 como aplicada em produção somente porque o DDL contém a coluna `idempotency_key`; não executar migration corretiva por inferência.

### 36.5 Próximo alvo P0

1. Desbloquear consulta read-only de `schema_migrations`/checksums.
2. Depois executar DB-04 com role de runtime.
3. Depois AUTH-01 com token Auth0 real.
4. Somente então consolidar SEC-01 e REL-01.

Nenhuma alteração funcional, migration, RLS policy, Auth0 ou infraestrutura foi executada neste avanço.


## 40. FASE 2 — 2026-09-25: DB-01 permanece bloqueado após nova reprodução

### 40.1 Evidência operacional

Nesta continuação foram repetidas as tentativas read-only de acessar o projeto Neon canônico e consultar `schema_migrations`.

- `list_branches({limit:100})` foi rejeitado pelo backend porque `project_id` é obrigatório.
- O contrato exposto de `list_branches` não aceita `project_id`; uma chamada com esse campo é rejeitada localmente como propriedade adicional.
- `describe_project({})` também foi rejeitado pelo backend por ausência de `project_id`.
- A identificação versionada do projeto continua `tms / shiny-hall-34679912`.
- Nenhuma leitura live de `schema_migrations` foi obtida nesta sessão.

### 40.2 Classificação

**DB-01 = BLOQUEADO POR TOOLING.** A evidência continua insuficiente para afirmar que Neon de produção está em migration 0033 ou que os checksums 0032/0033 estão aplicados.

### 40.3 Integridade operacional

Nenhuma migration, mutation, criação/reset/exclusão de branch ou alteração de dados/configuração de produção foi executada. Não foi usado connection string privilegiado como workaround.

### 40.4 Próximo alvo

Desbloquear a integração Neon para obter uma consulta read-only autoritativa de `schema_migrations`; somente depois fechar DB-01, executar DB-04 e avançar para AUTH-01/SEC-01.

## 41. FASE 2 — baseline de código das migrations confirmado

A inspeção de `packages/database/migrations/` confirmou no repositório canônico as migrations 0001–0033, incluindo:

- `0032_observability_audit_context.sql`
- `0033_durable_job_idempotency.sql`

Os checksums SHA-256 de baseline já registrados para 0032 e 0033 permanecem os mesmos. Eles representam o conteúdo versionado no Git; não representam observação do banco live.

**Estado DB-01:** E1 para o baseline do repositório; ainda BLOQUEADO para evidência E2/E3/E4 do banco de produção.

## 42. FASE 2 — matriz P0 atualizada

| ID | Estado atual | Evidência | Dependência para fechamento |
|---|---|---|---|
| CI-01 | FECHADO / COMPROVADO | Run 36081162875 / #1139 = success | Repetir após mudanças funcionais relevantes |
| DB-01 | BLOQUEADO POR TOOLING | Projeto identificado; consulta live indisponível | `schema_migrations` + checksums live |
| DB-04 | BLOQUEADO | RLS estrutural e testes CI existentes | Role real de runtime + teste cross-tenant |
| AUTH-01 | ABERTO/BLOQUEADO | Auth0 implementado no código; token E4 não observado | Capacidade operacional Auth0 + E2E |
| SEC-01 | BLOQUEADO | Defesa em profundidade estrutural | DB-04 + AUTH-01 |
| REL-01 | ABERTO | Manifesto depende de head de migration e SHAs efetivos | DB-01 + reconciliação de release |

**Próximo passo único de maior dependência:** desbloquear DB-01 sem alterar produção.


## 43. FASE 2 — 2026-09-25 — bloqueio Neon reproduzido no executor SQL

Foi feita uma tentativa direta de consulta **read-only** ao branch de produção conhecido `br-lingering-shadow-act0vvi9`, usando `SELECT version, checksum FROM public.schema_migrations ORDER BY version`.

O executor `run_sql` exposto aceita `sql`, `branch_id` e `database_name`, mas o backend rejeitou a chamada exigindo `project_id`, campo que não existe no contrato exposto dessa ferramenta. A mesma incompatibilidade já havia sido observada na resolução de branches/databases.

**Conclusão:** a consulta autoritativa ainda não foi desbloqueada. DB-01 permanece **BLOQUEADO POR TOOLING**. DB-01 remains blocked after direct run_sql attempt. Backend requires project_id although exposed schema omits it; authoritative read-only query could not execute.

Nenhuma mutation, migration, alteração de branch ou alteração de dados foi executada.

**Gate preservado:** DB-04 → AUTH-01 → SEC-01 → REL-01 só avançam após evidência operacional suficiente de DB-01, sem inferência.


## 44. FASE 2 — 2026-09-25 — projeto/branch fornecidos e EXPLAIN read-only validado

O identificador operacional fornecido para a auditoria é:
- projeto: `tms / shiny-hall-34679912`
- branch: `main / br-lingering-shadow-act0vvi9`
- database alvo usado na tentativa: `neondb`

Foi executado, em modo de análise read-only, o plano da consulta:
`SELECT version, checksum FROM public.schema_migrations ORDER BY version;`

O resultado do EXPLAIN confirmou que o banco/branch alcançado possui a relação `public.schema_migrations` e as colunas `version` e `checksum`, com leitura sequencial e ordenação por `version`. Isso é evidência estrutural adicional de que a consulta é válida no alvo. **Não é evidência dos valores/linhas retornados** e, portanto, não fecha DB-01.

A tentativa de execução efetiva via executor SQL continua rejeitada pelo backend por exigir `project_id`, embora esse campo não exista no contrato exposto do executor. Assim, o identificador correto já está conhecido, mas a integração ainda não consegue encaminhá-lo para a operação SQL efetiva.

**Estado DB-01: BLOQUEADO POR TOOLING.** Não houve mutation, migration, alteração de branch, alteração de dados ou uso de credencial privilegiada.

**Gate preservado:** DB-04 → AUTH-01 → SEC-01 → REL-01 permanecem sequenciais e bloqueados até a obtenção dos registros live de `schema_migrations`.


## 45. FASE 2 — 2026-09-25 — DB-01 fechado com evidência live de schema_migrations

Foi fornecida a saída read-only autoritativa de `public.schema_migrations` para o projeto Neon `tms / shiny-hall-34679912`, branch `main / br-lingering-shadow-act0vvi9`, contendo as versões `0001` a `0033` em sequência.

A evidência live confirma:
- **head live = 0033_durable_job_idempotency.sql**;
- **0032 live checksum = `1c8e70d30f1bbd9442682035b7c08e8fdc3ed619b83615f8eb033bbb4cc45e78`**, igual ao SHA-256 do arquivo versionado no repositório;
- **0033 live checksum = `d18c0849023fd07407350cbd1bb38a1b4caf0074242b7ff4bf8cd59d426b2a3c`**, igual ao SHA-256 do arquivo versionado no repositório;
- não há lacuna aparente entre 0001 e 0033 na saída fornecida.

Isso fecha a lacuna que permanecia bloqueada por tooling. A evidência anterior de EXPLAIN demonstrava apenas a existência da relação/colunas; a saída agora fornecida demonstra os **valores efetivos** de versão/checksum.

**DB-01: FECHADO / COMPROVADO.** Não foi necessária nenhuma migration, alteração de schema ou mutação no banco.

### Próximo gate P0

Com DB-01 fechado, a sequência canônica avança para **DB-04 — prova comportamental de RLS/cross-tenant**. AUTH-01 permanece bloqueado/aberto até obter token Auth0 real e evidência E2E; SEC-01 continua dependente de DB-04 + AUTH-01; REL-01 continua após a reconciliação dos componentes e do head de migration.

Regra preservada: o fechamento de DB-01 não implica fechamento de DB-04, AUTH-01, SEC-01 ou REL-01 por inferência.


## 46. FASE 2 — DB-04 — tentativa de evidência comportamental

Após o fechamento de DB-01, foi iniciada a prova E4 de isolamento cross-tenant.

### Evidência estrutural já consolidada
- O papel de runtime definido pelo repositório é `tms_app`.
- A migration `0029_runtime_app_role.sql` define `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS`, sem `CREATE` em `public`.
- As policies tenant-scoped usam `current_setting('app.tenant_id', true)` e várias tabelas possuem `FORCE ROW LEVEL SECURITY`.

### Bloqueio da prova comportamental
As ferramentas disponíveis para inspeção/SQL do Neon continuam apresentando incompatibilidade de contrato: o backend exige `project_id` para chamadas como inspeção de roles/Data API/SQL, mas o schema exposto dessas chamadas não aceita esse campo. A tentativa de consultar o papel `tms_app` foi rejeitada pelo backend por ausência de `project_id`.

Consequentemente, **não foi produzido ainda um E4 válido** executado sob `tms_app`. EXPLAIN/inspeção estrutural não substituem o teste comportamental.

**DB-04: BLOQUEADO POR TOOLING / E4 PENDENTE.** Nenhuma mutação foi realizada.

### Próximo passo necessário
Executar, com uma conexão realmente autenticada como `tms_app`, um teste controlado em dois tenants que prove leitura própria, ausência de leitura cross-tenant e rejeição de escrita cross-tenant. O teste deve registrar o papel efetivo e o tenant context antes de cada operação.


## 47. FASE 2 — 2026-09-25 — DB-04: conexões fornecidas, mas E4 não pode ser executado nesta sessão

### 47.1 Nova evidência operacional

Foram fornecidas as referências de conexão para o banco `neondb`, incluindo as roles `neondb_owner`, `authenticator`, `tms_app`, `anonymous` e `authenticated`, além da URL do Neon Data API.

As credenciais chegaram com o segredo de autenticação redigido (`**`). Portanto, elas permitem identificar a **role/endpoint pretendidos**, mas não fornecem material autenticador utilizável para abrir uma sessão PostgreSQL como `tms_app`.

### 47.2 Tentativa pelo conector Neon

Foi novamente tentado o executor SQL com:

- branch `br-lingering-shadow-act0vvi9`;
- database `neondb`;
- consulta read-only de contexto.

O backend rejeitou a chamada antes da execução SQL porque exige `project_id`, embora o contrato exposto de `run_sql` aceite somente `sql`, `branch_id` e `database_name`.

Também foram inspecionados os contratos disponíveis para `list_postgres_roles`, `get_postgres_role` e `get_data_api`; eles apresentam a mesma limitação de não expor `project_id`.

### 47.3 Conclusão

**DB-04 = BLOQUEADO / E4 PENDENTE.**

A informação fornecida não deve ser tratada como prova de que `tms_app` está sendo usada efetivamente no runtime. Também não é apropriado usar a role privilegiada `neondb_owner` como substituto do teste, porque isso poderia contornar justamente a condição de `NOBYPASSRLS` que o finding precisa provar.

Nenhuma migration, alteração de RLS, branch, dado ou configuração foi executada.

### 47.4 Teste E4 que deve ser executado sem expor segredo

A evidência necessária pode ser obtida diretamente no Neon SQL Editor ou em um cliente PostgreSQL local, usando a conexão **já configurada no ambiente do operador** para `tms_app`. Não é necessário enviar senha/token para esta conversa.

Primeiro, somente leitura:

```sql
SELECT
  current_user,
  current_database(),
  r.rolbypassrls,
  r.rolsuper,
  r.rolcreaterole,
  r.rolcreatedb
FROM pg_roles r
WHERE r.rolname = current_user;
```

Depois, com dois `tenant_id` reais existentes, executar em sessão `tms_app` e registrar apenas os resultados, sem credenciais:

```sql
BEGIN;
SET LOCAL app.tenant_id = '<TENANT_A>';

SELECT count(*) AS own_rows
FROM public.freights
WHERE tenant_id = '<TENANT_A>';

SELECT count(*) AS cross_tenant_rows
FROM public.freights
WHERE tenant_id = '<TENANT_B>';

ROLLBACK;
```

Para a parte de escrita, como ela é mutação mesmo dentro de uma transação de teste, **não deve ser executada autonomamente nesta sessão**. Se autorizada pelo operador, deve ser feita com dados controlados e `ROLLBACK`, comprovando que INSERT/UPDATE cross-tenant são rejeitados ou não produzem alteração persistente.

### 47.5 Evidência mínima para fechar DB-04

Registrar:

1. `current_user = tms_app`;
2. `rolbypassrls = false`;
3. tenant A consegue acessar registros próprios;
4. tenant A não consegue observar registros de B;
5. tentativa de INSERT com `tenant_id = B` é rejeitada;
6. tentativa de UPDATE de registro de B é rejeitada;
7. nenhum segredo, senha, token ou connection string completo entra no tracker.

O fechamento continua condicionado à execução real do teste, não à configuração declarada no repositório.

### 47.6 Próximo gate

Enquanto DB-04 permanecer aberto, a sequência continua:

**DB-04 → AUTH-01 → SEC-01 → REL-01**

Não iniciar correções funcionais ou refatorações a partir deste finding antes da evidência comportamental.


## 48. FASE 2 — 2026-09-25 — continuação: Auth0/Neon Data API e superfície HTTP

### 48.1 Auth0/Neon não substitui o Auth0 real do TMS

Foi verificado novamente o conjunto de capacidades Neon/Auth. Existem operações para Neon Auth e Neon Data API, mas os métodos de leitura de configuração disponíveis também exigem internamente `project_id` que não aparece no contrato exposto em `get_auth`/`get_data_api`. A tentativa de leitura foi rejeitada antes da execução.

O projeto, entretanto, possui contrato explícito no código para **Auth0 externo**, não Neon Auth:
- issuer configurado por `AUTH0_ISSUER_BASE_URL`;
- audience por `AUTH0_AUDIENCE`;
- JWKS por `AUTH0_JWKS_URL`;
- algoritmo permitido: RS256;
- `sub` obrigatório;
- claim tenant namespaced `https://tms-platform.io/claims/tenant_id`;
- membership ativa no banco antes de criar o RequestContext.

**Conclusão:** a existência/configuração de Neon Auth ou Data API não deve ser usada como prova de AUTH-01. O caminho de autenticação auditado continua sendo **Auth0 → API → membership/RLS**.

### 48.2 AUTH-01 permanece aberto

A busca cruzada confirmou que os testes automatizados cobrem issuer, audience, expiração, tenant claim, membership e divergência de tenant header usando chaves/testes sintéticos. Isso é E2/E3 de implementação/CI.

Não foi obtido nesta sessão:
- token Auth0 real recém-emitido;
- confirmação independente do audience de produção;
- execução real Web/API com esse token;
- rejeição observada em produção para tenant sem membership.

**Estado: AUTH-01 = ABERTO / E4 PENDENTE.**

### 48.3 API-11 confirmado por código

A superfície de Freight continua protegida globalmente por `AuthGuard, PermissionGuard`, mas os endpoints:
- `runtime-context`;
- `runtime-db-context`;
- `runtime-rls-isolation`;
- `runtime-auth-claims`

estão associados a `freight:read`.

Esses endpoints expõem contexto operacional de tenant/usuário/roles/permissões e detalhes de banco/OIDC; o diagnóstico de RLS ainda executa uma sonda específica.

**Classificação mantida: API-11 / API-06 = P1 — CONTROLE DE EXPOSIÇÃO.**

Não foi alterado código. A correção somente deve ocorrer depois da decisão operacional sobre diagnóstico em produção.

### 48.4 API-02/SEC-03 confirmado

O endpoint de replay continua dentro do controller protegido por AuthGuard + PermissionGuard, mas usa a permissão funcional ampla `freight:update`. Não foi encontrada permissão dedicada de replay nesta nova verificação.

**Estado: API-02/SEC-03 = P1 / HARDENING PENDENTE.**

### 48.5 CONFIG-01 reafirmado

Existe `packages/config` que conhece as variáveis Auth0, mas o `AuthGuard` ainda lê diretamente `process.env.AUTH0_ISSUER_BASE_URL`, `AUTH0_AUDIENCE` e `AUTH0_JWKS_URL`.

Isso mantém CONFIG-01 como dívida técnica: o contrato centralizado existe, mas o consumidor crítico de autenticação não está efetivamente ligado a ele.

Não corrigir nesta fase; registrar para P2 após fechamento dos gates operacionais.

### 48.6 DB-03 / Worker

O worker possui verificação de startup que consulta `current_user` e falha se o papel não for `tms_app`. Isso comprova a intenção e o mecanismo de proteção no código.

A evidência operacional do worker continua separada: a auditoria precisa reconciliar a identidade efetiva da conexão de produção e a execução real do fluxo de negócio.

**DB-03 = PARCIAL; WORK-02/03 permanecem E4 ABERTOS.**

### 48.7 Regra preservada

Nenhuma migration, alteração de RLS, configuração Auth0, configuração Neon Auth/Data API ou alteração de produção foi executada nesta etapa.


## 49. FASE 2 — 2026-09-25 — DB-04: bloqueio de tooling reproduzido novamente e auditoria de branches

### 49.1 DB-04 — executor SQL continua incompatível

Foi repetida a tentativa read-only de abrir a evidência comportamental sob o branch Neon canônico br-lingering-shadow-act0vvi9 / banco neondb, consultando a identidade efetiva da sessão.

O contrato exposto de run_sql aceita sql, branch_id e database_name, porém o backend rejeita a chamada antes da execução exigindo project_id. O project_id correto do projeto tms é conhecido (shiny-hall-34679912), mas não pode ser encaminhado pelo schema exposto da ferramenta.

**Resultado:** nenhuma sessão tms_app foi aberta por esta via e nenhum teste cross-tenant foi executado. **DB-04 permanece BLOQUEADO POR TOOLING / E4 PENDENTE.**

Não houve migration, mutation, alteração de RLS, branch ou dado de produção.

### 49.2 DB-04 — critério de fechamento preservado

O fechamento continua condicionado a evidência executada como tms_app demonstrando, no mínimo:

1. current_user = tms_app;
2. rolbypassrls = false;
3. leitura do tenant próprio funciona;4. leitura cross-tenant não retorna dados;
5. INSERT cross-tenant é rejeitado;
6. UPDATE cross-tenant é rejeitado.

CI/RLS estrutural e configuração de NOBYPASSRLS não substituem esse teste comportamental.

### 49.3 Auditoria de branches — classificação inicial, sem exclusões

A lista atual do GitHub contém múltiplas linhas históricas de auditoria, hardening, stage, feature, fix e teste. A comparação contra main mostrou exemplos de branches já totalmente absorvidos/sem commits exclusivos (ahead_by=0), além de branches divergentes que ainda carregam commits e arquivos exclusivos.

Exemplos já candidatos a remoção após confirmação de ausência de PR aberto/referência operacional:
- hardening/p0-iam-tenant-20260915 — ahead_by=0;
- hardening/durable-jobs-tenant-lifecycle-current-main — ahead_by=0;
- fix/blk-worker-01-freight-status-flow-2026-09-21 — ahead_by=0;
- stage10.11-dr-safe-drill-evidence — ahead_by=0;
- stage10.10-backup-restore-readiness-v2 — ahead_by=0.

Branches como audit/chat-07-technical-diagrams, audit/chat-08-operational-routing-2026-09-20, audit/p0-database-rls-2026-09-15, hardening/p0-rls-runtime-20260916, feat/e4-freight-runtime-bff-rebased e refactor/cleanup-residue-01-rebased não devem ser removidas por simples idade: ainda possuem commits/arquivos exclusivos em relação a main e exigem reconciliação com PRs, tags ou valor histórico antes de qualquer exclusão.

**Regra:** nenhuma branch foi excluída nesta etapa. A limpeza permanece separada da auditoria funcional até que a linhagem e os consumidores sejam comprovados.

### 49.4 Próximo gate

**P0:** DB-04 → AUTH-01 → SEC-01 → REL-01.

**Limpeza de branches:** primeiro reconciliar PRs/refs das candidatas ahead_by=0; somente depois executar exclusões autorizadas e registrar a evidência de cada remoção.


## 50. FASE 2 — 2026-09-25 — branches candidatas reconciliadas com PRs

A verificação de linhagem das cinco branches candidatas confirmou que todas têm PRs já **merged** e estão `ahead_by=0` em relação a `main` no estado atual:

| Branch | PR | Estado do PR | Merge commit |
|---|---:|---|---|
| hardening/p0-iam-tenant-20260915 | #34 | merged | ac0471e9887ee003f9d4c4030dac47fedaed61ca |
| hardening/durable-jobs-tenant-lifecycle-current-main | #44 | merged | e723181919c18305601d604f07c838c1db41feb1 |
| fix/blk-worker-01-freight-status-flow-2026-09-21 | #63 | merged | ab5bbd7b5eb7a208d3da010988d4b77e88e425c0 |
| stage10.11-dr-safe-drill-evidence | #27 | merged | 14cdbde2c057a2552c7fd1391add6f3f76cd0bd0 |
| stage10.10-backup-restore-readiness-v2 | #25 | merged | 8ec2537aced9a113b51e8f7e5be82e3eab4b0e1f |

### Decisão de limpeza

A evidência de conteúdo não indica commits exclusivos pendentes nessas cinco branches, e os trabalhos correspondentes já estão representados pelos merge commits em `main`. Elas permanecem **candidatas seguras para exclusão de branch**, sujeitas apenas à confirmação de que não existe referência operacional externa específica (por exemplo, automação apontando nominalmente para a branch).

A capacidade GitHub disponível nesta sessão não expôs uma operação de exclusão de branch/ref. Portanto, **nenhuma exclusão foi simulada ou declarada como realizada**.

As branches divergentes continuam preservadas.

### Próximo passo

Se a operação de exclusão estiver disponível, remover somente essas cinco após uma última verificação de refs/automação; registrar cada remoção com branch, data e resultado. Não remover branches divergentes por idade.


## 51. FASE 2 — 2026-09-25 — DB-04: caminho runtime reconciliado; bloqueio passa a ser evidência de sessão

### 51.1 Identidade efetiva de tms_app

A evidência fornecida no Neon SQL Editor confirmou:

- tms_app: rolcanlogin=true;
- rolsuper=false;
- rolbypassrls=false;
- rolcreaterole=false;
- rolcreatedb=false;
- rolreplication=false.

A consulta de membership retornou somente neondb_owner → tms_app. Não existe associação authenticator → tms_app comprovada por essa consulta.

### 51.2 Arquitetura runtime reconciliada

A revisão do código confirma que o TMS não utiliza Neon Data API/Neon Auth como caminho de banco da aplicação. API e worker criam pools PostgreSQL diretamente a partir de DATABASE_URL, e ambos validam current_user = tms_app no runtime.

Portanto, não será criado GRANT tms_app TO authenticator apenas para fabricar uma cadeia que não pertence ao caminho efetivo da aplicação.

O caminho canônico de prova é:

TMS API/Worker → DATABASE_URL → PostgreSQL → current_user=tms_app → RLS/FORCE RLS.

### 51.3 Tentativa de obter evidência operacional

A conexão Railway disponível nesta sessão só expõe o projeto tms-backup; a tentativa de listar serviços retornou ausência de permissão (viewer) para esse recurso. A leitura histórica do repositório identifica tms-worker, mas essa evidência não substitui uma leitura atual do serviço.

Assim, não foi possível extrair nesta sessão a DATABASE_URL runtime nem abrir/observar uma sessão real do serviço sem solicitar ou expor credenciais.

### 51.4 Estado DB-04

DB-04 = BLOQUEADO / E4 PENDENTE, agora por falta de sessão runtime observável, não por falta de definição do papel.

Critério de fechamento permanece: evidência da sessão real com current_user=tms_app, rolbypassrls=false, leitura own-tenant, bloqueio cross-tenant de leitura, INSERT e UPDATE.

Nenhuma alteração de schema, role, RLS, credential ou dado de produção foi executada.

### 51.5 Próximo gate

Obter a evidência de runtime por uma das duas vias legítimas:

1. observabilidade do deployment/serviço que já usa DATABASE_URL; ou
2. cliente PostgreSQL autorizado conectado diretamente como tms_app, sem compartilhar o segredo.

Depois executar a matriz comportamental E4 e registrar resultados antes de avançar DB-04.


## 52. FASE 2 — 2026-09-25 — API runtime role comprovado via readiness E4

### Evidência operacional nova

Foi executado o endpoint público de readiness da API de produção em `https://tms-api-snowy.vercel.app/ready`. A resposta observada foi HTTP 200 com `{"status":"ready","service":"tms-api"}` em 2026-09-25 19:28 -03:00.

O código canônico de `apps/api/src/health.controller.ts` estabelece que `/ready` só retorna `ready` depois de executar `select current_user` e rejeitar qualquer valor diferente de `tms_app`. Portanto, esta evidência combina execução real do runtime da API com o gate de identidade `current_user=tms_app`; não é apenas teste unitário.

### Limite da evidência

Esta prova fecha a adoção do papel no **API runtime**, mas não fecha DB-04. O endpoint não expõe `rolbypassrls` nem executa a matriz cross-tenant. As rotas autenticadas `/freights/runtime-db-context` e `/freights/runtime-rls-isolation` foram também sondadas sem credencial e responderam HTTP 401, confirmando que a superfície de diagnóstico não está anônima, mas sem produzir a evidência tenant-scoped necessária.

### Estado atualizado

- **DB-03 — API runtime role:** E4 operacional comprovado para a API.
- **DB-04 — RLS comportamental:** permanece BLOQUEADO / E4 PENDENTE.
- **WORK-DB-03 — worker runtime role:** permanece pendente de observação direta.
- **AUTH-01:** permanece pendente de token Auth0 real.

### Próximo passo sequencial

Obter a mesma evidência para o worker ou, preferencialmente, uma sessão PostgreSQL real como `tms_app` capaz de executar a matriz DB-04 completa sem expor credenciais. Não alterar RLS, grants ou schema para viabilizar o teste.


## 53. FASE 2 — 2026-09-25 — RLS E4: harness real confirmado, produção ainda não executada

A auditoria encontrou e leu o harness `apps/worker/src/runtime-evidence.integration.test.ts`. Ele possui dois cenários explicitamente marcados como REAL quando `RUN_DB_INTEGRATION=true` e existem `DATABASE_ADMIN_URL` + `RUNTIME_DATABASE_URL`/ `DATABASE_URL`:

- replay idempotente com duas execuções do mesmo `event_id` e uma única linha de auditoria;
- negativo cross-tenant: tenant B não consegue ler, inserir, atualizar ou excluir freight de tenant A.

O teste usa uma conexão administrativa somente para fixtures/cleanup e uma conexão runtime separada para as asserções. O cenário cross-tenant executa a sessão runtime com contexto de tenant e usa sessão fresca para o INSERT negativo.

Isso aumenta a evidência **E2/E3 do controle e do harness de produção**, mas **não fecha DB-04 E4**, porque o teste não foi executado nesta sessão contra o Neon de produção e não há saída runtime atual demonstrando `current_user` + `rolbypassrls=false` na mesma execução.

Também foi confirmado que a integração Railway disponível nesta sessão continua expondo somente o projeto `tms-backup`; não há acesso observacional ao serviço `tms-worker` do projeto produtivo.

### Decisão

Não disparar workflow CI nem redeploy como atalho para produzir evidência: dependendo dos secrets/configuração, isso poderia criar ou alterar fixtures em banco. DB-04 deve permanecer fechado somente após execução controlada contra alvo explicitamente autorizado.

### Estado

- **DB-04:** BLOQUEADO / E4 PENDENTE.
- **DB-03 API:** COMPROVADO operacionalmente pelo `/ready`.
- **Worker runtime role:** PENDENTE.
- **Harness RLS:** COMPROVADO E2/E3; não confundir com produção E4.


## 16. Avanço da Fase 2 — 2026-09-25 — auditoria do contrato real de emissão do outbox

A leitura cruzada do fluxo encontrou uma distinção importante entre o contrato documentado e a API pública do repositório:

- `FreightService.updateStatus()` chama explicitamente `updateStatusWithAudit(...)`, portanto a transição HTTP normal grava a alteração e o evento `freight.status_changed` na mesma transação.
- `PostgresFreightRepository.updateStatus()` é uma API pública que delega para `updateStatusWithAudit()` **sem** argumento de auditoria.
- Em `updateStatusWithAudit()`, a emissão do evento para `outbox_events` está condicionada a `if (audit)`.
- Portanto, uma chamada direta ao método `PostgresFreightRepository.updateStatus()` pode alterar o status sem produzir o evento/outbox esperado pelo contrato operacional.
- A busca de referências confirmou que o caminho de produção do serviço usa a variante com auditoria; os testes de ciclo de assignment também usam `updateStatusWithAudit()`.

### Classificação

**WORK-02 permanece E2/E3 COMPROVADO / E4 ABERTO**, mas foi identificado um **P1 de robustez de contrato interno**: a garantia “toda mudança de status gera outbox” atualmente depende do chamador escolher a variante `WithAudit`.

Isso não prova um defeito de produção no endpoint atual. É uma fragilidade de API interna que pode permitir divergência futura se outro consumidor usar `updateStatus()` diretamente.

### Evidência complementar

O teste `freight-status-flow.integration.test.ts` começa inserindo manualmente um `outbox_events` via conexão administrativa. Assim, ele comprova a cadeia **outbox → durable job → handler → audit/telemetry**, mas não comprova sozinho que uma chamada real de `updateStatus()` cria o outbox. A prova da emissão atômica está atualmente no código do repositório + cobertura de lifecycle, não em um teste E2E que inicia pela transição de status do serviço.

### Ação recomendada

P1, sem alteração de produção nesta etapa:

1. adicionar um teste de integração que execute a transição de status pela API/repositório canônico e verifique a criação atômica do outbox;
2. decidir se `updateStatus()` deve sempre exigir os metadados de auditoria ou se deve ser removido/renomeado para impedir uso sem evento;
3. somente depois avaliar refatoração para tornar impossível, por construção, uma mudança de status sem emissão do evento.

Nenhuma mutation de produção foi executada neste avanço.


## 17. Avanço da Fase 2 — 2026-09-25 — WORK-02a refinado após auditoria de consumidores e transação

A busca de consumidores no monorepo não encontrou chamadas internas de `PostgresFreightRepository.updateStatus()`; o caminho HTTP usa `FreightService.updateStatus()`, que chama explicitamente `updateStatusWithAudit(..., audit)`. Os testes de lifecycle também usam a variante com auditoria.

A auditoria de `withTransaction()` confirmou que:
- a transação começa antes da alteração de freight;
- `app.tenant_id` é configurado dentro da transação;
- qualquer exceção executa `ROLLBACK`;
- o commit só ocorre após toda a função de trabalho terminar.

Assim, a garantia de atomicidade do caminho canônico é estruturalmente forte: se a gravação de audit/outbox falhar, a alteração de status não deve ser commitada.

### Reclassificação

O risco original de WORK-02a foi reduzido de “possível caminho de produção conhecido” para **API interna/exportada sem consumidor interno identificado**.

**Estado:** P1 de hardening/teste; não é evidência de defeito no endpoint atual.

### Lacuna que permanece

Não existe teste que injete/facilite uma falha especificamente na etapa de `outbox_events` depois do `UPDATE freights` e demonstre, em banco, que o status, audit e outbox são todos revertidos.

### Ação recomendada

Adicionar teste de integração de falha transacional, preferencialmente por uma condição de banco determinística e isolada, sem mocks que escondam o comportamento real. Também avaliar se `updateStatus()` deve ser removido/privatizado por ser uma API redundante sem consumidores internos, ou se deve passar a exigir audit obrigatório.

Nenhuma alteração funcional foi aplicada nesta etapa.


## 2026-09-25 — WORK-02a refinement: status transition contract hardened

- A revisão de referências não encontrou consumidores internos de `PostgresFreightRepository.updateStatus()`; o caminho de produção usa `updateStatusWithAudit()`.
- A API redundante `updateStatus()` foi removida e `updateStatusWithAudit()` passou a exigir `audit`, eliminando o caminho interno que poderia persistir status sem `outbox_events`.
- Foi adicionado teste de integração que força falha de persistência do audit por FK de `actor_user_id` inexistente e verifica rollback do status e ausência de `freight.status_changed` no outbox.
- Isso fortalece E2/E3 como evidência automatizada de atomicidade, mas **não fecha E4/DB-04**: ainda falta execução contra a sessão PostgreSQL de produção com `tms_app` e prova comportamental cross-tenant.
- Commits: `af75bb1a291de5ca4968d9c33caef060972fc802` (teste), `4ec2ba72cb07de80e956b608565fc43c9408cbc6` (contrato do repositório).


## 2026-09-25 — Mutations operacionais: contrato de auditoria

- Auditoria de consumidores de `CarrierRepository`, `DriverRepository` e `VehicleRepository` encontrou o uso HTTP centralizado em `OperationsService`, com audit explícito em create/update.
- Apesar disso, os três repositórios aceitavam `audit` opcional, deixando uma superfície de regressão equivalente à encontrada em `PostgresFreightRepository.updateStatus()`.
- O contrato foi endurecido: create/update de Carrier, Driver e Vehicle agora exigem `AuditInput`.
- Não foram identificados consumidores internos sem audit nas buscas realizadas.
- Commit: `6a0d5044007424c4cff8f9439f09a8799c2af41c`.
- Classificação: P2 de hardening de contrato, sem evidência de exploração atual.


## 2026-09-25 — Freight CRUD: fechamento do mesmo contrato de auditoria

- A revisão do `PostgresFreightRepository` encontrou mais duas superfícies opcionais: `createWithAudit(..., audit?)` e `updateWithAudit(..., audit?)`, além do wrapper `create()` que delegava sem audit.
- A busca de consumidores encontrou o fluxo de criação/atualização HTTP usando explicitamente `createWithAudit`/`updateWithAudit`; não foi encontrado consumidor interno legítimo do wrapper sem audit.
- O wrapper `create()` foi removido e create/update agora exigem `AuditInput`.
- `updateStatusWithAudit()` já exigia audit desde a correção anterior; com isso, as mutações de Freight expostas pelo repositório seguem contrato único de auditoria obrigatória.
- Commit: `5eeee95b142722fd49113aafdadc436143d68c97`.
- Observação: ainda é necessário CI para confirmar typecheck/testes após o endurecimento de contratos.


## 2026-09-25 — REPO-04: hardening das mutações financeiras

A revisão dos repositórios mutáveis encontrou a lacuna já registrada em REPO-04: FinanceRepository.create() e settle() alteravam financial_entries sem gerar audit_events.

### Correção aplicada

- FinanceRepository.create() agora exige AuditInput e grava finance.entry_created na mesma transação da inserção.
- FinanceRepository.settle() agora exige AuditInput, bloqueia a linha com FOR UPDATE, captura o estado anterior e grava finance.entry_settled na mesma transação da liquidação.
- FinanceService passou a propagar actorUserId, requestId e metadados de ação/entidade para ambas as mutações.
- O teste de integração financeiro foi adaptado para exercer o novo contrato.
- A limpeza dos repositórios operacionais removeu os if (audit) redundantes depois de tornar o argumento obrigatório.

### Estado

**REPO-04: correção estrutural aplicada — P1 hardening.** A trilha de auditoria das mutações financeiras fica atomicamente acoplada à mutação de negócio. A evidência E4/produção continua separada: ainda não houve execução autorizada contra a sessão produtiva tms_app.

### Commits

- 434e9e712877f4834ca92ec46390e3841087b938 — contrato e persistência de audit no FinanceRepository.
- fce228fc721c8feb3a5ed8425b720512ca4a6583 — propagação do contexto de auditoria no FinanceService.
- 51c2f699d401a43747f81c9ea434bb7a64d93289 / e2f5d4852c190c837d50cf582f7905f048c9567e — atualização do teste de integração financeiro.
- 83bf0147569247c37fc08ba483d6381b596e4970 — limpeza dos guards redundantes de audit em Carrier/Driver/Vehicle.

Nenhuma mutation de produção foi executada nesta etapa.


## 2026-09-25 — Varredura de repositories mutáveis: fechamento do inventário

A revisão dos repositories de Assignment, Trip, Trip Execution e Compliance não encontrou novos caminhos de mutação sem auditoria obrigatória. As operações de criação/transição desses domínios já recebem AuditInput e chamam appendAuditEvent dentro da mesma transação.

Também foi revisado o estado atual de Freight e Operations após os hardenings anteriores: create/update/status/delete de Freight e create/update de Carrier/Driver/Vehicle exigem auditoria.

### Novo teste de atomicidade financeira

Foi acrescentado teste de integração que usa actor_user_id inválido para forçar falha na persistência de audit_events e confirma que a criação de financial_entries é revertida.

**Commit:** 1f7c2e53ffcd0e73cc4a00759e06f276e9c70a29.

### Estado do inventário

**REPO-01/02/03:** sem novo gap estrutural identificado nesta passada.

**REPO-04:** correção aplicada; agora possui também prova automatizada de rollback quando a auditoria falha.

**REPO-07:** inventário de SQL de negócio em packages/database está substancialmente fechado para os repositories auditados. Permanecem como fronteiras legítimas a revisar separadamente: outbox/durable-jobs, stores/contexto do worker, diagnósticos RLS, replay e scripts de migration.

Nenhuma mutation de produção foi executada.


## 16. Continuação — fronteiras Outbox/Durable Jobs e baseline

- **REPO-09 — Worker Outbox store é uma implementação SQL paralela ao OutboxRepository:** `apps/worker/src/outbox-store.ts` implementa `claimPending`, `renewLease`, `markPublished` e `markFailed` diretamente sobre `outbox_events`, enquanto `packages/database/src/outbox-repository.ts` expõe contrato equivalente. A implementação do worker usa transações e `app.tenant_id`, `FOR UPDATE SKIP LOCKED` e lease token; não foi identificado, nesta leitura, um bypass de tenant. **Estado: DUPLICAÇÃO CONTROLADA / P2**, com risco de divergência futura de semântica e validações. Próxima ação: decidir explicitamente se o worker deve consumir o repository compartilhado ou se `PgOutboxStore` deve permanecer como adapter especializado, com contrato/testes comuns.
- **REPO-10 — Durable Jobs permanece coerente entre package e worker:** `PgDurableJobStore` usa `withTenantTransaction`, valida tenant ativo, `FOR UPDATE SKIP LOCKED`, lease token e estado/attempts; o repository compartilhado mantém a mesma fronteira transacional. **Estado: COMPROVADO NO CÓDIGO / sem nova lacuna P1.**
- **DB-06 — Baseline validator permanece P1:** a inspeção confirmou que `migrate.ts` ainda não declara as colunas de auditoria de 0032 nem `durable_jobs.idempotency_key` de 0033 e ainda não verifica diretamente as constraints compostas de 0030/0031 nem o índice `durable_jobs_idempotency_idx`. **Estado: ABERTO / P1.** Nenhuma alteração de schema foi executada; a correção deve ser feita no validator e validada em CI antes de fechar o achado.
- **DB-07 — SQL de infraestrutura fora de `packages/database` é restrito às fronteiras identificadas:** worker stores/contexto, replay do Freight e migration validator continuam sendo os principais pontos. Os stores do worker são infraestrutura deliberada; o replay continua sendo regra de negócio que merece revisão posterior de centralização, mas sua transação tenant-scoped e auditoria já estão comprovadas. **Estado: INVENTÁRIO SUBSTANCIALMENTE FECHADO / P1 residual em REPO-07.**

### Estado após esta etapa

A auditoria avançou da superfície de repositories de negócio para as fronteiras de persistência operacional. Não foi identificado novo P0 nesta etapa. O principal achado acionável é DB-06 (P1), seguido pela decisão arquitetural P2 sobre duplicação do Outbox store. O gate **DB-04/E4 continua BLOCKER**, pois a inspeção de código não substitui a execução real do teste sob `tms_app` contra o banco alvo.


## 17. Correção DB-06 implementada

- `packages/database/scripts/migrate.ts` passou a exigir `durable_jobs.idempotency_key` e os metadados de auditoria de 0032.
- O baseline existente agora verifica as quatro FKs tenant-scoped de 0030/0031 e o índice `durable_jobs_idempotency_idx`, além do índice Auth0 já validado.
- **DB-06: CORRIGIDO NO CÓDIGO / validação operacional ainda pendente.** O fechamento definitivo depende de executar o validator em CI/ambiente controlado e registrar o resultado.


## 18. Auditoria das Actions canceladas — 2026-09-25

- **CI-09 / run 36076682893:** cancelado no SHA `50314de...`. O próprio tracker já registra que foi uma execução histórica e que não constitui evidência de falha funcional. **Não refazer esse run isoladamente**, porque o SHA já não representa o estado corrigido atual.
- **CI-01 / run 36080140034 (#1135):** cancelado no SHA `c4fcb3ba...`. O cancelamento não deve ser interpretado como falha de código. Houve execução posterior no SHA `2eb43e87...`, run `36081162875` (#1139), com `success`, cobrindo o pipeline de controle. **Não é necessário reexecutar o run cancelado antigo.**
- A configuração atual do CI usa `concurrency` com `cancel-in-progress: true`. Portanto, cancelamentos podem ser deliberadamente causados pela chegada de uma execução mais nova no mesmo grupo, e não significam regressão.
- Os commits de correção mais recentes (`464dd2dd...`, `9b88ab19...`, `72c8ae72...`) não possuem workflow run retornado pelo wrapper de runs, que filtra execuções disparadas por pull request. Por isso, isso **não prova ausência de execução em GitHub**; a evidência disponível mais forte para esses SHAs é o combined status.
- Combined status dos commits de correção mostra Railway worker/backup-worker como `success`, enquanto Vercel API/Web aparece `failure` por **build-rate-limit**. Esses failures são limitação de infraestrutura de build, não evidência de teste funcional falhando. **Não refazer indiscriminadamente:** o retry útil é uma nova execução/promoção quando o rate limit estiver liberado, preferencialmente sobre o HEAD final após as correções.

### Decisão

**Nenhuma Action cancelada identificada precisa ser reexecutada no SHA antigo.** O que precisa ser feito é uma nova validação do HEAD final, porque DB-06 foi alterado depois das execuções verdes históricas. Essa validação deve ocorrer quando a fila/rate-limit do Vercel permitir e deve ser registrada como nova evidência, não como reaproveitamento de run cancelado.


## 2026-09-25 — Continuação: reconciliação documental e semântica de replay

- **DOC-01 — SSOT desatualizado sobre o head de migração:** `docs/SSOT-OPERATIONS.md` ainda afirmava que production/main permanecia em 31 migrations, enquanto a evidência read-only posterior já reconciliou `0001`–`0033` e os checksums de 0032/0033. **Estado: CORRIGIDO DOCUMENTALMENTE.**
- **API-16 / SEC-03 — idempotência de replay precisa ser distinguida em dois níveis:** o teste REAL existente comprova idempotência do handler para o mesmo `event_id`, mas o endpoint de replay gera deliberadamente uma nova `idempotency_key` por solicitação. Assim, duas solicitações explícitas de replay do mesmo evento podem enfileirar jobs distintos. **Estado: P1 / CONTROLE A DECIDIR.** Antes de alterar comportamento, definir se replay manual deve ser deduplicado por `event_id`/tenant/job_type ou se cada solicitação explícita deve permanecer como nova execução controlada; então cobrir a decisão com teste de integração e controles operacionais adequados.
- **E4 permanece bloqueado:** nenhuma dessas correções documentais substitui a prova comportamental real sob `tms_app` no Neon alvo.


## 2026-09-25 — Limpeza/reconciliação de GitHub Actions e governança

### Resultado da inspeção

- O diretório `.github/workflows/` atualmente contém exatamente três workflows versionados: `ci.yml`, `database-migrate.yml` e `database-migrate-nonprod.yml`.
- `ci.yml` permanece necessário: executa em push/PR para `main`, valida arquitetura, migrations, RLS/IAM, Durable Jobs, fluxo freight-status, evidência de runtime, formatação, lint, typecheck, testes e build.
- `database-migrate.yml` permanece necessário: é o caminho automático de migration de produção, limitado por paths de migration/configuração de banco e com environment `production`.
- `database-migrate-nonprod.yml` permanece necessário: é o caminho manual e explícito para `development` ou `staging`; não há sobreposição operacional que justifique removê-lo.
- Não foi identificado workflow órfão/redundante que possa ser removido com segurança nesta passada. Portanto, **nenhum arquivo de workflow foi apagado**.

### Histórico de Actions

A limpeza do histórico de runs não pode ser executada pela integração GitHub disponível: ela permite inspeção e reexecução, mas não expõe operação de exclusão de workflow run. Os runs cancelados históricos continuam preservados como evidência; não foram reexecutados artificialmente.

### Governança de main

A leitura de branch protection via API retornou `403 Resource not accessible by integration`; a consulta de rulesets retornou lista vazia. Isso não é evidência suficiente para declarar branch protection configurada. O finding **CI-10 — GOVERNANÇA DE MAIN / P1** permanece aberto até uma verificação administrativa autorizada confirmar required status checks/regras de proteção.

### Reconciliação de HEAD

O HEAD atual de `main` observado diretamente no GitHub é `b16faf77181882c4f796fd9d067fa4f62891992e` (`docs(audit): correct current migration head in SSOT`). Documentos anteriores que ainda exibem SHAs históricos devem ser interpretados como snapshots datados; o HEAD atual passa a ser a referência de controle deste ciclo.

### Próxima frente

1. Obter verificação administrativa de branch protection/required checks.
2. Validar DB-06 em CI/ambiente controlado.
3. Resolver API-16/SEC-03 (semântica e permissão de replay).
4. Retomar DB-04/E4 com sessão runtime real `tms_app`.



## 2026-09-25 — API-02/SEC-03: permissão dedicada de replay

A auditoria estrutural confirmou que o replay manual de `freight.status_changed` era uma mutação de produção protegida apenas por `freight:update`. Isso permitia que um usuário com capacidade genérica de atualização também alcançasse a operação de replay.

Correção aplicada no HEAD atual:
- criada a migration `0034_freight_replay_permission.sql`;
- criada a permissão `freight:replay`;
- a migration não concede essa permissão ao papel `operator` por padrão; o papel `admin` continua herdando as permissões canônicas por seu bootstrap;
- o endpoint `POST /freights/:id/status-events/:eventId/replay` passou a exigir `freight:replay`.

**Estado API-02/SEC-03:** CORREÇÃO DE CÓDIGO APLICADA / E4 PENDENTE.

A correção reduz o privilégio efetivo, mas ainda exige teste negativo/positivo com identidades reais ou harness de autorização: operador sem `freight:replay` deve receber 403; papel explicitamente autorizado deve conseguir executar replay; isolamento tenant e auditoria devem permanecer preservados.

**API-03 permanece separado:** a semântica de repetição do replay continua deliberadamente não decidida. A chave atual usa UUID por solicitação, portanto duas chamadas explícitas continuam sendo duas intenções de replay.

**CI:** a correção deve ser validada em novo run do HEAD atual; os status Vercel observados anteriormente por `build-rate-limit` não são evidência de falha funcional.


## 2026-09-25 — API-11/API-06: isolamento da superfície de diagnóstico

A revisão do controller confirmou que os quatro endpoints de diagnóstico (`runtime-context`, `runtime-db-context`, `runtime-rls-isolation`, `runtime-auth-claims`) estavam compartilhando `freight:read`, misturando leitura funcional com observabilidade operacional.

Correção aplicada:
- criada a permissão dedicada `ops:diagnostics` em `0035_diagnostics_permission_and_admin_replay.sql`;
- os quatro endpoints passaram a exigir `ops:diagnostics`;
- `operator` não recebe essa permissão no bootstrap operacional;
- a mesma migration concede explicitamente `ops:diagnostics` e `freight:replay` aos papéis tenant `admin`, corrigindo também a dependência implícita detectada na migration 0034 (novas permissões não são herdadas retroativamente pelo admin).
- o teste IAM foi ampliado para provar que `operator` não possui `freight:replay` nem `ops:diagnostics`.

**Estado:** CORREÇÃO DE CÓDIGO APLICADA / E4 PENDENTE.

A exposição de diagnóstico fica separada da autorização de negócio. Continua necessária validação HTTP real: operador sem `ops:diagnostics` → 403; administrador autorizado → 200; tenant e contexto OIDC continuam limitados ao próprio contexto.

A revisão também reconciliou `docs/DATABASE.md` para as migrations 0001–0035, eliminando a referência obsoleta a 31 migrations.


## 2026-09-25 — Continuação: matriz de autorização e reconciliação do HEAD

**Estado:** P1 — hardening estrutural confirmado no HEAD `d304b2cdfacc6d78282648b1d5bd1243811a7b78`; evidência E4 ainda pendente.

### Verificações realizadas

- O `FreightController` atual exige `freight:replay` para replay e `ops:diagnostics` para os quatro endpoints de diagnóstico.
- `AuthGuard` continua validando Bearer token, issuer, audience, JWKS, claim de tenant, compatibilidade de `x-tenant-id` e membership ativa antes de construir o contexto.
- O CI continua configurado para executar RLS/IAM runtime em banco efêmero com `tms_app` sem bypass de RLS.
- O CI não substitui a prova de produção: permanecem separados DB-04/E4, token Auth0 real e runtime efetivo do worker.

### Nova evidência de infraestrutura

No HEAD atual, os status observados são:
- `tms-backup - tms-worker`: SUCCESS;
- `tms-backup - tms-backup-worker`: SUCCESS;
- `Vercel – tms-core-api`: FAILURE por `build-rate-limit`;
- `Vercel – tms-web`: FAILURE por `build-rate-limit`.

Os failures de Vercel são tratados como bloqueio de infraestrutura de build enquanto o contexto permanecer explicitamente `build-rate-limit`; não foram interpretados como defeito funcional.

### Próxima ação P0

Executar, sem alterar RLS/grants para fabricar evidência, a sessão controlada com o papel runtime real `tms_app`:
1. `current_user='tms_app'`;
2. `rolbypassrls=false`;
3. SELECT do próprio tenant;
4. SELECT cross-tenant sem vazamento;
5. INSERT cross-tenant rejeitado;
6. UPDATE cross-tenant rejeitado.

A ferramenta Neon disponível continua sem conseguir executar SQL devido ao mismatch do parâmetro `project_id`; portanto DB-04 permanece BLOCKER.

## 19. Reconciliação corrente — 2026-09-25

- **HEAD de main corrigido:** o tracker registra o último HEAD de main verificado antes desta atualização (`7cdf6b769624f9fed24446dc6ebe47ede4b1a827`) e distingue-o do último HEAD funcional explicitamente auditado `d304b2cdfacc6d78282648b1d5bd1243811a7b78`.
- **Frontend Auth0 — finding histórico reconciliado:** o ledger histórico `EVIDENCE-LEDGER-2026-09-16.md` contém o EV-030 dizendo que o Web não possuía Auth0. Essa afirmação não deve ser usada como estado corrente. No código atual existem `@auth0/nextjs-auth0` em `apps/web/package.json`, `apps/web/src/lib/auth0.ts` e `apps/web/src/app/api/tms/auth-runtime/route.ts`, que usa `createFetcher`/token autenticado para chamar a API. Isso comprova implementação estrutural, mas **não** prova E4 Auth0 em produção.
- **DB-04 permanece P0/BLOCKER:** a role `tms_app` e seu atributo `NOBYPASSRLS` foram observados, mas ainda falta a sessão real com os seis testes comportamentais de isolamento.
- **CI/Vercel:** o status atual conhecido continua com Railway worker/backup-worker em SUCCESS e Vercel API/Web em `build-rate-limit`; portanto não declarar build funcional de Vercel do HEAD atual.
- **Regra para o próximo ciclo:** não reabrir EV-030 como finding de ausência de implementação; tratá-lo como evidência histórica datada e executar E4 Web → Auth0 → API → DB quando houver token/ambiente operacional disponível.

## 2026-09-26 — API-04: suíte dedicada de replay adicionada e CI verde

- Adicionado `apps/api/test/freight-replay.service.test.ts` cobrindo:
  - replay válido com criação de `durable_jobs` + `audit_events` na mesma transação;
  - rejeição de evento cujo `aggregate_id` não corresponde ao freight solicitado;
  - rejeição de payload com identificadores inconsistentes;
  - semântica atual de chamadas repetidas, comprovando que cada replay manual recebe uma chave distinta.
- CI do novo HEAD `478e2a3e9247a331dc9a31ee172a06f7366daa6d`, run #1247 / `36216015744`, terminou `success`.
- No mesmo run passaram migration, RLS, IAM, integrações do worker, format, lint, typecheck, test e build.
- **API-04:** avançou de ABERTO para **TESTES DIRECIONADOS IMPLEMENTADOS / CI COMPROVADO**. A prova HTTP E4 de 403/200 e isolamento tenant permanece pendente.
- **API-03:** a suíte formaliza a semântica atualmente implementada: replay manual repetido é deliberadamente distinto por solicitação; permanece necessária a decisão operacional/documental sobre controles adicionais (motivo, rate/approval quando aplicável).
- **CI-01:** a evidência anterior foi atualizada: o run #1247 é a execução verde relevante para este avanço funcional.


## 2026-09-26 — API-06: matriz estrutural de permissões protegida por teste

- Adicionado `apps/api/test/freight.controller.authorization.test.ts`.
- O teste verifica que todas as rotas protegidas do `FreightController` possuem metadata explícita de permissão.
- Os quatro endpoints de diagnóstico exigem `ops:diagnostics` e não `freight:read`.
- O endpoint de replay exige `freight:replay`.
- CI do SHA `5f5289d4cc263c6a08ab5ae41b65eb0412ac33f7`, run #1250 / `36216153527`, concluiu `success`, incluindo migration, RLS, IAM, integrações do worker, format, lint, typecheck, test e build.
- **API-06:** cobertura estrutural agora está protegida contra regressão; E4 HTTP 403/200 e tenant-context continuam pendentes.
- **API-02:** permissão dedicada de replay permanece protegida contra regressão estrutural; E4 continua pendente.

## 2026-09-26 — Reconciliação de CI e release observada

- CI run #1251 (36216294963) no HEAD d00355d81ccd56edf628baf9e114cbe51790f608 terminou success em 2026-09-26 03:57Z. Isso valida o pipeline técnico no HEAD de controle/documentação atual; não substitui E4 de produção.
- Vercel produção observado: tms-core-api permanece READY no deployment dpl_43rvFqPsZjWdhmb3gnEUsxqa9gHG, SHA 695ba3fbb42f1917c84336711ccb6800a29a0a85; tms-web permanece READY no deployment dpl_6WGRWWauR87GozJSwJ1UhkaJgzmS, SHA e2137446b3da21e6cb557b9a5203e2c75bac7c81. Os SHAs diferem do HEAD de controle por promoção seletiva; não há evidência de defeito apenas pela divergência.
- Railway tms-worker: deployment do HEAD d00355d... foi SKIPPED; o último SUCCESS observado permanece ab2142c4-67b9-4143-9531-3f55f1a19739, SHA c4808ec58eba65b564d97fdb015cd3c599720860. Isso é compatível com a política de watch seletivo e não justifica forçar deploy.
- Railway tms-backup-worker: deployment 073113c2-8ac0-4846-9dba-7bf184756fad está SUCCESS no HEAD d00355d.... Isso comprova deploy, não a existência/retensão do artefato de backup.
- O manifesto versionado de release foi reintroduzido/atualizado em docs/releases/2026-09-26.json para registrar o estado observado acima, inclusive divergência de SHA e migration head 0035 como head do repositório, não como prova independente do Neon live.

P0: REL-01 passa a ter manifesto versionado; DB-01 e DB-04 continuam bloqueados até evidência read-only/runtime do Neon. P1: WORK-01 fica reconciliado quanto ao SHA efetivo, sem deploy artificial. E4 continua separado de CI/deploy.


## 49. FASE 2 — 2026-09-26 — reconciliação final das evidências desta sequência

### 49.1 Correção de estado documental

As seções históricas deste tracker devem ser lidas pela data da evidência. Em particular, a seção 48 registrava um estado anterior em que replay ainda usava `freight:update` e os diagnósticos usavam `freight:read`. Esse estado foi posteriormente corrigido e não representa o estado corrente.

Estado corrente comprovado pelo código e pelos testes mais recentes:

- **API-02 / SEC-03:** replay usa a permissão dedicada `freight:replay`, criada na migration 0034 e concedida explicitamente ao administrador na 0035; CI estrutural está verde.
- **API-06 / API-11:** endpoints de diagnóstico usam `ops:diagnostics`; operador não recebe essa permissão por padrão e admin recebe explicitamente; CI estrutural está verde.
- **API-04:** suíte dedicada de replay foi adicionada e passou no CI #1247 / run `36216015744`.
- **API-06/API-02:** suíte de autorização do FreightController foi adicionada e passou no CI #1250 / run `36216153527`.
- **REL-01:** manifesto de release foi registrado em `docs/releases/2026-09-26.json`; promoção seletiva por componente está documentada.
- **CI-01:** CI #1251 / run `36216294963` passou no SHA de controle `d00355d81ccd56edf628baf9e114cbe51790f608`.

### 49.2 P0 atual

| ID | Estado | Próxima evidência |
|---|---|---|
| DB-01 | **FECHADO / COMPROVADO** | Nenhuma ação adicional; preservar head 0033 + checksums live |
| DB-04 | **BLOQUEADO / E4 PENDENTE** | Sessão real `tms_app`, `rolbypassrls=false`, teste próprio/cross-tenant de leitura e escrita controlada |
| AUTH-01 | **ABERTO / E4 PENDENTE** | Token Auth0 real → Web → API → DB, com tenant/membership reais |
| SEC-01 | **BLOQUEADO** | DB-04 + AUTH-01 |
| REL-01 | **ESTRUTURALMENTE REGISTRADO / RECONCILIAÇÃO OPERACIONAL PENDENTE** | Head de migration já fechado; preservar SHAs efetivos por componente e confirmar que o manifesto corresponde ao runtime atual |

### 49.3 P1 atual

- **WORK-01:** worker principal continua em SHA anterior por promoção seletiva; o último deployment do HEAD atual foi SKIPPED. Não forçar deploy apenas para alinhar SHAs.
- **WORK-02/03:** contrato de outbox → durable jobs → handler está comprovado em CI; E4 do runtime produtivo continua pendente.
- **BAK-01 / DR-01:** deploy SUCCESS não prova artefato, checksum, retenção ou restore independente.
- **CI-10:** branch protection/required checks continua sem confirmação administrativa suficiente.
- **API-03:** semântica de replay repetível permanece documentada; não alterar novamente sem decisão operacional explícita.
- **DOC-03 / CONFIG-01:** drift documental e centralização efetiva de configuração permanecem P1/P2 conforme classificação existente.

### 49.4 Gate preservado

A sequência operacional continua:

**DB-04 → AUTH-01 → SEC-01 → REL-01 → WORK/BAK/DR P1 → P2 de refatoração.**

Nenhuma alteração de RLS, grants, credencial, Auth0, migration de produção ou dado foi executada nesta sequência.


## 50. FASE 2 — 2026-09-26 — DB-04: autorização explícita para execução da prova comportamental

O operador **autorizou explicitamente nesta sequência** a execução da prova controlada de DB-04, incluindo os testes comportamentais necessários, desde que sejam usados apenas dados controlados e que nenhuma alteração permanente seja deixada no banco.

### Observação obrigatória

A autorização **não** permite fabricar evidência alterando RLS, grants, roles ou configuração de produção. A prova deve usar o caminho real de conexão de `tms_app` e preservar o estado do banco.

Critérios de fechamento continuam sendo:

1. sessão efetiva com `current_user = tms_app`;
2. `rolbypassrls = false`;
3. tenant A acessa seus próprios registros;
4. tenant A não observa registros de tenant B;
5. tentativa controlada de INSERT cross-tenant é rejeitada;
6. tentativa controlada de UPDATE cross-tenant é rejeitada;
7. qualquer mutação de teste deve terminar sem alteração persistente;
8. nenhum segredo/credencial deve ser registrado na documentação.

### Evidência live já disponível

A verificação read-only de 2026-09-26 já confirmou estruturalmente:

- `tms_app` com `rolsuper=false`, `rolbypassrls=false`, `rolcanlogin=true`;
- RLS habilitado e forçado nas 19 tabelas tenant-scoped inspecionadas;
- policies tenant-scoped vinculadas a `current_setting('app.tenant_id', true)`.

Isso **não fecha DB-04** porque ainda falta a sessão comportamental real. Uma tentativa de `SET ROLE tms_app` via conector Neon foi rejeitada por PostgreSQL.

### Próxima execução

Priorizar a obtenção de uma sessão autenticada diretamente como `tms_app` pelo caminho de runtime existente, sem reutilizar `neondb_owner` como substituto. Se o ambiente conectado não expuser esse caminho autenticado, registrar o bloqueio e avançar apenas para o próximo finding que possa ser comprovado sem inferência.

**Estado: DB-04 = BLOQUEADO / E4 PENDENTE, com execução explicitamente autorizada pelo operador.**


## 51. FASE 2 — 2026-09-26 — DB-04: observação sobre a evidência automatizada atual

### Observação

A execução do CI no HEAD atual 47825210d6415ee5d3f00c8e1e7c40e48450cf05 (run #1259 / 36240857560) terminou **success**. O workflow atual executa a suíte rls-runtime.integration.test.ts com um tms_app criado/provisionado para CI e um RUNTIME_DATABASE_URL restrito, cobrindo comportamento de SELECT cross-tenant, INSERT cross-tenant, UPDATE cross-tenant, DELETE cross-tenant e vazamento de contexto entre conexões do pool.

Isso fortalece a evidência de que o contrato comportamental de RLS está implementado e protegido por CI com papel não-bypass. **Não equivale, por si só, ao E4 do Neon de produção**, porque o teste executado é contra o PostgreSQL efêmero do runner. Portanto, DB-04 permanece **BLOQUEADO / E4 PENDENTE** até existir uma sessão real de produção como tms_app para a matriz definida na seção 50.

A execução cancelada do commit anterior (#1258 / 36240846312) não é tratada como falha funcional: houve um novo push e o CI do HEAD seguinte (#1259) concluiu com sucesso.

### Próximo passo operacional

Manter a prova de CI como evidência automatizada complementar e continuar a busca do caminho autenticado de produção tms_app, sem reutilizar neondb_owner e sem alterar RLS/grants/roles/configuração para fabricar evidência.

**Estado: DB-04 = BLOQUEADO / E4 PENDENTE.**


## 52. FASE 2 — 2026-09-26 — Webhook endpoint contract reconciliado

### Evidência

A revisão cruzada de `docs/PROJECT-DOCUMENTATION.md`, `docs/architecture/STAGE-10.5-WEBHOOKS.md` e do código do worker confirmou que o repositório **não define atualmente um receiver HTTP externo de webhook** como parte de uma integração de negócio implementada.

O worker apenas lê `OUTBOX_WEBHOOK_URLS`, valida os destinos e publica o evento para os endpoints configurados. O contrato de código exige HTTPS e, quando existe pelo menos um endpoint configurado, também exige `OUTBOX_WEBHOOK_SECRET` não vazio. O repositório não contém uma rota TMS/API que funcione como receiver desses POSTs.

### Decisão

- `OUTBOX_WEBHOOK_URLS`: **OPCIONAL / NÃO CONFIGURADO por padrão** quando não houver consumidor externo contratado.
- Não usar `/health` ou `/ready` como receiver; são endpoints de saúde/readiness e não fazem parte do contrato de webhook.
- Não inventar uma URL de produção para preencher a variável.
- `OUTBOX_WEBHOOK_SECRET`: **CONDICIONALMENTE OBRIGATÓRIO**; se `OUTBOX_WEBHOOK_URLS` possuir qualquer endpoint, o código exige um segredo não vazio e assina o payload com HMAC-SHA256.
- Se uma integração externa for ativada no futuro, registrar explicitamente o receiver, ownership, contrato de payload, idempotência, timeout/retry e segredo antes de configurar Railway.

### Correção documental

A documentação de Stage 10.5 foi corrigida para refletir o comportamento efetivo do código: o secret não é simplesmente “optional”; ele é obrigatório sempre que houver endpoint configurado.

**Estado:** ENV-03 / WORK-04 — **RECONCILIADO DOCUMENTALMENTE; sem alteração de produção**.


## 53. FASE 2 — 2026-09-26 — DB-04: caminho de sessão `tms_app` identificado, E4 ainda não executável nesta integração

### Avanço

O projeto Neon canônico foi resolvido como `tms / shiny-hall-34679912`, com branch de produção `main / br-lingering-shadow-act0vvi9` e database `neondb`.

Foi obtida, por capacidade autorizada do Neon, a connection string do papel `tms_app`. Isso confirma que a credencial de runtime existe e identifica o caminho de conexão correto.

### Limite técnico atual

A ferramenta Neon disponível para execução SQL consegue executar a consulta no alvo quando usa a conexão da integração, mas essa execução está vinculada à sessão `neondb_owner`. Ela não oferece um parâmetro para escolher o papel da sessão no `run_sql`.

A connection string de `tms_app` foi identificada, mas o ambiente de execução disponível nesta sessão não possui um cliente PostgreSQL utilizável para abrir essa conexão diretamente. Portanto, **não foi fabricada uma sessão tms_app por `SET ROLE` nem reutilizado `neondb_owner` como substituto**.

### Estado

**DB-04 = BLOQUEADO / E4 PENDENTE.**

O bloqueio agora está mais precisamente delimitado: não é mais falta de identificação do projeto/branch nem ausência conhecida da credencial `tms_app`; é falta de um caminho de execução SQL que abra uma sessão real autenticada como `tms_app`.

### Próxima ação

Obter uma sessão direta como `tms_app` pelo runtime real (worker/API ou cliente PostgreSQL operacional autorizado) e executar a matriz da seção 50. Nenhuma alteração de RLS, grants, role ou configuração deve ser feita para contornar este bloqueio.


## 54. FASE 2 — 2026-09-26 — Worker production: caminho real `tms_app` confirmado no código e contrato de serviço

### Evidência operacional

A configuração do serviço Railway de produção `tms-worker` usa o repositório `alexoaraujo83/TMS`, branch `main`, e inicia `node apps/worker/dist/main.js`. O contrato de variáveis efetivamente declarado no serviço inclui `DATABASE_URL`, `OUTBOX_TENANT_IDS`, `DURABLE_JOBS_ENABLED` e os parâmetros de polling/batch/timeout; não há `OUTBOX_WEBHOOK_URLS` nem `OUTBOX_WEBHOOK_SECRET` configurados no serviço.

No código do worker, a inicialização cria o `pg.Pool` a partir de `DATABASE_URL` e executa imediatamente `select current_user`. Se o resultado não for exatamente `tms_app`, o processo falha com `DATABASE_RUNTIME_ROLE_INVALID`. Quando a verificação passa, o worker registra o evento operacional `database.runtime_role_verified` com o papel `tms_app`.

### Interpretação

Isso fecha o **caminho de runtime previsto para DB-04**: o worker não aceita silenciosamente uma role privilegiada diferente. A configuração de produção também permanece coerente com a decisão anterior de não configurar webhook sem receiver externo.

### Limite E4

Ainda não foi obtido nesta integração um log histórico que mostre o evento `database.runtime_role_verified` do deployment produtivo, e não foi aberta uma sessão SQL interativa diretamente como `tms_app`. Portanto, **DB-04 continua BLOQUEADO / E4 PENDENTE**.

A evidência nova reduz o bloqueio: o caminho de runtime e a proteção contra uso de role incorreta estão comprovados no código/configuração; falta a execução observável da matriz cross-tenant na sessão real.

### Próxima ação

Priorizar uma execução controlada no próprio caminho do worker que capture, sem segredos, `current_user`, `rolbypassrls` e os resultados de SELECT/INSERT/UPDATE cross-tenant, com rollback integral. Não alterar RLS/grants/roles para viabilizar o teste.


## 55. FASE 2 — 2026-09-26 — DB-04: evidência E4 operacional não executável pelo conector; runbook criado

### 55.1 Limitação operacional confirmada

O conjunto de ferramentas disponível permite executar SQL no Neon, mas o executor exposto não permite escolher a role da sessão. A conexão efetiva usada pelo executor continua sendo a privilegiada, portanto ela não pode ser usada para provar o comportamento de `tms_app`.

Também não existe, no conector Railway disponível, um comando remoto de shell/execução de SQL que permita abrir diretamente a sessão real do worker.

Conclusão mantida:

**DB-04 = BLOQUEADO / E4 PENDENTE.**

### 55.2 Artefato operacional criado

Foi criado:

`docs/audit/DB-04-E4-RUNBOOK.md`

O runbook descreve passo a passo a execução com a sessão real `tms_app`, sem expor credenciais, cobrindo:

1. `current_user = tms_app`;
2. `rolbypassrls = false`;
3. SELECT do próprio tenant;
4. SELECT cross-tenant sem vazamento;
5. INSERT cross-tenant rejeitado;
6. UPDATE sobre linha de outro tenant sem alteração;
7. UPDATE de reatribuição A→B rejeitado por `WITH CHECK`;
8. `ROLLBACK`;
9. confirmação de nenhuma persistência;
10. confirmação de que `SET LOCAL app.tenant_id` não vaza após a transação.

### 55.3 Regressão automatizada existente

A auditoria confirmou que `packages/database/test/security.integration.test.ts` já possui uma suíte específica de isolamento multi-tenant usando:

- `DATABASE_ADMIN_URL` apenas para fixtures/limpeza;
- `DATABASE_URL` para todas as asserções via role de runtime;
- RLS `FORCE`;
- SELECT cross-tenant;
- INSERT com `WITH CHECK`;
- UPDATE de `tenant_id`;
- ausência de contexto;
- escopo transacional de `app.tenant_id`.

Essa suíte é evidência de regressão automatizada, mas não substitui a prova E4 da sessão real de produção.

### 55.4 Próximo passo

Executar o runbook em um terminal/cliente PostgreSQL que consiga abrir a sessão efetiva `tms_app`. Registrar somente os resultados não sensíveis no tracker.

Não registrar senha, connection string completa, JWT, cookie ou token.

Somente após os oito critérios mínimos do runbook serem observados o DB-04 deve ser fechado e a sequência avançada para **AUTH-01**.


## 56. FASE 2 — 2026-09-26 — AUTH-01: incidente Production `missing_tenant_id` e contrato Auth0 reconciliado

### Evidência de código

O incidente observado no Web Production foi:

`/auth/callback?error=access_denied&error_description=missing_tenant_id`

A auditoria do HEAD confirmou que `infra/auth0/actions/post-login.js` atualmente **não chama** `api.access.deny()`. Quando `event.user.app_metadata.tenant_id` está ausente, o Action simplesmente não emite o claim. O claim emitido quando presente é `https://tms-platform.io/claims/tenant_id`.

A auditoria também confirmou que `apps/api/src/common/auth.guard.ts` exige o claim, valida `sub + tenant_id` contra membership ativo e não usa o header de tenant como autoridade independente.

### Conclusão

O `access_denied / missing_tenant_id` observado **não é explicado pelo Action atualmente versionado**. O finding correto é **drift/configuração efetiva do Auth0 Production**, com necessidade de identificar a Action/versão/flow que está efetivamente executando.

### Correção preparada

Foi criada a branch:

`fix/auth0-production-tenant-contract-2026-09-26`

e o artefato:

`docs/audit/AUTH0-PRODUCTION-CONTRACT-2026-09-26.md`

O contrato exige reconciliação de:

1. Actions efetivamente anexadas ao Post-Login;
2. versão publicada de `TMS — Tenant Claim`;
3. qualquer `api.access.deny`/ `missing_tenant_id` no flow efetivo;
4. application/client Production;
5. audience `urn:tms:api:production`;
6. `app_metadata.tenant_id` do usuário de teste;
7. membership ativa `sub + tenant_id` no TMS;
8. novo login e validação Web → Auth0 → API → DB.

### Regra de segurança preservada

Não alterar o AuthGuard para aceitar ausência de tenant, não confiar em tenant fornecido pelo browser e não desabilitar RLS. O tenant continua derivado do claim autenticado e reconfirmado pelo membership PostgreSQL.

**AUTH-01 = P0 / BLOQUEADO ATÉ RECONCILIAÇÃO DO AUTH0 PRODUCTION.**

Nenhuma alteração foi aplicada ao Auth0 Production nesta etapa.


## 57. FASE 2 — 2026-09-26 — AUTH-01: auditoria estrutural do contrato de deploy Auth0 concluída

### 57.1 Estado versionado encontrado

A infraestrutura Auth0 do repositório está concentrada em `infra/auth0/`:

- `actions/post-login.js` contém somente o comportamento de emissão do claim namespaced a partir de `event.user.app_metadata.tenant_id`;
- `tenant.yaml` declara a Action `TMS — Tenant Claim` como `deployed: true`, `status: built`, trigger `post-login/v3` e binding no `triggers.post-login`;
- `README.md` documenta o uso do Auth0 Deploy CLI com dry-run antes de aplicar.

**Importante:** os campos `deployed: true` e `status: built` em `tenant.yaml` são o estado desejado versionado; não constituem prova de que o tenant Production atualmente possui aquela versão publicada ou aquele binding.

### 57.2 Auditoria de CI/CD

A busca estrutural no repositório não encontrou workflow GitHub Actions que execute automaticamente o `auth0-deploy-cli import` nem pipeline versionado que reconcilie o tenant Auth0 Production.

Consequentemente, o caminho atual é **manual/documentado**, não um deployment Auth0 automatizado e comprovável pelo CI.

Isso explica por que o repositório consegue manter um contrato correto sem garantir, sozinho, que Production esteja no mesmo estado.

### 57.3 Relevância para o incidente

A documentação oficial do Auth0 confirma que uma Action pode estar marcada como deployed e ainda não estar anexada ao trigger; o binding do trigger precisa ser aplicado separadamente. A documentação também confirma que o Deploy CLI é apropriado para import/deployment de configuração e que o fluxo deve incluir os bindings.

Portanto, para o erro `missing_tenant_id`, a próxima prova necessária é **live**:

1. listar Actions Post-Login efetivamente vinculadas ao Production Login Flow;
2. identificar a versão efetivamente publicada de `TMS — Tenant Claim`;
3. identificar qualquer outra Action que execute `api.access.deny` com `missing_tenant_id`;
4. confirmar o client Production e a audience;
5. confirmar `app_metadata.tenant_id` do usuário de teste;
6. emitir uma sessão nova e observar o resultado sem registrar token/cookie.

### 57.4 Classificação atual

- **AUTH-01:** P0 / BLOQUEADO / E4 pendente.
- **AUTH-02:** P1 / aberto para reconciliação independente de ambiente.
- **AUTH-03:** E2-E3 documental; E4 bloqueado pela ausência de capacidade Auth0 live nesta conexão.
- **SEC-01:** permanece dependente de AUTH-01 + DB-04.
- **Nenhuma alteração de Production foi executada.**

### 57.5 Próxima sequência

Não criar um novo Action nem modificar o AuthGuard. Primeiro reconciliar o estado live do tenant Production. Se a Action live divergir do repositório, a correção deve ser feita por dry-run + revisão + aplicação controlada do contrato versionado, preservando rollback e sem incluir credenciais no repositório.


## 58. FASE 2 — 2026-09-26 — AUTH-01: runbook de reconciliação live criado

### Evidência adicional

A auditoria do repositório encontrou **zero ocorrências** de `api.access.deny` e `missing_tenant_id` no código versionado. O Action Post-Login versionado não contém lógica de negação por ausência do tenant.

A documentação oficial do Auth0 confirma que:
- `api.access.deny()` produz `access_denied` e a mensagem fornecida aparece como `error_description`;
- erros não tratados dentro de Rules/Actions também podem resultar em `access_denied`;
- uma Action pode estar deployada sem estar efetivamente vinculada ao trigger, sendo necessário reconciliar o binding.

Portanto, o incidente Production ainda exige inspeção do **código efetivamente publicado/executado**, e não apenas da configuração desejada em `tenant.yaml`.

### Artefato criado

Foi criado:

`docs/audit/AUTH0-PRODUCTION-RECONCILIATION-RUNBOOK.md`

O runbook define a sequência segura:
1. inspeção read-only do Post-Login Flow;
2. identificação de todas as Actions efetivamente vinculadas;
3. busca por `api.access.deny`, `missing_tenant_id` e erros de runtime;
4. comparação com a Action versionada;
5. verificação do `app_metadata.tenant_id` do usuário de teste;
6. reconciliação de client/audience/issuer;
7. dry-run do Deploy CLI antes de qualquer alteração;
8. novo login;
9. validação Web → API → membership → PostgreSQL;
10. testes negativos de tenant.

### Limite atual

Nesta sessão **não há uma ferramenta Auth0 Management/CLI conectada ao tenant Production**. A instalação local não possui o binário Auth0 CLI disponível e não foi usada nenhuma credencial presente no contexto para contornar essa limitação.

Assim, não é possível afirmar qual Action/binding está efetivamente ativo em Production. A evidência atual permite concluir **drift/configuração live como finding**, mas não identifica ainda o objeto live responsável.

**AUTH-01 = P0 / BLOQUEADO / E4 PENDENTE.**

Nenhuma alteração foi aplicada ao Auth0 Production.

## 59. FASE 2 — 2026-09-26 — AUTH-01: Web alinhado ao Auth0 Next.js SDK v4

### Correção aplicada no branch de reconciliação

O Web já utiliza `@auth0/nextjs-auth0@4.30.0`, Next.js 16 e `proxy.ts` com `auth0.middleware()`, portanto a integração está no modelo atual do SDK v4.

Foi corrigido `apps/web/src/lib/auth0.ts` para declarar explicitamente `appBaseUrl: process.env.APP_BASE_URL` e manter o `audience` de API explicitamente em `authorizationParameters`. A mudança foi aplicada no commit `29ba3b8b34f17fbd82ebb3208c2afe1f8d5f1aab`.

A documentação atual do Auth0 para Next.js 16 confirma o uso de `Auth0Client`, `proxy.ts`/middleware e `APP_BASE_URL`; também confirma que parâmetros como audience devem ser fornecidos explicitamente ao SDK v4.

### Limite funcional importante

Essa correção melhora a integração Web → Auth0 SDK e torna o contrato de runtime explícito, mas **não pode por si só corrigir `access_denied / missing_tenant_id`**.

O erro observado ocorre durante o fluxo de autorização do Auth0, antes de o Web receber uma sessão. O claim `tenant_id` é emitido por uma Post-Login Action no tenant Auth0; o SDK Next.js não cria esse claim e não substitui a Action/binding do tenant.

Portanto, permanece obrigatório reconciliar o Action/flow efetivo de Production. Não será introduzido workaround no SDK para aceitar sessão sem tenant, porque isso enfraqueceria o contrato do AuthGuard.

### Estado

- **SDK Web:** corrigido/alinhado no branch.
- **API AuthGuard:** preservado.
- **Action versionado:** preservado.
- **Auth0 Production live:** ainda não reconciliado.
- **AUTH-01:** P0 / BLOQUEADO / E4 PENDENTE.
- **DB-04:** permanece P0 / E4 PENDENTE, independente deste ajuste.

Nenhuma alteração foi aplicada diretamente ao Auth0 Production.

## 60. FASE 2 — 2026-09-26 — Vercel: correção Auth0 validada em Preview; Production ainda não contém o commit corrigido

### Evidência Vercel

A integração Vercel foi usada para verificar o estado efetivo dos deployments do projeto Web.

Foi observado um deployment `READY` do branch `fix/auth0-production-tenant-contract-2026-09-26`, contendo o commit `70e5e49a97e0ac959dbe46ef028a97f5d4377286`. Esse branch contém a correção do Auth0 SDK v4 aplicada em `29ba3b8b34f17fbd82ebb3208c2afe1f8d5f1aab`.

O deployment identificado como Production permanece associado ao branch `main`, commit `08b69301b6d020b6049d0bb395628e8616946da8`, portanto não há evidência de que a correção do SDK já esteja em Production.

### Callback Production

Os logs do deployment Production observado registraram múltiplos:

`GET /auth/callback 500`

entre 15:30 e 16:01 (-03), além de um `GET /auth/callback 307`. Esses registros comprovam falha no callback em Production, mas não carregam o `error_description` do Auth0 e, isoladamente, não provam que cada 500 corresponda a `missing_tenant_id`.

### Correção/decisão

Não foi promovido o branch automaticamente para Production. A promoção agora deve ocorrer somente depois da reconciliação do Auth0 Production, porque o Web SDK e o Auth0 Post-Login Action são controles independentes.

Também foi avaliada a referência do Vercel Connect SDK. O SDK de Connect não é componente do fluxo de autenticação Auth0 do TMS e não deve ser introduzido como workaround para `missing_tenant_id`.

### Estado

- **Web SDK v4:** CORRIGIDO no branch de reconciliação.
- **Vercel Preview:** READY com a correção.
- **Vercel Production:** ainda no `main`; correção não promovida.
- **Auth0 Production:** ainda precisa de reconciliação live.
- **AUTH-01:** P0 / BLOQUEADO / E4 PENDENTE.

Nenhuma alteração de Production foi realizada nesta etapa.
