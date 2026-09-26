# DB-04 — Runbook de evidência E4 da sessão real `tms_app`

## Objetivo

Produzir evidência observável, sem expor credenciais, de que a sessão PostgreSQL usada pelo runtime possui:

- `current_user = tms_app`;
- `rolbypassrls = false`;
- acesso ao próprio tenant;
- nenhum vazamento de outro tenant;
- INSERT cross-tenant rejeitado;
- UPDATE cross-tenant rejeitado;
- nenhuma persistência após `ROLLBACK`.

> Este runbook deve ser executado usando a conexão real do runtime `tms_app`. Não use `neondb_owner` como substituto.

## 1. Pré-requisitos

Use um terminal ou cliente PostgreSQL que consiga abrir uma sessão com a mesma `DATABASE_URL` efetiva do runtime.

Exemplo:

```bash
psql "$DATABASE_URL"
```

Se a URL precisar ser obtida no Neon/Vault/secret manager, copie-a apenas para o ambiente local de execução. Não cole a URL, senha ou token no chat, tracker, issue ou log.

Antes do teste, tenha dois tenants reais:

- `TENANT_A`: tenant que será o contexto ativo;
- `TENANT_B`: outro tenant;
- `FREIGHT_A`: um registro de `public.freights` pertencente a A;
- opcionalmente `FREIGHT_B`: um registro de B para testar UPDATE/DELETE sobre uma linha de outro tenant.

Não invente UUIDs de produção.

## 2. Provar a identidade da sessão

Execute:

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

Critério de aprovação:

```text
current_user  = tms_app
rolbypassrls  = false
rolsuper      = false
```

Os demais atributos devem ser registrados apenas se fizerem parte do contrato de segurança.

## 3. Confirmar o contexto transacional do tenant

Substitua os placeholders localmente:

```sql
BEGIN;

SET LOCAL app.tenant_id = '<TENANT_A>';

SELECT
  current_user,
  current_setting('app.tenant_id', true) AS tenant_context;
```

Esperado:

```text
current_user   = tms_app
tenant_context = <TENANT_A>
```

## 4. SELECT do próprio tenant

Ainda na mesma transação:

```sql
SELECT
  count(*) AS own_rows
FROM public.freights
WHERE tenant_id = '<TENANT_A>';
```

Esperado: pelo menos 1 se `TENANT_A` tiver o registro de fixture escolhido.

Para uma prova mais determinística, use o ID conhecido:

```sql
SELECT id, tenant_id
FROM public.freights
WHERE id = '<FREIGHT_A>';
```

Esperado: exatamente 1 linha e `tenant_id = TENANT_A`.

## 5. SELECT cross-tenant sem vazamento

Ainda com `app.tenant_id = TENANT_A`:

```sql
SELECT
  count(*) AS cross_tenant_rows
FROM public.freights
WHERE tenant_id = '<TENANT_B>';
```

E, se houver `FREIGHT_B`:

```sql
SELECT id, tenant_id
FROM public.freights
WHERE id = '<FREIGHT_B>';
```

Esperado:

```text
cross_tenant_rows = 0
```

e nenhuma linha para `FREIGHT_B`.

> O ponto importante é que a consulta deve ser executada pela sessão `tms_app`, com RLS efetivamente aplicado. Um resultado obtido como `neondb_owner` não fecha DB-04.

## 6. INSERT cross-tenant rejeitado

Use um UUID novo somente para a tentativa e mantenha tudo dentro da transação:

```sql
SAVEPOINT before_cross_tenant_insert;

INSERT INTO public.freights (
  id,
  tenant_id,
  status,
  freight_type,
  origin_city,
  origin_state,
  destination_city,
  destination_state,
  cargo_description,
  quantity,
  weight_kg
)
VALUES (
  gen_random_uuid(),
  '<TENANT_B>',
  'open',
  'dedicated',
  'Santos',
  'SP',
  'São Paulo',
  'SP',
  'DB-04 cross-tenant evidence',
  1,
  100
);
```

Esperado: erro de RLS, normalmente SQLSTATE `42501`.

Se o cliente parar a transação após o erro, reconecte ou use um savepoint:

```sql
ROLLBACK TO SAVEPOINT before_cross_tenant_insert;
```

