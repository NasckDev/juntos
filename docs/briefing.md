> Briefing original do projeto, publicado sem os valores reais da planilha que deu origem ao app.

# Juntos: implementar o app real a partir do protótipo

Você vai transformar o protótipo anexado (`prototipo/index.html`) em um produto real, full stack, pronto para produção e para portfólio de engenheiro sênior. Leia este documento inteiro e o HTML inteiro antes de escrever qualquer código.

## 1. Contexto do produto

O Juntos organiza as finanças de uma casa, para uma pessoa sozinha ou para um casal. Ele nasceu de uma planilha anual do Excel com uma aba por mês e três seções: Renda mensal, Despesas mensais (com uma coluna de situação "pago" ou "-") e Economia mensal. A aba Visão Geral resume o ano. O app precisa manter tudo o que a planilha faz e ir além: contas fixas e parcelas lançadas sozinhas, divisão justa entre o casal, orçamento, metas, projeção, notificações, e importação e exportação no mesmo modelo da planilha.

Público: todas as idades. Cerca de 90% do uso será no celular. O app é mobile-first.

## 2. Como usar o protótipo

O `juntos.html` é a **fonte da verdade para UX, UI, textos e regras de negócio**. Ele **não** é referência de arquitetura: é um arquivo único com JavaScript inline e `localStorage`. Reconstrua tudo componentizado, tipado e testado.

O que extrair do HTML:

- Telas, fluxos, textos (em pt-BR), estados vazios, mensagens de erro e validações.
- Tokens de design: fonte Inter, paleta clara e escura, as 11 cores de destaque, os 4 tamanhos de letra, raios, espaçamentos e sombras.
- Regras de negócio. As implementações de referência estão nestas funções do HTML: `parseMoney`, `guessCat`, `ensureMonth` e `addFromRec` (recorrência), `division` (divisão e acerto), `notifs` e `syncEv` (notificações), `tips` (sugestões), `pProj` (projeção), `simOut` (simulador Price), `expFilt` e `buildXlsx` (exportação), `parseBook` e `dImport` (importação com revisão), `buildPdf`.
- Os avatares em SVG (pessoas, animais, objetos) e a imagem do ícone embutida.

Os dados de exemplo do HTML são fictícios. Use-os só como seed de demonstração.

## 3. Como trabalhar

1. **Primeiro, não escreva código.** Entregue e espere minha aprovação de:
   - inventário de telas, componentes e regras de negócio encontrados no HTML;
   - proposta de modelo de dados (diagrama ER em Mermaid);
   - plano de fases com critérios de aceite;
   - lista de dúvidas e decisões que precisam de mim.
2. Crie um `CLAUDE.md` na raiz com as convenções do projeto e mantenha-o atualizado.
3. Registre decisões de arquitetura como ADRs em `docs/adr/` (curtas: contexto, decisão, consequências).
4. Trabalhe em fases. Cada fase termina com testes passando, CI verde e um resumo do que mudou.
5. Commits pequenos no padrão Conventional Commits, em português ou inglês (escolha um e mantenha).
6. Não invente funcionalidades fora do protótipo. Se achar que algo falta, liste como sugestão e pergunte.
7. Antes de instalar qualquer dependência, confirme a versão estável mais recente na documentação oficial ou no npm. Não fixe versões de memória.

## 4. Stack

Escolhida para ser moderna, muito usada no mercado e boa de mostrar em entrevista. Se discordar de algum item, proponha a troca num ADR antes de implementar.

### Monorepo
- **pnpm** + **Turborepo**.
- `apps/web`: Next.js (App Router, React Server Components, Server Actions onde fizer sentido), React 19, TypeScript em modo estrito.
- `apps/mobile` (fase futura): Expo + React Native, reaproveitando os pacotes compartilhados.
- `packages/core`: regras de negócio puras em TypeScript, sem dependência de framework (dinheiro, recorrência, divisão, projeção, orçamento, sugestões, importação e exportação no modelo da planilha).
- `packages/db`: schema e migrações.
- `packages/api`: roteadores tRPC.
- `packages/validators`: esquemas Zod compartilhados entre front, back e mobile.
- `packages/ui`: design system (componentes e tokens).
- `packages/config`: TypeScript, lint e Tailwind compartilhados.

