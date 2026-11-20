import { formatBRL, formatBRL0 } from "@juntos/core";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { budgetTone, Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { categoryOf } from "@/lib/finance";
import type { BudgetLine, CategoryView, GoalView, TxView } from "@/server/services/finance-types";
import { CategoryIcon, categoryIconOf } from "../category-icon";

const TONE_TEXT = { in: "text-in", warn: "text-warn", out: "text-out" } as const;
/** O Início mostra as 3 categorias mais apertadas e as 2 primeiras metas (`budgetMini`, `goalMini`). */
const BUDGET_ROWS = 3;
const GOAL_ROWS = 2;

function OpenLink({ href }: { href: string }) {
  return (
    <Button asChild variant="link" size="sm">
      <Link href={href}>Abrir</Link>
    </Button>
  );
}

export interface BudgetsCardProps {
  readonly budgets: readonly BudgetLine[];
  readonly categories: readonly CategoryView[];
  readonly txs: readonly TxView[];
  /** Meses do período (o limite é mensal). */
  readonly months: number;
}

/** Orçamento no Início: só leitura, as 3 categorias com mais limite usado. */
export function BudgetsCard({ budgets, categories, txs, months }: BudgetsCardProps) {
  const spent = new Map<string, number>();
  for (const tx of txs) if (tx.kind === "out") spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + tx.amount);
  const rows = budgets
    .filter((budget) => budget.monthlyLimit > 0)
    .map((budget) => ({
      category: categoryOf(categories, budget.categoryId),
      limit: budget.monthlyLimit * months,
      value: spent.get(budget.categoryId) ?? 0,
    }))
    .sort((a, b) => b.value / b.limit - a.value / a.limit)
    .slice(0, BUDGET_ROWS);

  return (
    <Card aria-labelledby="orc-t">
      <CardHeader title="Orçamento" titleId="orc-t" action={<OpenLink href="/planejamento?aba=orcamento" />} />
      {rows.length === 0 ? (
        <p className="text-muted">Defina um limite por categoria para acompanhar aqui.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const pct = Math.round((row.value / row.limit) * 100);
            const tone = budgetTone(pct);
            return (
              <li key={row.category.id}>
                <p className="mb-1.5 flex items-center gap-2">
                  <CategoryIcon icon={row.category.icon} hue={row.category.hue} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{row.category.name}</span>
                  <span className={cn("hv num text-sm font-bold", TONE_TEXT[tone])}>
                    {pct > 100
                      ? `Passou ${formatBRL0(row.value - row.limit)}`
                      : `Restam ${formatBRL0(row.limit - row.value)}`}
                  </span>
                </p>
                <Progress
                  value={row.value}
                  max={row.limit}
                  tone="auto"
                  label={`${row.category.name}, ${pct}% do limite`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Metas no Início: só leitura, as duas primeiras. */
export function GoalsCard({ goals }: { goals: readonly GoalView[] }) {
  const shown = goals.slice(0, GOAL_ROWS);
  return (
    <Card aria-labelledby="metas-t">
      <CardHeader title="Metas" titleId="metas-t" action={<OpenLink href="/planejamento?aba=metas" />} />
      {shown.length === 0 ? (
        <p className="text-muted">Crie uma meta para ver quanto falta e quando vocês chegam lá.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {shown.map((goal) => {
            const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
            const Icon = categoryIconOf(goal.icon);
            return (
              <li key={goal.id}>
                <p className="mb-1.5 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-[0.45rem] bg-brand-soft text-brand-text"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{goal.name}</span>
                  <span className="num text-sm text-muted">{pct}%</span>
                </p>
                <Progress
                  value={goal.saved}
                  max={goal.target}
                  tone={pct >= 100 ? "in" : "brand"}
                  label={`${goal.name}, ${pct}% guardado`}
                />
                <p className="mt-1 text-xs text-muted">
                  <span className="hv num">{formatBRL(goal.saved)}</span> de{" "}
                  <span className="hv num">{formatBRL(goal.target)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