Não considere "nenhuma linha visível" suficiente para esta etapa: o objetivo é comprovar que o `WITH CHECK` impede a escrita cross-tenant.

## 7. UPDATE cross-tenant — duas provas

### 7.1 Tentar atualizar uma linha pertencente a B

Com contexto A:

```sql
UPDATE public.freights
SET cargo_description = 'MUST-NOT-CHANGE'
WHERE id = '<FREIGHT_B>';
```

Esperado:

```text
UPDATE 0
```

Isso demonstra que a linha de B não é alvo de UPDATE pela política `USING`.

### 7.2 Tentar reatribuir uma linha de A para B

Essa é a prova de `WITH CHECK`:

```sql
SAVEPOINT before_tenant_reassignment;

UPDATE public.freights
SET tenant_id = '<TENANT_B>'
WHERE id = '<FREIGHT_A>';
```

Esperado: erro de RLS, normalmente SQLSTATE `42501`.

Depois:

```sql
ROLLBACK TO SAVEPOINT before_tenant_reassignment;
```

## 8. Rollback e prova de nenhuma persistência

Depois das tentativas:

```sql
ROLLBACK;
```

Abra uma nova sessão com a mesma role `tms_app`, reinstale o contexto A e confirme que nenhum artefato de teste persistiu.

Por exemplo:

```sql
BEGIN;
SET LOCAL app.tenant_id = '<TENANT_A>';

SELECT count(*)
FROM public.freights
WHERE cargo_description = 'DB-04 cross-tenant evidence';

ROLLBACK;
```

Esperado:

```text
count = 0
```

Para a tentativa de UPDATE, confirme que `FREIGHT_A` mantém o `tenant_id` original e que `FREIGHT_B` não foi alterado.

## 9. Provar que SET LOCAL não vazou

Em uma nova sessão:

```sql
SELECT nullif(
  current_setting('app.tenant_id', true),
  ''
) AS tenant_context_after_rollback;
```

Esperado:

```text
tenant_context_after_rollback = NULL
```

Isso comprova que o contexto instalado com `SET LOCAL` ficou restrito à transação.

## 10. Evidência a registrar no tracker

Registre somente resultados não sensíveis:

| Evidência | Esperado |
|---|---|
| `current_user` | `tms_app` |
| `rolbypassrls` | `false` |
| SELECT próprio tenant | linha(s) esperadas |
| SELECT cross-tenant | 0 linhas |
| INSERT cross-tenant | rejeitado / SQLSTATE 42501 |
| UPDATE linha de outro tenant | 0 linhas |
| UPDATE reatribuindo A→B | rejeitado / SQLSTATE 42501 |
| rollback | concluído |
| artefato de teste após rollback | 0 |
| contexto após rollback | NULL |

Não registre:

- senha;
- connection string;
- tokens;
- cookies;
- JWT;
- `DATABASE_URL` completa;
- dumps de dados de clientes.

## 11. Critério de fechamento do DB-04

DB-04 pode passar de `BLOQUEADO / E4 PENDENTE` para `E4 CONFIRMADO` somente quando houver evidência da sessão real `tms_app` contendo, no mínimo:

1. identidade `tms_app`;
2. `rolbypassrls = false`;
3. SELECT próprio funcionando;
4. SELECT cross-tenant sem vazamento;
5. INSERT cross-tenant rejeitado;
6. UPDATE cross-tenant rejeitado;
7. rollback confirmado;
8. nenhuma persistência após rollback.

## 12. Atalho: teste de integração já existente no repositório

O repositório já contém `packages/database/test/security.integration.test.ts`. Ele foi desenhado para usar duas conexões separadas:

- `DATABASE_ADMIN_URL`: somente para provisionar fixtures e limpar;
- `DATABASE_URL`: conexão restrita usada nas asserções de isolamento.

O teste já cobre SELECT cross-tenant, INSERT com `WITH CHECK`, UPDATE com mudança de `tenant_id`, ausência de contexto e escopo transacional de `app.tenant_id`.

Para uma execução controlada fora da produção:

```bash
RUN_DB_INTEGRATION=true pnpm --filter @tms/database test
```

Use as variáveis reais somente no ambiente seguro de execução.

Esse teste automatizado é excelente como regressão, mas para fechar o finding de produção a evidência deve identificar explicitamente a sessão real usada no ambiente que está sendo auditado.
