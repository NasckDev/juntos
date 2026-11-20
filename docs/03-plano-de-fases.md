# 3. Plano de fases

Cada fase termina com testes passando, CI verde, deploy de prévia e um resumo do que mudou. Nada da fase seguinte começa
sem a anterior aprovada.

| Fase | Entrega | Critérios de aceite | Situação |
| --- | --- | --- | --- |
| **0. Protótipo publicado** | Protótipo navegável na Vercel, documentação da etapa 1 (inventário, modelo de dados, plano, dúvidas), ADRs iniciais, CI com varredura de privacidade e testes de fumaça. | 12 testes Playwright verdes em 390 px e 1440 px com a CSP de produção; varredura de privacidade sem achados; nenhum dado real no repositório. | **Concluída** |
| **1. Base** | Monorepo pnpm + Turborepo, Next.js, TypeScript estrito, Tailwind v4 com os tokens do protótipo, shadcn/ui, Biome, lefthook, commitlint, Renovate, variáveis validadas, deploy de prévia por PR. | `pnpm verify` verde; tela de entrada e o shell (barra lateral e barra inferior) iguais aos prints; Lighthouse de acessibilidade 100 na entrada. | Aguardando aprovação |
| **2. Núcleo** | `packages/core` com todas as regras da [tabela de regras](01-inventario.md#13-regras-de-negócio), em TypeScript puro e testes antes da interface. | Cobertura ≥ 95 % no core; casos de borda (31 de fevereiro, parcelas que acabam, divisão sem renda, valores "1.200"); fixture anonimizada da planilha confere os totais de cada mês. | — |
| **3. Dados e acesso** | Schema e migrações Drizzle, seed de demonstração, Better Auth (Google e convidado com vinculação), espaços, membros, convites e papéis. | Testes de autorização: quem só vê não edita; quem não é membro não lê nada; convite expira e é de uso único. | — |
| **4. Lançamentos** | CRUD, contas fixas e parcelas, seletor de mês e período, busca, filtros, Ctrl/⌘+K e desfazer no servidor. | Ponta a ponta no celular: criar, editar "neste e nos próximos", pagar, desfazer; job do mês sem duplicar. | — |
| **5. Visão** | Início e Relatórios com gráficos acessíveis (eixo arredondado, dica no toque, teclado, `aria-label` por mês). | Números iguais ao protótipo com os mesmos dados; axe sem violações graves. | — |
| **6. Planejamento e Divisão** | Orçamento, categorias, metas, próximos meses, simulador, divisão e acertos. | Testes do core ligados à interface; acerto em transação do banco. | — |
| **7. Importar e exportar** | Revisão linha a linha, Excel no modelo da planilha (fórmulas nas mesmas células), PDF no servidor e CSV com filtros. | Importar o próprio Excel exportado devolve os mesmos lançamentos; upload só `.xlsx`, com limite de tamanho, lido no servidor. | — |
| **8. Notificações** | Central com histórico, jobs (Inngest), e-mail (Resend), Web Push e WhatsApp atrás de feature flag. | Jobs idempotentes; aviso deduplicado; preferências respeitadas. | — |
| **9. Acabamento** | PWA, auditoria de acessibilidade e desempenho, ponta a ponta dos fluxos principais, CSP com nonce, LGPD (exportar e excluir com carência), deploy de produção. | LCP < 2,5 s, INP < 200 ms e CLS < 0,1 em celular intermediário no 4G; WCAG 2.2 AA; zero violações graves no axe. | — |
| **10. Futuro** | App Expo reaproveitando `core`, `validators` e `api`. | — | — |

## Branches e fluxo

- `main` é a produção: protegida, só recebe PR com CI verde, e a Vercel publica a partir dela.
- Trabalho em branches curtas: `feat/<fase>-<assunto>` (ex.: `feat/f2-core-recorrencia`), `fix/<assunto>`, `docs/<assunto>`, `chore/<assunto>`.
- Commits em inglês no padrão Conventional Commits (`feat:`, `fix:`, `docs:`...), uma linha.
- Cada PR descreve o que mudou, como testar e prints quando há interface.
