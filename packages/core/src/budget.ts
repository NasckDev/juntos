import type { Cents, Tx } from "./types.ts";

/** A sugestão arredonda para cima de R$ 50 em R$ 50. */
export const BUDGET_ROUNDING: Cents = 5000;
/** Meses usados na média da sugestão. */
export const BUDGET_SUGGESTION_MONTHS = 3;
/** A partir deste percentual do limite, o aviso de orçamento dispara. */
export const BUDGET_NOTIFY_PERCENT = 90;

export type BudgetTone = "in" | "warn" | "out";

export interface BudgetLine {
  readonly categoryId: string;
  /** Limite mensal x número de meses do período. */
  readonly limit: Cents;
  readonly spent: Cents;
  readonly percent: number;
  /** Positivo = quanto ainda dá para gastar; negativo = quanto passou. */
  readonly remaining: Cents;
  readonly tone: BudgetTone;
}

export interface BudgetStatus {
  /** Só categorias com limite, das mais apertadas para as mais folgadas. */
  readonly lines: readonly BudgetLine[];
  readonly totalLimit: Cents;
  /** Gasto só nas categorias que têm limite. */
  readonly totalSpent: Cents;
  readonly percent: number;
  readonly tone: BudgetTone;
}

/** Acima de 100 % é "out", a partir de 85 % é "warn". */
export function budgetTone(percent: number): BudgetTone {
  if (percent > 100) return "out";
  return percent >= 85 ? "warn" : "in";
}

/** Gasto por categoria (só saídas) de uma lista de lançamentos. */
export function spentByCategory(txs: readonly Tx[]): Record<string, Cents> {
  const spent: Record<string, Cents> = {};
  for (const t of txs) if (t.kind === "out") spent[t.categoryId] = (spent[t.categoryId] ?? 0) + t.amount;
  return spent;
}

/** Situação do orçamento: limites mensais x gasto, para um período de `months` meses. */
export function budgetStatus(
  limits: Readonly<Record<string, Cents>>,
  spent: Readonly<Record<string, Cents>>,
  months: number,
): BudgetStatus {
  const lines = Object.entries(limits)
    .filter(([, monthly]) => monthly > 0)
    .map(([categoryId, monthly]): BudgetLine => {
      const limit = monthly * months;
      const value = spent[categoryId] ?? 0;
      const percent = Math.round((value / limit) * 100);
      return { categoryId, limit, spent: value, percent, remaining: limit - value, tone: budgetTone(percent) };
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const totalLimit = lines.reduce((acc, l) => acc + l.limit, 0);
  const totalSpent = lines.reduce((acc, l) => acc + l.spent, 0);
  const percent = totalLimit ? Math.round((totalSpent / totalLimit) * 100) : 0;
  return { lines, totalLimit, totalSpent, percent, tone: budgetTone(percent) };
}

/**
 * Limites sugeridos pela média dos últimos 3 meses (`last3Months` = todos os lançamentos desses meses),
 * arredondada para cima de R$ 50. Sem nenhuma saída, devolve `{}`.
 */
export function suggestBudgets(last3Months: readonly Tx[]): Record<string, Cents> {
  const suggestion: Record<string, Cents> = {};
  for (const [categoryId, total] of Object.entries(spentByCategory(last3Months))) {
    if (total > 0)
      suggestion[categoryId] = Math.ceil(total / BUDGET_SUGGESTION_MONTHS / BUDGET_ROUNDING) * BUDGET_ROUNDING;
  }
  return suggestion;
}
