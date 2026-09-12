# TMS — Handoff de Execução e Continuidade

**Status:** baseline operacional em evolução
**Fonte de verdade:** código e banco do repositório `alexoaraujo83/TMS`
**Referência:** `alexoaraujo83/nexora-tms`, sem dependência de runtime

## 1. Objetivo

Este documento define como uma nova pessoa ou equipe deve assumir o desenvolvimento sem depender de conhecimento informal.

## 2. Regra de ouro

Não implementar uma funcionalidade apenas pela interface. O ciclo obrigatório é:

`especificar → desenhar → implementar → persistir → autorizar → testar → verificar → documentar → integrar`

Uma capacidade só deve ser marcada como concluída quando o comportamento real estiver coberto ponta a ponta.

## 3. Estado conhecido

A fundação utiliza TypeScript, pnpm/Turborepo, Next.js, NestJS, Worker e PostgreSQL/Neon. O banco está na versão 15. A base implementada cobre tenancy, IAM, master data, freight, matching/assignment, auditoria e o núcleo de Trip Operations.

Assignment possui invariantes de ocupação e ciclo de vida: assignment ativo ocupa motorista/veículo, delivery completa o assignment, cancelamento cancela o assignment e a transação deve preservar o estado anterior quando a sincronização falhar.

Trip Operations possui persistência tenant-scoped, RLS, vínculo obrigatório com freight/assignment, estados `planned`, `in_transit`, `delivered` e `cancelled`, transições protegidas por lock transacional e sincronização do freight e assignment no mesmo transaction boundary. A migration 0015 alinha a restrição de ciclo de vida aplicada ao banco para permitir cancelamento antes do início da viagem (`planned → cancelled`) sem `started_at`.

O Worker permanece bootstrap/placeholder. Não assumir que processamento assíncrono, outbox, retries ou DLQ estejam implementados.

## 4. Ordem recomendada de trabalho

### P0 — Integridade

1. Preservar isolamento por tenant.
2. Preservar autorização por permission code.
3. Preservar integridade das relações tenant-scoped.
4. Não introduzir segredo ou connection string real no repositório.
5. Manter migrations incrementais e reversíveis quando tecnicamente possível.

### P1 — Produto operacional

1. Consolidar UX das telas existentes.
2. Fechar fluxos de freight: criação, consulta, matching, assignment e status.
3. Expandir master data de carrier/driver/vehicle.
4. Consolidar Trip Operations e seus estados operacionais.
5. Implementar estados de loading, vazio, erro, sucesso, proibido e indisponível.
6. Cobrir API e UI com testes de comportamento.

### P2 — Operação

1. Observabilidade e correlação de requisições.
2. Worker real e processamento assíncrono.
3. Outbox/idempotência/retry quando o domínio exigir eventos.
4. Runbooks de deploy, rollback, backup e recuperação.

### P3 — Domínios futuros

Compliance/GR, Finance, Analytics/AI e integrações externas devem ser adicionados como bounded contexts/adapters, sem misturar responsabilidades no módulo de Freight ou Trip Operations.

## 5. Checklist por mudança

- [ ] Requisito funcional definido.
- [ ] Impacto arquitetural avaliado.
- [ ] Permissão necessária definida.
- [ ] Impacto tenant/RLS avaliado.
- [ ] Modelo de dados atualizado, se necessário.
- [ ] Migration criada, se necessário.
- [ ] API/use case implementado.
- [ ] UI e estados implementados, se aplicável.
- [ ] Testes adicionados.
- [ ] Lint/typecheck/format/test/build executados.
- [ ] Documentação atualizada.
- [ ] Rollback considerado.

## 6. Critérios de handoff para QA

QA deve receber: arquivos/módulos alterados, endpoints, permissões, migrations, estados de UI, cenários positivos/negativos, risco de regressão e instruções para reproduzir.

### Cenários mínimos de segurança

- usuário sem autenticação;
- usuário autenticado sem permissão;
- tenant A tentando acessar registro do tenant B;
- relação de master data entre tenants diferentes;
- recurso inexistente;
- UUID inválido;
- transição de estado inválida.

### Cenários mínimos de Freight/Matching/Assignment

- criar freight válido;
- listar e consultar freight;
- obter candidatos;
- assignment válido;
- impedir assignment duplicado ativo;
- impedir assignment concorrente para o mesmo motorista/veículo;
- excluir recurso ocupado do matching;
- `assigned → in_transit → delivered` completar assignment;
- `assigned → cancelled` cancelar assignment;
- impedir `in_transit → delivered` sem assignment ativo;
- preservar invariantes após falha/transação;
- validar isolamento tenant no assignment.

### Cenários mínimos de Trip Operations

- criar trip somente para assignment ativo do mesmo freight;
- impedir trip duplicada para assignment;
- `planned → in_transit` mover freight para `in_transit`;
- `in_transit → delivered` mover freight para `delivered` e completar assignment;
- `planned/in_transit → cancelled` cancelar freight e assignment;
- rejeitar transição com `expectedStatus` obsoleto;
- impedir transições inválidas;
- validar RLS tenant-scoped;
- preservar atomicidade entre trip, freight e assignment;
- registrar auditoria para criação e transição.

O teste `packages/database/test/trip-operations.integration.test.ts` cobre o fluxo principal de início/entrega e rejeição de transição obsoleta. O banco também possui uma migration incremental dedicada para manter a invariável de cancelamento coerente com o fluxo `planned → cancelled`.

## 7. Critérios de handoff para Operações

Toda entrega que alterar infraestrutura ou persistência deve informar:

- variáveis de ambiente;
- migrations novas;
- dependências externas;
- ordem de deploy;
- health checks;
- observabilidade;
- estratégia de rollback;
- impacto de dados;
- compatibilidade entre versões.

## 8. Design → Desenvolvimento

A especificação de cada tela deve conter: objetivo, usuário/permissão, jornada, informação necessária, componentes, ações, estados, validações, erros, responsividade, acessibilidade e contrato de API.

Nenhum botão deve existir sem definir seu comportamento de sucesso, falha, loading, disabled e unauthorized.

## 9. Desenvolvimento → Desenvolvimento

O sucessor deve começar pela documentação arquitetural e pelos contratos existentes, depois executar a validação completa antes de alterar o domínio. Não duplicar modelos ou criar um segundo mecanismo de tenancy/IAM sem ADR explícito.

## 10. Definition of Done

Uma funcionalidade está pronta somente quando:

`produto + UX/UI + frontend + backend + banco + segurança + testes + observabilidade + documentação + operação`

estão coerentes entre si.
