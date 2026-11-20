"use client";

import {
  daysIn,
  formatCompact,
  type IsoDate,
  monthName,
  parseYearMonth,
  todayParts,
  totals,
  type YearMonth,
} from "@juntos/core";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { CategoryView, TxView } from "@/server/services/finance-types";
import { NewEntryButton } from "../controls";
import { TxLine } from "../tx-row";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export interface CalendarViewProps {
  readonly ym: YearMonth;
  readonly txs: readonly TxView[];
  readonly categories: readonly CategoryView[];
  readonly today: IsoDate;
}

function firstWeekday(ym: YearMonth): number {
  const { year, month } = parseYearMonth(ym);
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** Calendário do mês (`lCal` do protótipo): totais por dia (pontos no celular) e o painel do dia escolhido. */
export function CalendarView({ ym, txs, categories, today }: CalendarViewProps) {
  const now = todayParts(today);
  const days = daysIn(ym);
  const [picked, setPicked] = useState<number | null>(null);
  const selected = Math.min(picked ?? (ym === now.ym ? now.day : 1), days);
  const monthTxs = txs.filter((tx) => tx.competence === ym);
  const lead = firstWeekday(ym);
  const trail = (7 - ((lead + days) % 7)) % 7;
  const dayTxs = monthTxs.filter((tx) => tx.day === selected);
  const month = monthName(ym).toLowerCase();

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
      <Card pad="none" aria-label={`Calendário de ${month}`} className="p-3 lg:col-span-8 lg:p-5">
        <div className="grid grid-cols-7 overflow-hidden rounded-field border-t border-l border-line">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              aria-hidden="true"
              className="border-r border-b border-line bg-surface2 py-1.5 text-center text-xs font-medium text-muted"
            >
              {weekday}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: casas vazias fixas antes do dia 1
            <div key={`a${i}`} aria-hidden="true" className="min-h-12 border-r border-b border-line lg:min-h-20" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const list = monthTxs.filter((tx) => tx.day === day);
            const sum = totals(list);
            const isToday = ym === now.ym && day === now.day;
            const count = list.length;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={day === selected}
                aria-label={`Dia ${day}, ${count} ${count === 1 ? "lançamento" : "lançamentos"}`}
                onClick={() => setPicked(day)}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden border-r border-b border-line p-1 text-sm font-medium transition-colors hover:bg-surface2",
                  "lg:min-h-20 lg:items-start lg:justify-start lg:gap-0.5 lg:px-2 lg:py-1.5",
                  "aria-pressed:bg-brand-soft",
                )}
              >
                <span
                  className={cn(
                    "num grid size-6 place-items-center rounded-full",
                    isToday && "bg-brand font-semibold text-brand-ink",
                  )}
                >
                  {day}
                </span>
                {sum.in ? (
                  <small className="hv num hidden text-xs font-semibold text-in lg:block">
                    +{formatCompact(sum.in)}
                  </small>
                ) : null}
                {sum.out ? (
                  <small className="hv num hidden text-xs font-semibold lg:block">−{formatCompact(sum.out)}</small>
                ) : null}
                {sum.save ? (
                  <small className="hv num hidden text-xs font-semibold text-save lg:block">
                    {formatCompact(sum.save)}
                  </small>
                ) : null}
                <span aria-hidden="true" className="flex h-1.5 gap-0.5 lg:hidden">
                  {sum.in ? <i className="size-1.5 rounded-full bg-in" /> : null}
                  {sum.out ? <i className="size-1.5 rounded-full bg-out" /> : null}
                  {sum.save ? <i className="size-1.5 rounded-full bg-save" /> : null}
                </span>
              </button>
            );
          })}
          {Array.from({ length: trail }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: casas vazias fixas depois do último dia
            <div key={`z${i}`} aria-hidden="true" className="min-h-12 border-r border-b border-line lg:min-h-20" />
          ))}
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2.5 rounded-full bg-in" />
            Entrada
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2.5 rounded-full bg-out" />
            Saída
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2.5 rounded-full bg-save" />
            Guardado
          </span>
        </p>
      </Card>

      <Card aria-labelledby="dia-t" className="self-start lg:col-span-4">
        <CardHeader
          title={`Dia ${selected} de ${month}`}
          titleId="dia-t"
          action={
            <NewEntryButton variant="ghost" size="sm" date={`${ym}-${String(selected).padStart(2, "0")}`}>
              Adicionar
            </NewEntryButton>
          }
        />
        {dayTxs.length > 0 ? (
          <ul>
            {dayTxs.map((tx) => (
              <TxLine key={tx.id} tx={tx} categories={categories} today={today} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nada lançado neste dia.</p>
        )}
      </Card>
    </div>
  );
}
