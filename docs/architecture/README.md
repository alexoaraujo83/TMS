# TMS — Arquitetura versionada

Este diretório é a fonte versionada dos diagramas arquiteturais mínimos do TMS. Os diagramas são Mermaid (`.mmd`) para permanecerem revisáveis por diff no Git.

## Conjunto obrigatório

| Diagrama | Arquivo | Escopo |
|---|---|---|
| Contexto | [context.mmd](./context.mmd) | Atores, Web, API, Auth0, Neon, Worker, backup e integrações externas |
| Deployment | [deployment.mmd](./deployment.mmd) | GitHub/CI, Vercel, Railway, Auth0, Neon, object store e controle de release |
| Domínio | [domain.mmd](./domain.mmd) | IAM/Tenancy, Master Data, Freight, Matching, Trip, Compliance, Finance, Reliability e Audit |

## Regras de atualização

1. Alterações de topologia, bounded context, runtime, persistência ou integração devem atualizar o diagrama correspondente na mesma mudança.
2. A documentação deve distinguir o que está implementado do que é alvo arquitetural.
3. CI executa `pnpm architecture:check` para verificar a presença dos três diagramas e a indexação deste conjunto.
4. O check é deliberadamente estrutural: ele não tenta inferir que o runtime de produção está de acordo com o desenho. A reconciliação de runtime continua sendo responsabilidade da auditoria/release.
5. Diagramas históricos não devem ser usados para descrever o estado atual sem uma referência temporal explícita.

## Relação com a auditoria

O conjunto atende ao item **DOC-02** do rastreador de auditoria. O fechamento operacional de DOC-02 exige que os diagramas sejam revisados contra o runtime efetivo e que o CI verde seja comprovado no HEAD auditado.