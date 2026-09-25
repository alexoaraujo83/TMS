# TMS — Rastreador de Auditoria e Execução

> **Status:** VIVO / lista de trabalho canônica  
> **Última atualização:** 2026-09-24  
> **Repositório:** `alexoaraujo83/TMS`  
> **Branch:** `main`  
> **HEAD da aplicação auditada:** `fb0025aea93aed9ad134a3266f2e7274fb9bcda5`  
> **HEAD de controle/documentação anterior:** `9c0d786386bb129c57cd2bd7b92458fc4ce35365`  
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
| CI | Run `36074378568` no HEAD de controle `9c0d786386bb129c57cd2bd7b92458fc4ce35365` concluiu `success`; job `107882428713` executou architecture check, migration, RLS/IAM/worker integration, format, lint, typecheck, test e build | COMPROVADO NO HEAD DE CONTROLE | Repetir no próximo HEAD relevante e manter CI separado da prova operacional de produção |

## 3. Tabela mestre de execução

| ID | Área | Concreto hoje | Estado | O que fazer | Evidência de encerramento | Prioridade |
|---|---|---|---|---|---|---|
| REL-01 | Manifesto de release | API está no HEAD; Web/Worker podem permanecer em SHA anterior porque foram pulados como não afetados | ABERTO | Criar manifesto versionado com SHA do repositório, SHA efetivo de Web/API/Worker, head de migração e referências de configuração | Um único registro reconcilia todos os componentes de produção | P0 |
| DB-01 | Head de migração Neon | Repositório contém até `0033_durable_job_idempotency.sql`; evidência independente de produção/main continua em 31 migrações / 0031 | BLOQUEADO | Executar verificação read-only autoritativa do `schema_migrations` e dos checksums 0032/0033 | Banco live comprova head e checksums esperados | P0 |
| DB-02 | Pipeline de migração | Workflow de produção define sempre `TMS_ALLOW_EXISTING_SCHEMA_BASELINE=true` | REVISÃO | Restringir baseline a bootstrap explícito ou provar formalmente por que o modo permanente é seguro | Caminho normal de produção não transforma silenciosamente schema vazio em baseline canônico | P1 |
| DB-03 | Papel de banco em runtime | Worker verifica em código que o usuário atual deve ser `tms_app`; adoção em runtime de produção ainda não foi comprovada | PARCIAL | Provar identidade do worker e grants efetivos em runtime | Worker em produção confirma papel aprovado e least privilege | P1 |
| DB-04 | RLS comportamental | RLS/FORCE RLS e `NOBYPASSRLS` estão implementados; teste E4 cross-tenant em produção ainda não foi executado | BLOQUEADO | Executar teste controlado de leitura/escrita cross-tenant com a credencial real de runtime | Operação cross-tenant é negada em produção | P0 |
| AUTH-01 | Claim tenant Auth0 | Action versionada define `https://tms-platform.io/claims/tenant_id`; API valida token, subject e membership | ABERTO | Emitir novo token real e rastrear Auth0 → Web → API → DB | Token real com claim de tenant é aceito e operação tenant-scoped funciona; tenant incorreto é negado | P0 |
| AUTH-02 | Paridade Auth0 | Contrato de variáveis existe; valores/configuração exatos do tenant Auth0 de produção não foram verificados independentemente | ABERTO | Reconciliar domínio, aplicação, API, Action, audience, issuer e JWKS sem expor segredos | Fingerprint/configuração documentada + E2E real | P1 |
| API-01 | Cobertura de rotas protegidas | Freight usa AuthGuard + PermissionGuard e permissões específicas por operação | PARCIAL | Criar matriz rota × permissão × validação × tenant e executar smoke tests | Todas as rotas de negócio possuem evidência de proteção e isolamento | P1 |
| API-02 | Permissão de replay | `POST :id/status-events/:eventId/replay` usa `freight:update` | PRECISA HARDENING | Criar permissão dedicada, por exemplo `freight:replay`, com concessão explícita | Usuário de update comum recebe 403; papel autorizado executa replay | P1 |
| API-03 | Semântica de replay | Cada replay gera `replay:<eventId>:<randomUUID>`; chamadas repetidas criam jobs distintos | DECISÃO NECESSÁRIA | Definir se replay manual é deliberadamente repetível ou deve ser idempotente | Semântica documentada + teste de chamadas repetidas | P1 |
| API-04 | Testes do replay | Busca no repositório não encontrou teste dedicado do endpoint/service de replay | ABERTO | Testar sucesso, evento inexistente, aggregate divergente, payload inconsistente, 403, isolamento tenant e repetição | Suite direcionada passa e entra no CI | P1 |
| API-05 | Documentação do replay | Documentação geral de freight não reflete claramente a nova operação de replay | DRIFT DOCUMENTAL | Atualizar API/ops e controles operacionais | Docs, permissão e operação coincidem | P1 |
| API-06 | Endpoints de diagnóstico em produção | Existem `runtime-context`, `runtime-db-context`, `runtime-rls-isolation` e `runtime-auth-claims`, protegidos apenas por `freight:read` | PRECISA REVISÃO DE SEGURANÇA | Restringir a diagnóstico/admin, remover de produção ou definir explicitamente o contrato de exposição | Evidência de que dados de contexto/tenant não ficam disponíveis a usuários comuns | P1 |
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
| CI-01 | CI do HEAD atual | Run `36074378568` / job `107882428713` no SHA `9c0d786386bb129c57cd2bd7b92458fc4ce35365` terminou com sucesso e todos os passos do job passaram | COMPROVADO | Preservar evidência e repetir no próximo HEAD de aplicação/control plane relevante | format/lint/typecheck/test/build + architecture check verdes no SHA auditado | P0 |
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

- **DOC-03 — Drift documental concreto:** docs/PROJECT-DOCUMENTATION.md e docs/architecture/FOUNDATION.md ainda descrevem packages/contracts, mas esse diretório não existe no repositório atual e não há pacote @tms/contracts. A documentação corrente também afirma 31 migrações como estado atual, enquanto o repositório contém 0032_observability_audit_context.sql e 0033_durable_job_idempotency.sql. docs/INTEGRATIONS-OPERATIONS.md ainda descreve Railway como destino pretendido do API, enquanto a infraestrutura observada mantém tms-core-api em Vercel. **Estado: DRIFT DOCUMENTAL / P1.**
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
- **REPO-04 — Financeiro tem invariantes SQL fortes, mas mutações não geram auditoria:** `financial_entries` possui checks de direção/tipo/valor/status, FKs tenant-scoped, unicidade de referência externa e RLS/FORCE RLS. Entretanto, `FinanceRepository.create()` e `settle()` não chamam `appendAuditEvent`, ao contrário das demais mutações de negócio auditadas. **Estado: LACUNA DE CONTROLE / P1.** Evidência necessária: decisão explícita de auditabilidade financeira e testes de trilha para criação/settlement/cancelamento.
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
