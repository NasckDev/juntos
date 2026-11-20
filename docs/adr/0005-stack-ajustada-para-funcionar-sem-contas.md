# ADR 0005: Stack ajustada (menos peças, tudo funcionando)

- **Status:** aceito
- **Data:** 2026-11-19
- **Substitui em parte:** ADR 0004

## Contexto

O dono pediu um app profissional, sem nada simulado, com login Google, importação, exportação e notificações
funcionando. Também delegou as decisões. Cada serviço externo a mais é uma conta, um segredo e um ponto de falha.

## Decisão

| Antes (ADR 0004) | Agora | Por quê |
| --- | --- | --- |
| pnpm | npm workspaces + Turborepo | O npm já está em todas as máquinas e projetos do autor; o Turborepo continua com o cache. |
| tRPC | Server Actions + Zod, Route Handlers para arquivos | Menos camadas; o mesmo schema Zod valida no cliente e no servidor. |
| Inngest | Vercel Cron (`/api/cron/diario`, com `CRON_SECRET`) + materialização idempotente ao abrir o mês | Sem conta externa; o lançamento do mês funciona mesmo se o cron atrasar. |
| Upstash | Limite de requisições do Better Auth, guardado no banco | Sem conta externa. |
| SheetJS (`xlsx`) | ExcelJS para ler e gerar | O `xlsx` do npm está parado numa versão com vulnerabilidades conhecidas. |
| next-intl | Textos em pt-BR direto, `Intl` para moeda e datas | Só há um idioma (YAGNI). |
| Recharts ou visx | Gráficos em SVG próprio | O protótipo já define gráficos acessíveis e leves; uma biblioteca só traria peso. |
| Sentry e PostHog | Depois do lançamento | Não são necessários para o app funcionar. |
| Banco local | PGlite (Postgres em WebAssembly) no desenvolvimento e nos testes; Neon em produção | Os testes rodam no CI sem Docker e sem credenciais. |

## Consequências

- Para produção bastam: um banco Neon (criado pela integração da Vercel), um cliente OAuth do Google e as chaves geradas
  pelo próprio projeto (`BETTER_AUTH_SECRET`, `CRON_SECRET`, chaves VAPID). E-mail (Resend) é opcional.
- Sem as variáveis do Google, o botão do Google não aparece e a tela diz por quê. Nada fica simulado.
