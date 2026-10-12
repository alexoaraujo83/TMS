# Web, Dashboard e Admin — auditoria e plano de testes

**Escopo:** landing page `/`, dashboard operacional `/app`, seção dinâmica `/app/[section]`, Project Control Center `/admin` e `/project-control/dashboard`, BFF/API consumidas por essas telas, sessão Auth0 e permissões administrativas.

## Achados iniciais de revisão estática

1. **Proteção de `/admin`:** a página valida a sessão e consulta o contexto de runtime da API antes de renderizar. O código falha fechado quando a API não confirma acesso. Validar por testes que respostas 401/403/5xx e timeout nunca deixam a tela administrativa ser renderizada.
2. **Dashboard operacional:** `/app` carrega saúde, perfil e fretes em efeitos separados. Melhorias recomendadas: estados explícitos de carregamento/erro/vazio, cancelamento de requisições em desmontagem, evitar atualização fora de ordem, botão de nova tentativa e separar dados reais de placeholders.
3. **Control Center:** faz requisições sem cache para projeto e saúde; filtros são client-side. Melhorias: validar payloads da API em runtime, proteger contra percentuais fora de 0–100, indicar idade do snapshot e manter claramente o último snapshot quando uma atualização falha.
4. **Diagnóstico:** conferir limites de tamanho e normalização das entradas, respostas genéricas sem vazamento de consultas, rate limit e autorização no servidor. Testar correlation ID, trace ID e idempotency keys sem aceitar acesso transversal por tenant.
5. **Acessibilidade:** verificar landmarks, hierarquia de headings, labels, foco de teclado, contraste, zoom e leitores de tela. Não usar apenas cor para comunicar estados.
6. **Performance:** medir LCP/INP/CLS, peso do JS, renderizações repetidas e número de chamadas. Consolidar requests apenas se preservada a separação entre dados de saúde e dados de projeto; usar cache no-store para informação operacional sensível.
7. **Operação:** health status precisa diferenciar indisponibilidade real, degradado, não verificado e snapshot obsoleto. Nunca exibir “saudável” por fallback quando a verificação falhar.

> Os itens acima são achados/recomendações da leitura estática do código; não representam execução de browser, teste de produção, nem confirmação do estado atual dos serviços.

## Matriz de testes obrigatórios

### P0 — identidade e segurança
- Visitante sem sessão: `/admin` redireciona ao login; nenhum conteúdo administrativo no HTML.
- Usuário autenticado sem permissão administrativa: resposta negada e sem renderização do dashboard.
- API administrativa responde 401, 403, 5xx, timeout ou JSON inválido: acesso negado; sem fail-open.
- `/auth/profile` e `/auth/access-token` não entregam dados/token sem sessão.
- Acesso cruzado a tenant/IDs: negar leitura, busca, mutação e diagnóstico fora do tenant ativo.
- Não vazar token, cookies, stack traces, SQL, connection strings ou secrets nos corpos, logs ou mensagens de erro.
- CSRF/origin, cookies Secure/HttpOnly/SameSite, redirect allowlist e sessão expirada.
- Autorização testada no servidor; esconder link/botão no frontend não é controle de acesso.

### P1 — funcionamento de páginas e estados
- Landing page carrega e links internos apontam para destinos válidos.
- Dashboard: carregando, sucesso com dados, arrays vazios, erro de rede, 401/403, 500, JSON inválido e retry.
- Fretes: lista vazia, muitos itens, estados desconhecidos, status nulo, duplicatas e erro de fetch.
- Admin: dados de módulos/etapas/evidências/blockers; filtros combinados, sem resultados, acentos/maiúsculas e strings longas.
- Saúde: todos os estados, latência ausente, timestamp inválido, snapshot antigo, falha depois de um sucesso e falha inicial.
- Diagnóstico: campo vazio, whitespace, entradas longas, caractere especial, ID inválido, nenhum resultado, resultados parciais, rate limit e falha por fonte.
- Ações repetidas/duplo clique não geram chamadas concorrentes incorretas nem dados obsoletos sobrescrevendo o resultado novo.

### P1 — acessibilidade e responsividade
- Teclado completo, ordem de foco, foco visível, nomes acessíveis, labels, alerts/status anunciados e headings sem saltos.
- Viewports de 320, 375, 768, 1024 e 1440 px; sem overflow horizontal da página (tabelas podem ter scroll próprio).
- Zoom 200%, prefers-reduced-motion e contraste WCAG 2.2 AA.
- Estados não transmitidos apenas por cor; botões com estado disabled/loading acessível.

### P2 — performance e resiliência
- Web Vitals: LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no percentil 75 como metas.
- Limitar payload/paginação para listas grandes; debounce em filtros somente se medição mostrar necessidade.
- Timeout, cancelamento de requisições, backoff limitado e ausência de polling agressivo.
- Testes de carga dos endpoints de resumo e health em ambiente não produtivo.

## Critérios de aceite

- Nenhum teste P0 falha; negar por padrão em qualquer erro de autorização.
- Testes de componentes e integração passam no CI, com fixtures sem dados reais.
- Teste de navegador (Playwright ou equivalente) cobre fluxos autenticados com usuário de teste não produtivo e prova de isolamento multi-tenant.
- A11y automatizada sem violações críticas/serias; revisão manual de teclado e leitor de tela registrada.
- Performance medida em build de produção, com relatório e baseline versionados.
- Teste de smoke implantado executado separadamente contra URL explicitamente configurada; sem mutações, backup manual ou operações destrutivas.

## Execução local / smoke de implantação

A suíte `apps/web/src/admin-surface.smoke.test.ts` é somente leitura. Sem `TMS_WEB_BASE_URL`, os testes de smoke são ignorados pelo runner normal. Para executar contra uma implantação:

```bash
TMS_WEB_BASE_URL=https://seu-host-de-preview.example pnpm --filter @tms/web test
```

Use preferencialmente preview/staging. O smoke não substitui testes de navegador, testes de autorização com identidade real, isolamento de tenant, nem testes unitários dos componentes.
