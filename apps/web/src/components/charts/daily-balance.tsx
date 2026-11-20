"use client";

import { type Cents, formatBRL } from "@juntos/core";
import { type KeyboardEvent, type PointerEvent, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { ChartTable } from "./chart-table";

export interface DailyBalanceProps {
  /**
   * Saldo acumulado: posição 0 = antes do dia 1; posição `d` = fim do dia `d`.
   * O tamanho é o número de dias do mês + 1.
   */
  points: readonly Cents[];
  /** Último dia que já aconteceu: 0 = mês futuro (tudo pontilhado); igual ao total de dias = mês passado. */
  todayDay: number;
  /** Nome do mês para o texto acessível ("novembro"). */
  monthLabel: string;
  className?: string;
}

const W = 560;
const H = 160;
const PAD_Y = 10;

/** Saldo do mês dia a dia (`dayChart` do protótipo): linha cheia até hoje e pontilhada depois. */
export function DailyBalance({ points, todayDay, monthLabel, className }: DailyBalanceProps) {
  const days = Math.max(points.length - 1, 1);
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const x = (d: number) => (d / days) * W;
  const y = (v: number) => PAD_Y + ((max - v) / span) * (H - 2 * PAD_Y);
  const cut = Math.min(Math.max(todayDay, 0), days);
  const line = (from: number, to: number) =>
    points
      .slice(from, to + 1)
      .map((v, i) => `${x(from + i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  const end = points[days] ?? 0;
  const [cursor, setCursor] = useState<number | null>(null);
  const shown = cursor ?? (cut > 0 && cut < days ? cut : null);
  const valueAt = (d: number) => points[d] ?? 0;

  const summary =
    cut > 0 && cut < days
      ? `Até hoje, dia ${cut}: ${formatBRL(valueAt(cut))}. Previsto para o fim do mês: ${formatBRL(end)}. Use as setas para ver cada dia.`
      : `${cut === 0 ? "Previsto para o" : "No"} fim do mês: ${formatBRL(end)}. Use as setas para ver cada dia.`;
  const focusDay = shown ?? days;
  const summaryId = useId();

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 };
    const delta = step[event.key];
    if (delta === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    if (event.key === "Home") setCursor(1);
    else if (event.key === "End") setCursor(days);
    else setCursor((c) => Math.min(Math.max((c ?? (cut || 1)) + (delta ?? 0), 1), days));
  }

  function onPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setCursor(Math.min(Math.max(Math.round(ratio * days), 1), days));
  }

  return (
    <figure className={cn("min-w-0", className)}>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      {/* O gráfico funciona como um cursor de dias: as setas mudam o dia e o leitor de tela fala o saldo. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Saldo acumulado em ${monthLabel}, dia a dia`}
        aria-describedby={summaryId}
        aria-valuemin={1}
        aria-valuemax={days}
        aria-valuenow={focusDay}
        aria-valuetext={`Dia ${focusDay}: ${formatBRL(valueAt(focusDay))}`}
        onKeyDown={onKey}
        onPointerMove={onPointer}
        onPointerLeave={() => setCursor(null)}
        onBlur={() => setCursor(null)}
        className="relative h-40 rounded-field lg:h-44"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 size-full overflow-visible"
        >
          <line
            x1="0"
            x2={W}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--line2)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {cut > 0 ? (
            <polyline
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={line(0, cut)}
            />
          ) : null}
          {cut < days ? (
            <polyline
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeDasharray="2 6"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={line(cut, days)}
            />
          ) : null}
        </svg>
        {shown !== null ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand"
              style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(valueAt(shown)) / H) * 100}%` }}
            />
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -top-1 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-surface",
                shown > days / 2 ? "-translate-x-full" : "",
              )}
              style={{ left: `${(x(shown) / W) * 100}%` }}
            >
              Dia {shown}: <b className="hv num">{formatBRL(valueAt(shown))}</b>
            </span>
          </>
        ) : null}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-xs text-muted">
        <span>Dia 1</span>
        <span>Dia {Math.round(days / 2)}</span>
        <span>Dia {days}</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>Linha cheia: o que já aconteceu</span>
        <span>Pontilhada: o que está previsto</span>
        <span>
          Fim do mês: <b className={cn("hv num font-semibold", end < 0 ? "text-out" : "text-ink")}>{formatBRL(end)}</b>
        </span>
      </figcaption>
      <ChartTable
        caption={`Saldo acumulado em ${monthLabel}`}
        columns={["Dia", "Saldo"]}
        rows={points.slice(1).map((v, i) => [`Dia ${i + 1}${i + 1 > cut ? " (previsto)" : ""}`, formatBRL(v)])}
      />
    </figure>
  );
}