### Front-end
- Tailwind CSS (v4) com os tokens do protótipo em variáveis CSS, tema claro e escuro, cor de destaque e tamanho de letra trocáveis pelo usuário.
- shadcn/ui (Radix) como base: Sheet (painel lateral no computador), Drawer com vaul (folha de baixo no celular), Command com cmdk (busca Ctrl/⌘+K), Sonner (avisos com "Desfazer"), Tabs, Popover (seletor de mês e período).
- TanStack Query (via tRPC) para dados do servidor. Estado da URL com `nuqs` (mês, período, filtros, abas). Zustand só para estado de UI efêmero, se precisar.
- React Hook Form + Zod para formulários, com erro inline embaixo de cada campo, como no protótipo.
- Gráficos: Recharts ou visx, mantendo o que o protótipo faz: eixo com valores arredondados, dica ao passar o dedo ou o mouse, foco por teclado e `aria-label` com a frase completa de cada mês.
- Motion para animações curtas, sempre respeitando `prefers-reduced-motion`.
- next-intl com pt-BR. Moeda e datas com `Intl`, fuso America/Sao_Paulo.
- PWA instalável (Serwist), com leitura offline das últimas telas.

### Back-end
- **Better Auth**: login com Google, conta de convidado (plugin anônimo, que depois pode ser vinculada a uma conta Google sem perder dados) e sessões seguras.
- **PostgreSQL** serverless (Neon) com **Drizzle ORM** e drizzle-kit para migrações. Um branch de banco por pull request.
- **tRPC** com middleware de autenticação e de autorização por espaço e papel.
- **Inngest** (ou Trigger.dev) para jobs: lançar as contas fixas de cada mês, avisos de vencimento, resumo semanal e processamento de importações grandes.
- **Resend** + React Email para e-mails. Web Push para notificações no celular. WhatsApp Cloud API (Meta) atrás de uma feature flag, porque exige verificação do Meta Business.
- **ExcelJS** para gerar o Excel no modelo da planilha e **SheetJS** para ler planilhas. PDF gerado no servidor (`@react-pdf/renderer`).
- Upstash Redis para limitar requisições.

### Qualidade e operação
- Vitest (unidade, com foco total em `packages/core`), Testing Library, Playwright (ponta a ponta, primeiro no celular de 390 px), axe-core no CI e MSW para simular APIs.
- Biome (ou ESLint flat config + Prettier), lefthook, commitlint e Renovate.
- GitHub Actions: tipagem, lint, testes unitários, ponta a ponta, build e Lighthouse CI. Deploy de prévia na Vercel por pull request.
- Sentry (erros), PostHog (analytics de produto e feature flags) e OpenTelemetry.
- Variáveis de ambiente validadas com `@t3-oss/env-nextjs`.

## 5. Modelo de dados (ponto de partida)

Valide e ajuste na proposta da etapa 1.

- **Dinheiro sempre em centavos inteiros** (`bigint` ou `integer`). Nunca ponto flutuante.
- `users`, `accounts` e `sessions` (do Better Auth), com `name`, `email`, `avatar` (código do avatar) e `created_at`.
- `spaces`: id, nome, ícone, `split_mode` (igual, renda ou personalizado) e `split_pct`.
- `space_members`: space_id, user_id ou e-mail convidado, papel (`owner`, `editor`, `viewer`), status (`invited`, `active`), datas.
- `invites`: token, e-mail, papel, expiração e quem convidou.
- `categories`: as padrão do sistema e as personalizadas por espaço (nome, ícone, matiz, tipo `in`, `out` ou `save`).
- `transactions`: space_id, tipo, descrição, valor em centavos, data, category_id, pago, data do pagamento, forma de pagamento, quem pagou (member_id), `personal` (fora da divisão), observação, recurrence_id, número da parcela, total de parcelas, import_batch_id, `created_by` e `updated_by`.
- `recurrences`: modelo da conta fixa (mesmos campos do lançamento), frequência mensal ou anual, dia, mês de início, total de parcelas e `paused`.
- `budgets`: space_id, category_id, limite mensal em centavos.
- `goals` e `goal_deposits`.
- `settlements`: acertos registrados (de, para, valor, período).
- `notifications`: histórico da central (tipo, chave de deduplicação, título, texto, link de destino, mês, `seen_at`, `read_at`).
- `user_preferences`: tema, cor de destaque, tamanho de letra, esconder valores, tipos de aviso ligados e telefone de WhatsApp verificado.
- `import_batches`: arquivo, origem (modelo mensal ou exportação detalhada), contagens e status, para auditoria e para desfazer.
- `audit_log`: quem fez o quê e quando, em cada espaço.

