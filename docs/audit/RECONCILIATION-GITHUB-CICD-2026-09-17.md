# Reconciliação GitHub / CI-CD — 2026-09-17

## 1. Baseline

HEAD auditado: `487bac7dcbcd9756122a39d33910fa78b3fdc151`.

O commit anterior `863165b8346c7023031913641e94524c8a7540c9` foi validado pelo GitHub Actions no run #818 (`35167126135`) com conclusão `success`. O presente commit é posterior ao run #818 e requer nova execução antes de ser considerado validado por CI.

## 2. Repositório

- repositório: `alexoaraujo83/TMS`
- branch padrão: `main`
- visibilidade: pública
- arquivado: não
- permissões da integração auditora: admin/maintain/push disponíveis
- merge commit, rebase e squash habilitados
- auto-merge desabilitado

## 3. Workflows observados

### CI

`.github/workflows/ci.yml` executa em push/PR para `main` e possui:

1. PostgreSQL 17 efêmero;
2. instalação determinística via `pnpm install --frozen-lockfile`;
3. migrations;
4. provisionamento controlado das roles `tms_app` e `tms_ci_admin` somente no ambiente efêmero;
5. validação de atributos da role runtime;
6. testes de RLS/IAM;
7. integração PostgreSQL de Durable Jobs explicitamente executada;
8. format fix/check;
9. lint;
10. typecheck;
11. testes;
12. build.

### Database Migrations

`.github/workflows/database-migrate.yml`:

- executa em `main` quando migrations/scripts/package/lockfile mudam ou manualmente;
- usa o environment `production`;
- consome `secrets.NEON_DATABASE_URL` sem expor o valor;
- verifica que o secret não está vazio;
- executa migrations;
- usa `concurrency` sem cancelamento para evitar sobreposição de migrations.

## 4. Controles positivos

- CI possui cadeia de qualidade abrangente.
- Dependências são instaladas com lockfile congelado no CI.
- CI usa `permissions: contents: read`.
- Migrations de produção estão separadas do CI efêmero.
- Migration workflow possui `timeout-minutes: 15`.
- Migration workflow possui concorrência serializada.
- Durable Jobs integration não depende apenas do conjunto genérico de testes: existe etapa explícita.
- Não existem PRs abertos no momento da consulta.

## 5. Gaps / bloqueadores

### BLK-GH-001 — Proteção de `main` não comprovada

A integração não possui permissão para ler o endpoint de branch protection e retornou `403 Resource not accessible by integration`. Portanto, não é permitido declarar branch protection, required status checks, aprovação obrigatória ou restrição de push como comprovados.

Além disso, não há rulesets configurados: consulta de `/rulesets` retornou lista vazia.

**Estado:** ATIVO / evidência incompleta.

### BLK-GH-002 — Promoção entre ambientes não automatizada/comprovada

Os workflows disponíveis são `ci.yml` e `database-migrate.yml`. Não foi comprovado workflow de promoção explícita development → staging → production.

Isso é compatível com o achado anterior de que development/staging Neon existem, mas seus consumidores operacionais não foram comprovados.

**Estado:** ATIVO.

### BLK-GH-003 — CI do HEAD atual pendente

O commit `487bac7d...` foi criado depois do run #818. O último CI comprovado anteriormente é do commit `863165b...`.

**Estado:** PENDENTE DE EXECUÇÃO/VALIDAÇÃO.

### BLK-GH-004 — Deployment/runtime desacoplado do HEAD

A auditoria anterior encontrou deployments Railway do worker em SHAs anteriores e `SKIPPED` para alguns commits posteriores. Vercel também possui limitações de acesso na integração atual. Portanto, GitHub main verde não equivale automaticamente a runtime production atualizado.

**Estado:** ATIVO.

## 6. Risco importante

O workflow de CI usa `pnpm format:fix` antes de `pnpm format:check`. Isso mantém o gate verde, mas pode mascarar alterações de formatação feitas durante a própria execução. O comportamento não é tratado como falha nesta etapa; deve ser avaliado no gate de qualidade/CI quanto à política desejada de CI imutável.

## 7. Não executado

Não foram alterados branch protections, rulesets, environments, secrets ou deployments. Nenhum valor secreto foi requisitado ou exposto.

## 8. Próximo roteamento

1. validar o novo commit com CI;
2. reconciliar o resultado do CI com deployment/runtime;
3. fechar ou manter `BLK-GH-003`;
4. continuar CHAT 16 com histórico de deployments e triggers;
5. depois avançar para CHAT 17 — testes, mantendo os blockers de ambiente/runtime abertos.
