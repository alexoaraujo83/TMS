# Contribuição e qualidade de código

## Formatação obrigatória

Todo arquivo novo ou alterado deve ser formatado com a versão do Prettier declarada no `package.json` raiz.

Antes de qualquer commit, execute:

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format:check` é obrigatório. Qualquer `[warn]` do Prettier é considerado falha e deve ser corrigido antes do commit.

## Arquivos TypeScript

Arquivos `.ts` e `.tsx` novos devem seguir exatamente a configuração compartilhada do repositório. Não faça ajustes manuais de estilo para contornar o Prettier.

O CI executa `pnpm format:check` antes de lint, typecheck, testes e build. Portanto, uma alteração TypeScript só deve ser considerada pronta quando o check de formatação estiver limpo.

## Fluxo de implementação

1. Implementar a alteração.
2. Executar `pnpm format`.
3. Executar `pnpm format:check`.
4. Executar lint e typecheck.
5. Executar testes.
6. Executar build.
7. Revisar o diff.
8. Commitar código e documentação relacionados no mesmo ciclo.

A regra vale para arquivos atuais e futuros do projeto.
