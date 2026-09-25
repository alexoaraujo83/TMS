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

## 12. Continuação da auditoria — workspace e dependências

- **PKG-02 — Dependência de workspace não declarada no pacote:** `packages/freight/package.json` não declara dependências, embora o pacote seja consumido por `apps/api` e o código de domínio de freight seja importado em runtime. Nesta etapa não foi encontrado import interno do próprio pacote que prove uma dependência ausente; portanto o achado é de **revisão de contrato de package**, não de falha confirmada. **Estado: ABERTO / P2.**
- **PKG-03 — Package `@tms/audit` sem consumidor runtime identificado:** o package existe e depende de `@tms/tenancy`, porém a busca de imports runtime não encontrou `from "@tms/audit"` no repositório. O worker grava auditoria por meio de `@tms/database`. **Estado: CANDIDATO A ORFÃO / P2.**
- **PKG-04 — `@tms/config` continua sem consumidor runtime:** além do achado CONFIG-01, o próprio `package.json` não declara dependências de runtime; a evidência atual reforça que é uma biblioteca de configuração isolada, não a fronteira efetiva de configuração dos apps. **Estado: DÍVIDA TÉCNICA / P2.**
- **PKG-05 — Grafo de dependências observado sem ciclo evidente no nível de manifestos:** `@tms/api` depende de auth/database/freight/matching/observability/security; `@tms/auth` depende de tenancy/security; `@tms/security` depende de tenancy; `@tms/matching` depende de freight; `@tms/worker` depende de database/observability. A partir desses manifests não aparece ciclo direto. **Estado: ESTRUTURALMENTE CONSISTENTE / REVISÃO DE IMPORTS AINDA ABERTA.**
- **PKG-06 — Turbo inclui variáveis sensíveis no ambiente de build:** `turbo.json` declara `AUTH0_SECRET` e `AUTH0_CLIENT_SECRET` entre as variáveis do task `build`. Isso não prova vazamento, mas aumenta a superfície de propagação/cache do ambiente de build e precisa ser reconciliado com a necessidade real dessas variáveis durante compilação. **Estado: PRECISA REVISÃO DE SEGURANÇA / P1.**
- **PKG-07 — Lockfile e manifests precisam de reconciliação contínua:** `pnpm-lock.yaml` referencia os packages workspace, enquanto Vercel usa instalação sem `--frozen-lockfile`. O controle de dependências no CI é mais rígido que no deploy. **Estado: REFORÇA BUILD-01 / P1.**

## 13. Próxima etapa da auditoria

A auditoria segue sem correções de código. O próximo bloco deve cobrir: imports efetivos dos packages, acesso SQL direto fora de `packages/database`, todas as policies/RLS das migrações 0001–0033, worker completo (leases, retries, shutdown e erro), Web completo (Auth0, proxy e tenant), workflows de CI/CD e contratos de deploy Vercel/Railway. Somente depois de fechar esse inventário será iniciada a fase de evidências/correções/refatoração.
