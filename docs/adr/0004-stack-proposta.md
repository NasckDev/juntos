# ADR 0004: Stack do app full stack

- **Status:** proposto (aguarda aprovação na Fase 1)
- **Data:** 2026-11-19

## Contexto

O briefing pede um app mobile-first, multiusuário, com jobs, e-mail, push e importação de planilhas, que sirva
de case de engenharia sênior.

## Decisão proposta

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Monorepo | pnpm + Turborepo | Cache de tarefas e pacotes compartilhados com o futuro app Expo |
| Web | Next.js (App Router, RSC), React 19, TypeScript estrito | Server Actions e rotas no mesmo deploy da Vercel |
| UI | Tailwind v4 com os tokens do protótipo, shadcn/ui (Radix), vaul, cmdk, Sonner | Componentes acessíveis que já cobrem gaveta, folha, paleta e toast com desfazer |
| Dados no cliente | tRPC + TanStack Query, estado da URL com `nuqs` | Tipos de ponta a ponta; mês, período e filtros na URL |
| Formulários | React Hook Form + Zod (`packages/validators`) | O mesmo schema valida no cliente e no servidor |
| Banco | PostgreSQL (Neon) + Drizzle | Branch de banco por PR; SQL tipado |
| Autenticação | Better Auth (Google e convidado anônimo com vinculação) | Convidado vira conta Google sem perder dados |
| Jobs | Inngest | Contas fixas do mês, avisos e importações grandes, com retentativa e idempotência |
| Arquivos | ExcelJS (gerar), SheetJS (ler), `@react-pdf/renderer` | Mesmo modelo de planilha do protótipo, no servidor |
| Qualidade | Vitest, Testing Library, Playwright, axe-core, MSW, Biome | Core testado antes da UI; acessibilidade no CI |
| Operação | Sentry, PostHog, OpenTelemetry, Upstash Redis | Erros, feature flags e limite de requisições |

Todas as versões serão confirmadas no npm na hora de instalar.

## Consequências

- Mais peças que os outros projetos do portfólio (Vite). Em troca, o projeto mostra autenticação real, autorização
  por espaço, jobs e banco, que é o objetivo do case.
