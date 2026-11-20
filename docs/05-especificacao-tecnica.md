# 5. Especificação técnica do app (v1)

Contrato entre as frentes de trabalho. Quem implementa segue isto à risca; desvio só com ADR.

## 5.1 Princípios do produto (decididos pelo dono)

- **Profissional e sem gambiarra:** nada simulado. Botão que aparece, funciona.
- **Toda conta começa vazia.** Sem dados de exemplo. As categorias padrão existem; lançamentos, metas, orçamento e contas fixas não. O estado vazio guia os primeiros passos (lançar o que entra, as contas fixas, ou importar a planilha).
- **Login com Google de verdade** (Better Auth) e **convidado** (conta anônima que depois vira conta Google sem perder dados).
- **Importar, exportar e notificações funcionam de ponta a ponta**, no servidor.
- **Mobile-first**, e o **computador com layout próprio e caprichado** (o dono achou o protótipo feio no computador).
- UX, textos e regras vêm do protótipo (`prototipo/index.html`) e de `docs/01-inventario.md`, com as decisões de `docs/04-duvidas-e-decisoes.md`.

## 5.2 Estrutura do repositório

```text
apps/web/                 Next.js (App Router) — o app
  src/app/                rotas (grupo (app) autenticado, (entrada) público, api/)
  src/components/ui/      design system (componentes base)
  src/components/         componentes de tela
  src/server/             db, auth, actions (Server Actions), serviços, jobs
  src/lib/                utilidades de cliente
  drizzle/                migrações geradas
  e2e/                    Playwright
packages/core/            regras de negócio puras (TypeScript, sem framework) + Vitest
prototipo/                protótipo original (referência, não é publicado)
docs/                     documentação
```

