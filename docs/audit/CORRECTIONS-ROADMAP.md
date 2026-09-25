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