Todo acesso a dados filtra por `space_id` e checa o papel do membro no servidor. Escreva testes de autorização (por exemplo, quem "só vê" não consegue editar, e quem não é membro não lê nada).

## 6. Regras de negócio que precisam de testes

Porte do HTML para `packages/core`, com testes unitários **antes** da interface:

- Leitura de valores em pt-BR: "1.200" é R$ 1.200,00, "1.200,50" é R$ 1.200,50, "12,5" é R$ 12,50.
- Recorrência mensal, anual e parcelada; lançamento idempotente do mês (o job não pode duplicar); pausar e retomar; edição "só neste mês" ou "neste e nos próximos" (afeta só os futuros em aberto).
- Situação: em aberto, pago, atrasado (vencido e não pago) e "vence em até 7 dias".
- Totais do mês: entrou, saiu, guardado e sobra, com sobra prevista e "até hoje".
- Período de até 3 meses (para frente ou para trás) em Início, Lançamentos, Orçamento, Divisão e Relatórios. O Calendário é sempre de um mês.
- Divisão: só saídas pagas, fora as pessoais; modos igual, proporcional à renda do período e personalizado; cálculo de quem deve a quem; acertos zeram a diferença.
- Orçamento: limite por categoria, limite somado no período, sugestão pela média dos últimos 3 meses arredondada para cima de 50 em 50.
- Metas: progresso, previsão de data, depósito que não passa do que falta.
- Projeção dos próximos 6 meses: contas lançadas mais a média dos gastos variáveis; parcelas que terminam e contas anuais que chegam.
- Simulador de quitação (Tabela Price), inclusive preenchendo a partir de um parcelamento do usuário.
- Sugestões ("Vale saber") e notificações com deduplicação.
- Detecção de lançamento duplicado (mesmo nome, valor, tipo e dia), com aviso que deixa salvar se o usuário confirmar.
- Importação: modelo da planilha (seções Renda mensal, Despesas mensais e Economia mensal, coluna de situação, parcelas no nome como "7/29") e exportação detalhada do próprio app; marcação do que "já existe"; escolha de ano, destino e modo (somar ou substituir).
- Exportação com filtros de período, tipo, situação, pessoa e categoria: Excel no modelo da planilha (aba por mês com as fórmulas nas mesmas células, Visão Geral com fórmulas ligadas às abas, aba Lançamentos para reimportar sem perda), PDF e CSV.

A planilha real do casal **nunca** entra no repositório. Os testes usam uma cópia anonimizada com a mesma estrutura, e a conferência dos totais de cada mês contra a planilha real roda só localmente, com o arquivo fora do repositório (ver `docs/04-duvidas-e-decisoes.md`, item 11).

## 7. Telas (seguir o protótipo)

- Entrada: Google ou convidado; boas-vindas com nome e escolha entre dados de exemplo e começar do zero.
- Início: resumo do mês ou período, próximos vencimentos, saldo dia a dia, para onde foi o dinheiro, orçamento, metas e "Vale saber".
- Lançamentos: Lista (busca, inclusive em todos os meses, filtros e agrupamento por situação), Calendário e Contas fixas (parcelamentos com progresso).
- Planejamento: Orçamento (com "+" para lançar direto na categoria e "Nova categoria"), Metas, Próximos meses e Simulador.
- Divisão de contas, Relatórios, Notificações (central com histórico e filtros), Importar e exportar, Ajustes (Conta e avatar, Aparência, Avisos, Pessoas e compartilhamento, Categorias e Dados).
- Padrões globais: seletor de mês que abre ao clicar (grade de meses, troca de ano e modo Período), busca Ctrl/⌘+K, atalhos (N, /, setas, ?), "Desfazer" no lugar de confirmação para ações reversíveis, painel lateral no computador e folha de baixo no celular, esconder valores e validação inline em todos os campos.