- **npm workspaces + Turborepo** (`turbo run build|test|typecheck|lint`).
- **TypeScript estrito** em tudo (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Sem `any`.
- **Biome** para lint e formatação (um `biome.json` na raiz).
- Node 20+ (CI em 22). Commits em inglês, Conventional Commits, uma linha.
- **Nunca** commitar `package-lock.json` de dentro de uma frente paralela: o integrador regenera.

## 5.3 Stack (versões confirmadas no npm em 2026-11-19)

Next.js + React 19, Tailwind CSS v4, Radix (via `radix-ui`) com componentes no estilo shadcn/ui escritos no repo,
`vaul` (folha de baixo), `cmdk` (Ctrl/⌘+K), `sonner` (toast com desfazer), `lucide-react` (ícones), `nuqs` (estado na URL),
Better Auth (Google + plugin anônimo), Drizzle ORM + drizzle-kit, banco **PGlite** no desenvolvimento e nos testes e
**Neon** (`@neondatabase/serverless`) em produção, **ExcelJS** (ler e gerar `.xlsx`), **jsPDF + jspdf-autotable** (PDF no servidor),
`web-push` (notificações push com VAPID), Vitest, Testing Library, Playwright + `@axe-core/playwright`.

Trocas em relação ao ADR 0004 (ver ADR 0005): Server Actions + Zod no lugar de tRPC; Vercel Cron no lugar de Inngest;
limite de requisições do Better Auth (armazenado no banco) no lugar de Upstash; ExcelJS também para leitura (o pacote
`xlsx` do npm está parado em versão com vulnerabilidades conhecidas). Sentry e PostHog ficam para depois do lançamento.

## 5.4 Núcleo (`packages/core`)

Funções puras, imutáveis, sem `Date.now()` escondido: "hoje" sempre chega como parâmetro (`today: IsoDate`).
Todo dinheiro em **centavos inteiros** (`Cents = number` inteiro, validado). Exporta tudo por `src/index.ts`.

### Tipos base (`src/types.ts`)

```ts
export type Cents = number;                 // inteiro, nunca fração
export type YearMonth = `${number}-${string}`; // "2026-11"
export type IsoDate = `${number}-${string}-${string}`; // "2026-11-19"
export type Kind = "in" | "out" | "save";
export type SplitMode = "equal" | "income" | "custom";
export type Role = "owner" | "editor" | "viewer";

export interface Tx {
  id: string; kind: Kind; description: string; amount: Cents;
  competence: YearMonth; day: number;          // dia do vencimento no mês
  categoryId: string; paid: boolean; paymentMethod: string;
  paidBy: string | null;                       // id do membro
  personal: boolean; note: string;
  recurrenceId: string | null; installment: number | null; installmentsTotal: number | null;
  yearly: boolean;
}
export interface Recurrence {
  id: string; kind: Kind; description: string; amount: Cents; categoryId: string;
  frequency: "monthly" | "yearly"; day: number; start: YearMonth;
  installmentsTotal: number | null; paymentMethod: string; paidBy: string | null;
  personal: boolean; paused: boolean;
}
export interface Member { id: string; name: string; active: boolean; }
export interface Settlement { id: string; from: string; to: string; amount: Cents; periodStart: YearMonth; periodEnd: YearMonth; }
export interface Goal { id: string; name: string; target: Cents; saved: Cents; monthly: Cents; }
export interface Category { id: string; name: string; icon: string; hue: number; kind: Kind; }
```

### Módulos e responsabilidades

| Arquivo | Conteúdo mínimo | Função do protótipo |
| --- | --- | --- |
| `money.ts` | `parseMoney(text): Cents \| null`, `formatBRL(c)`, `formatBRLCompact(c)`, `sumCents`, `splitProportional(total, weights): Cents[]` (maior resto, soma exata) | `parseMoney`, `brl`, `brl0`, `short` |
| `calendar.ts` | `ymOf`, `ymAdd`, `ymDiff`, `daysIn`, `monthName`, `monthShort`, `ymLabel`, `periodMonths(start, span)`, `previousPeriod`, `todayParts(today)`; período máximo 3 meses na tela e 36 na exportação | `ymAdd`, `ymDiff`, `yms`, `prevYms` |
| `categories.ts` | `DEFAULT_CATEGORIES` (13 do protótipo), `guessCategory(description, kind)` | `CATS`, `RULES`, `guessCat` |
| `recurrence.ts` | `occursIn(rec, ym)`, `materialize(rec, ym, today): Omit<Tx,"id">` ou `null`, `missingForMonth(recs, existing, ym, today)` (idempotente por `recurrenceId+competence`), `applyForward(recurrence, txs, fromYm, changes)` (só futuros em aberto), `pauseEffects`, `resumeEffects` | `ensureMonth`, `addFromRec`, `recpause` |
| `status.ts` | `isLate(tx, today)`, `isDueSoon(tx, today, days)`, `DUE_SOON_HOME_DAYS=7`, `DUE_SOON_NOTIFY_DAYS=3`, `groupBySituation` | `isLate`, `listHtml` |
| `totals.ts` | `totals(txs)` → `{ in, out, save, outPaid, outDue, left }`, `byCategory(txs, kind)`, `receivedSoFar`, `dailyBalance(txs, ym)`, `delta(cur, prev)` | `totals`, `byCat`, `dayChart`, `delta` |
| `duplicates.ts` | `findDuplicate(candidate, txs)` (nome normalizado, valor, tipo, competência e dia) | submit `#txf` |
| `division.ts` | `computeDivision({ members, txs, mode, customPct, settlements })` → `{ mode, total, people[], moves[], withoutPayer[] }`; só saídas pagas, não pessoais, com pagador; renda = entradas **recebidas**; quitação gulosa; tudo em centavos | `division` |
| `budget.ts` | `budgetStatus(limits, spent, months)`, `suggestBudgets(last3Months)` (média arredondada **para cima de R$ 50**) | `pOrc`, `budauto` |
| `goals.ts` | `goalProgress`, `forecastMonths`, `validateDeposit(goal, amount)` | `pMetas`, `depf` |
| `projection.ts` | `projectMonths({ txs, recurrences, today, months: 6 })` com média dos variáveis dos 3 meses anteriores com dados; `upcomingChanges` (parcelas que terminam, anuais que chegam) | `pProj` |
| `price.ts` | `pricePayment(principal, monthlyRate, n)`, `simulatePayoff({ principal, rate, n, extra })` → meses, juros, curva; `estimateBalance(payment, rate, n)`; validações do protótipo | `simOut`, `simSaldo` |
| `tips.ts` | `tips(input)` → até 3 itens `{ tone, icon, title, body }` com as 6 regras do protótipo | `tips` |
| `notifications.ts` | `currentNotices(input)` → avisos com `dedupeKey` estável (atrasadas, vencendo em 3 dias, orçamento ≥ 90 %, meta alcançada, convite pendente, contas fixas lançadas) | `notifs`, `syncEv` |
| `import/monthly-sheet.ts` | `parseMonthlySheet(sheets: { name: string; rows: Cell[][] }[], fileYear)` → itens; seções Renda mensal, Despesas mensais (situação), Economia mensal, subseção "Apê", parcela "7/29" | `parseBook` |
| `import/detailed.ts` | `parseDetailedSheet(rows)` (aba "Lançamentos" do próprio app) | `parseBook` (det) |
| `import/review.ts` | `markExisting(items, txs)`, `planImport(items, { year, mode })` | `dImport`, `doImport` |
| `export/filters.ts` | `exportFilter`, `validateExportRange` (até 36 meses), `filterForExport` | `expFilt`, `expErr` |
| `export/workbook-model.ts` | modelo puro da planilha: abas por mês com as fórmulas nas mesmas células (C4 a C10 e B11), Visão Geral com somas 3D e aba Lançamentos | `buildXlsx` |

Cobertura mínima: **95 %** de linhas e ramos no core. Cada regra tem os casos de borda: 31 de fevereiro, última
parcela, anual que cai no mês, divisão sem renda, valores "1.200" e "1.5", período que atravessa o ano.

A fixture da planilha (`test/fixtures/monthly-sheet.ts`) é **gerada por código** com nomes e valores fictícios;
nenhum arquivo `.xlsx` real entra no repositório.

## 5.5 Banco (Drizzle)

Segue `docs/02-modelo-de-dados.md`, com `competence date` (dia 1) + `day smallint` no lugar de `due_date`, porque o
mês é o eixo de tudo. Tabelas do Better Auth (`user`, `session`, `account`, `verification`, `rateLimit`) geradas pelo CLI dele.
Toda tabela de domínio tem `space_id`; toda consulta passa por `requireMember(spaceId, minRole)`.

Fábrica de conexão (`src/server/db/index.ts`): com `DATABASE_URL` usa Neon; sem ela usa PGlite em `.data/pglite`
(desenvolvimento) ou em memória (testes). Migrações rodam com `npm run db:migrate`.

## 5.6 Autenticação e acesso

- Better Auth com Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) e plugin `anonymous` (convidado). Sem as variáveis do Google, o botão do Google **não aparece** e a tela explica que só o convidado está habilitado.
- Ao vincular o convidado a uma conta Google, os dados migram (`onLinkAccount`).
- Novo usuário ganha um espaço "Casa" vazio, como dono.
- Papéis: `owner` (tudo), `editor` (lança e edita), `viewer` (só vê). Convite por link com token de uso único (só o hash no banco), expira em 7 dias; se `RESEND_API_KEY` existir, também vai por e-mail.

