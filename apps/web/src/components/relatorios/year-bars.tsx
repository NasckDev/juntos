"use client";

import type { YearMonth } from "@juntos/core";
import { MonthBars, type MonthBarsRow } from "@/components/charts/month-bars";
import { useFinanceUi } from "../financas/finance-context";
import { usePeriod } from "../financas/use-period";

export interface YearBarsProps {
  readonly rows: readonly MonthBarsRow[];
  readonly currentYm: YearMonth;
  readonly selected: readonly YearMonth[];
  readonly title: string;
}

/** Barras dos 12 meses do ano: tocar num mês escolhe o mês (e tira o período), na URL. */
export function YearBars({ rows, currentYm, selected, title }: YearBarsProps) {
  const { form } = useFinanceUi();
  const { setPeriod } = usePeriod(form.today);
  return (
    <MonthBars
      rows={rows}
      currentYm={currentYm}
      selected={selected}
      onSelect={(ym) => setPeriod({ start: ym, span: 1 })}
      title={title}
    />
  );
}
