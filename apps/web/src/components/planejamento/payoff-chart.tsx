"use client";

import { type Cents, formatBRL, type PayoffRun } from "@juntos/core";
import { useId, useState } from "react";
import { ChartTable } from "@/components/charts/chart-table";
import { axisLabel, niceTicks } from "@/components/charts/scale";
import { cn } from "@/lib/cn";

export interface PayoffChartProps {
  /** Só a parcela. */
  readonly baseline: PayoffRun;
  /** Parcela mais o valor extra. */
  readonly withExtra: PayoffRun;
  readonly principal: Cents;
  readonly extra: Cents;
}

/** "2 anos e 3 meses", "8 meses", "1 mês". */
export function durationLabel(months: number): string {
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years > 1 ? "anos" : "ano"}`;
  return rest ? `${y} e ${rest} ${rest > 1 ? "meses" : "mês"}` : y;
}

/** Pontos do traçado em porcentagem do quadro (x: tempo, y: saldo), no máximo ~120 pontos. */
function pointsOf(curve: readonly Cents[], horizon: number, top: Cents): string {
  const step = Math.max(1, Math.ceil(curve.length / 120));
  const indexes: number[] = [];
  for (let i = 0; i < curve.length; i += step) indexes.push(i);
  const last = curve.length - 1;
  if (indexes[indexes.length - 1] !== last) indexes.push(last);
  return indexes
    .map((i) => `${((i / horizon) * 100).toFixed(2)},${(100 - ((curve[i] ?? 0) / top) * 100).toFixed(2)}`)
    .join(" ");
}

function balanceAt(curve: readonly Cents[], month: number): Cents {
  return curve[Math.min(month, curve.length - 1)] ?? 0;
}

/**
 * Saldo devedor ao longo do tempo (`simOut` do protótipo): eixo com valores redondos, duas linhas (só a parcela,
 * pontilhada; parcela mais extra, cheia), uma barra de deslizar para ler o saldo em qualquer mês (mouse, toque e
 * setas do teclado) e a tabela com os mesmos números.
 */
export function PayoffChart({ baseline, withExtra, principal, extra }: PayoffChartProps) {
  const sliderId = useId();
  const horizon = Math.max(baseline.months, 1);
  const [month, setMonth] = useState(0);
  const at = Math.min(month, horizon);
  const { top, ticks } = niceTicks(principal);
  const pct = (value: Cents) => `${((value / top) * 100).toFixed(2)}%`;
  const hasExtra = extra > 0;
  const summary = `Saldo devedor ao longo do tempo. Só com a parcela, quita em ${durationLabel(baseline.months)}${
    hasExtra ? `; com ${formatBRL(extra)} a mais por mês, quita em ${durationLabel(withExtra.months)}` : ""
  }.`;

  // Tabela: um ponto por ano (e o último mês).
  const tableMonths: number[] = [];
  for (let m = 0; m < horizon; m += 12) tableMonths.push(m);
  tableMonths.push(horizon);

  return (
    <figure className="min-w-0">
      <div role="img" aria-label={summary} className="flex h-56 gap-2 lg:h-64">
        <div
          aria-hidden="true"
          className="relative w-[4.5rem] shrink-0 text-right text-xs whitespace-nowrap text-muted"
        >
          <div className="absolute inset-x-0 top-0 bottom-6">
            {ticks.map((t) => (
              <span key={t} className="num absolute right-0 translate-y-1/2" style={{ bottom: pct(t) }}>
                {axisLabel(t)}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 flex-1" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 bottom-6">
            {ticks.map((t) => (
              <i
                key={t}
                className={cn("absolute inset-x-0 border-t", t === 0 ? "border-line2" : "border-dashed border-line")}
                style={{ bottom: pct(t) }}
              />
            ))}
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
            >
              <polyline
                fill="none"
                stroke="var(--muted)"
                strokeWidth={2.5}
                strokeDasharray="2 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={pointsOf(baseline.curve, horizon, top)}
              />
              {hasExtra ? (
                <polyline
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points={pointsOf(withExtra.curve, horizon, top)}
                />
              ) : null}
            </svg>
            <i className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${(at / horizon) * 100}%` }} />
          </div>
          <span className="absolute bottom-0 left-0 flex h-6 items-end text-xs text-muted">Hoje</span>
          <span className="absolute right-0 bottom-0 flex h-6 items-end text-xs text-muted">
            {durationLabel(baseline.months)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={sliderId} className="text-sm font-medium">
          Ver o saldo daqui a <b>{at === 0 ? "hoje" : durationLabel(at)}</b>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={horizon}
          step={1}
          value={at}
          onChange={(event) => setMonth(Number(event.target.value))}
          aria-valuetext={`${at === 0 ? "Hoje" : durationLabel(at)}: ${formatBRL(balanceAt(baseline.curve, at))} só com a parcela${
            hasExtra ? `, ${formatBRL(balanceAt(withExtra.curve, at))} com o valor extra` : ""
          }`}
          className="mt-2 block h-6 w-full accent-[var(--brand)]"
        />
        <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm" aria-live="polite">
          <span>
            Só a parcela: <b className="hv num">{formatBRL(balanceAt(baseline.curve, at))}</b>
          </span>
          {hasExtra ? (
            <span>
              Parcela mais extra: <b className="hv num">{formatBRL(balanceAt(withExtra.curve, at))}</b>
            </span>
          ) : null}
        </p>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <i aria-hidden="true" className="size-2.5 rounded-full bg-muted" />
          Pontilhada: só a parcela
        </span>
        {hasExtra ? (
          <span className="flex items-center gap-1.5">
            <i aria-hidden="true" className="size-2.5 rounded-full bg-brand" />
            Cheia: parcela mais o valor extra
          </span>
        ) : null}
      </figcaption>

      <ChartTable
        caption="Saldo devedor ao longo do tempo"
        columns={hasExtra ? ["Daqui a", "Só a parcela", "Com valor extra"] : ["Daqui a", "Só a parcela"]}
        rows={tableMonths.map((m) => [
          m === 0 ? "Hoje" : durationLabel(m),
          formatBRL(balanceAt(baseline.curve, m)),
          ...(hasExtra ? [formatBRL(balanceAt(withExtra.curve, m))] : []),
        ])}
      />
    </figure>
  );
}