## 5.7 Servidor

- Mutações em Server Actions com Zod (`src/server/validators/*`). Retorno padrão `{ ok: true, data } | { ok: false, error, fieldErrors? }`.
- Mensagens de erro iguais às do protótipo, em português.
- "Desfazer" no servidor: soft delete (`deleted_at`) ou lote (`undo_token`), com expiração de 10 minutos.
- **Contas fixas do mês** são materializadas de forma idempotente ao abrir um mês e pelo cron diário.
- **Cron** (`vercel.json` → `/api/cron/diario`, protegido por `CRON_SECRET`): materializa o mês, gera avisos (deduplicados) e envia push e e-mail conforme as preferências.
- **Push:** `web-push` com `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`; o service worker recebe e mostra o aviso. Script `npm run chaves:vapid` gera as chaves.
- **Importação:** upload só `.xlsx`, até 5 MB, lido no servidor com ExcelJS → `packages/core` → tela de revisão linha a linha → gravação numa transação, com lote reversível.
- **Exportação:** Route Handler gera `.xlsx` (ExcelJS, a partir do `workbook-model` do core), PDF (jsPDF) e CSV, com os filtros do protótipo.
- **Exportar todos os dados** (JSON) e **excluir a conta** (carência de 30 dias) em Ajustes.

## 5.8 Interface

- Rotas: `/entrar`, `/(app)/inicio`, `/lancamentos` (abas lista, calendário, fixas), `/planejamento` (orçamento, metas, próximos meses, simulador), `/divisao`, `/relatorios`, `/notificacoes`, `/dados` (importar e exportar), `/ajustes/*`. Mês, período e filtros na URL (`nuqs`).
- **Celular:** barra inferior com 5 itens, botão flutuante, folhas de baixo (`vaul`), alvos de 44 px, campos com 16 px, áreas seguras do iOS.
- **Computador:** layout próprio (ver `docs/06-design.md`), não é o celular esticado.
- Tema claro e escuro, 11 cores de destaque, 4 tamanhos de letra e esconder valores, salvos em `user_preferences`.
- Gráficos em SVG próprio, acessíveis: eixo com valores redondos, dica no toque e no mouse, foco por teclado, `aria-label` com a frase completa, tabela alternativa.
- `prefers-reduced-motion` desliga animações. WCAG 2.2 AA; axe sem violações graves.

## 5.9 Testes e qualidade

- `packages/core`: Vitest, cobertura ≥ 95 %.
- `apps/web`: Vitest para validators, serviços e autorização (PGlite em memória: quem só vê não edita, quem não é membro não lê); Testing Library nos componentes críticos; Playwright no celular (390 px) e no computador (1440 px) com axe.
- CI: privacidade → lint → typecheck → testes → build → ponta a ponta.

## 5.10 Variáveis de ambiente (`apps/web/.env.example`)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CRON_SECRET`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY`, `EMAIL_FROM`. Validadas na inicialização
com Zod (`src/server/env.ts`); as opcionais desligam o recurso de forma explícita, nunca em silêncio.
