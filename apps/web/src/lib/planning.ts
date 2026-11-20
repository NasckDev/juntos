import { type BudgetTone, budgetStatus, type Cents, spentByCategory } from "@juntos/core";
import type { BudgetLine, CategoryView, TxView } from "@/server/services/finance-types";

/** Abas do Planejamento, na ordem da tela; o valor vai em `?aba=`. */
export const PLAN_TABS = ["orcamento", "metas", "proximos", "simulador"] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

export const PLAN_TAB_LABELS: Record<PlanTab, string> = {
  orcamento: "Orçamento",
  metas: "Metas",
  proximos: "Próximos meses",
  simulador: "Simulador de quitação",
};

export function parsePlanTab(value: unknown): PlanTab {
  return PLAN_TABS.find((tab) => tab === value) ?? "orcamento";
}

export interface BudgetRow {
  readonly category: CategoryView;
  /** Limite mensal (0 = sem limite). */
  readonly monthly: Cents;
  /** Limite do período: mensal x meses. */
  readonly limit: Cents;
  readonly spent: Cents;
  readonly percent: number;
  readonly tone: BudgetTone;
}

export interface BudgetOverview {
  readonly rows: readonly BudgetRow[];
  readonly totalLimit: Cents;
  readonly totalSpent: Cents;
  readonly percent: number;
  readonly tone: BudgetTone;
  /** Quantas categorias têm limite. */
  readonly limited: number;
}

/** Categorias de saída com o gasto do período e o limite (`pOrc` do protótipo). Soma só o que tem limite. */
export function budgetOverview(
  categories: readonly CategoryView[],
  budgets: readonly BudgetLine[],
  txs: readonly TxView[],
  months: number,
): BudgetOverview {
  const limits = Object.fromEntries(budgets.map((budget) => [budget.categoryId, budget.monthlyLimit]));
  const spent = spentByCategory(txs);
  const outs = categories.filter((category) => category.kind === "out");
  const status = budgetStatus(
    Object.fromEntries(
      outs.flatMap((category) => (limits[category.id] ? [[category.id, limits[category.id] ?? 0]] : [])),
    ),
    spent,
    months,
  );
  const byId = new Map(status.lines.map((line) => [line.categoryId, line]));
  const rows = outs.map((category): BudgetRow => {
    const line = byId.get(category.id);
    const value = spent[category.id] ?? 0;
    return line
      ? {
          category,
          monthly: limits[category.id] ?? 0,
          limit: line.limit,
          spent: value,
          percent: line.percent,
          tone: line.tone,
        }
      : { category, monthly: 0, limit: 0, spent: value, percent: 0, tone: "in" };
  });
  return {
    rows,
    totalLimit: status.totalLimit,
    totalSpent: status.totalSpent,
    percent: status.percent,
    tone: status.tone,
    limited: status.lines.length,
  };
}

/** Link da lista de lançamentos filtrada por categoria, mantendo o período da tela (parâmetro `cat` da Lista). */
export function categoryListHref(
  categoryId: string,
  period: { start: string; span: number },
  currentYm: string,
): string {
  const params = new URLSearchParams({ cat: categoryId });
  if (period.start !== currentYm) params.set("mes", period.start);
  if (period.span > 1) params.set("meses", String(period.span));
  return `/lancamentos?${params.toString()}`;
}