## 8. Requisitos não funcionais

- **Mobile-first**: testar em 360, 390 e 412 px; alvos de toque de 44 px ou mais; campos com letra de pelo menos 16 px (evita zoom no iPhone); áreas seguras do iOS; nada de estouro lateral.
- **Acessibilidade**: WCAG 2.2 AA, navegação completa por teclado, foco visível, contraste de 4,5:1, landmarks e rótulos. Zero violações graves no axe.
- **Desempenho** (celular intermediário em 4G): LCP abaixo de 2,5 s, INP abaixo de 200 ms, CLS abaixo de 0,1. Orçamento de JavaScript por rota, monitorado no CI.
- **Segurança**: validação com Zod em toda entrada no servidor; autorização por espaço em toda consulta; limite de requisições; cabeçalhos seguros e CSP; cookies de sessão `httpOnly`, `secure` e `sameSite`; proteção contra CSRF; uploads só de `.xlsx`, com limite de tamanho e lidos no servidor; sem segredos no repositório.
- **LGPD**: exportar todos os dados, excluir a conta de verdade (com período de carência) e coletar só o necessário. Página de privacidade e termos (eu reviso o texto).
- **Confiabilidade**: jobs idempotentes, transações no banco para importações e acertos, e "Desfazer" implementado no servidor (soft delete ou lote reversível).

## 9. Fases sugeridas

1. **Base**: monorepo, CI, deploy de prévia, tokens de design, componentes básicos, `CLAUDE.md`, primeiros ADRs e README inicial.
2. **Núcleo**: `packages/core` com todas as regras da seção 6 e cobertura de testes alta.
3. **Dados e acesso**: schema, migrações, seed de demonstração, Better Auth (Google e convidado com vinculação), espaços, membros, convites e papéis.
4. **Lançamentos**: CRUD, contas fixas, parcelas, seletor de mês e período, busca, filtros e desfazer.
5. **Visão**: Início, Relatórios e gráficos acessíveis.
6. **Planejamento e Divisão**: orçamento, categorias, metas, próximos meses, simulador, divisão e acertos.
7. **Importar e exportar**: revisão linha a linha, Excel no modelo da planilha, PDF e CSV com filtros.
8. **Notificações**: central com histórico, jobs, e-mail, Web Push e WhatsApp atrás de flag.
9. **Acabamento**: PWA, auditoria de acessibilidade e desempenho, testes ponta a ponta dos fluxos principais, endurecimento de segurança e deploy de produção.
10. **Futuro**: app Expo reaproveitando `core`, `validators` e `api`.

## 10. Entregáveis de portfólio

- README com: o problema (a planilha do casal), demo ao vivo, conta de demonstração com dados fictícios, prints e GIF no celular, diagrama de arquitetura em Mermaid, decisões técnicas (links para os ADRs), como rodar localmente e scripts.
- Selos de CI, cobertura de testes e pontuação do Lighthouse.
- Histórico de commits e pull requests limpos, com descrições claras.

## 11. O que não fazer

- Não guardar dinheiro em ponto flutuante.
- Não confiar em nada que vem do cliente: valide e autorize no servidor.
- Não usar `any` nem desligar regras do TypeScript para "passar".
- Não copiar a estrutura do JavaScript inline do HTML: reconstrua com componentes e camadas.
- Não pular os testes das regras de negócio.
- Não colocar segredos, dados pessoais reais ou a planilha real no repositório (a fixture de teste deve ser anonimizada).
- Não adicionar dependências sem justificar.

Comece pela etapa 1 da seção 3: leia o `juntos.html` inteiro e me traga o inventário, o modelo de dados, o plano de fases e suas dúvidas.
