"use client";

import { type Cents, formatBRL, monthName, type YearMonth } from "@juntos/core";
import { cn } from "@/lib/cn";
import { ChartTable } from "./chart-table";
import { axisLabel, niceTicks } from "./scale";

export interface MonthBarsRow {
  ym: YearMonth;
  /** Entrou no mês. */
  income: Cents;
  /** Saiu e guardou no mês. */
  outflow: Cents;
}

export interface MonthBarsProps {
  rows: readonly MonthBarsRow[];
  /** Mês de hoje: meses depois dele são previsão (barras hachuradas). */
  currentYm: YearMonth;
  /** Mês ou meses destacados. */
  selected?: YearMonth | readonly YearMonth[];
  /** Com callback, cada coluna escolhe o mês (Relatórios); sem, só mostra a dica. */
  onSelect?: (ym: YearMonth) => void;
  /** Rótulo do eixo X (padrão: "Jan", "Fev"…). */
  labelFor?: (ym: YearMonth) => string;
  /** Título curto para a tabela e o grupo ("Entradas e saídas, mês a mês em 2026"). */
  title: string;
  className?: string;
}

// Previsão: barra hachurada com contorno, para não depender só de transparência.
const HATCH_IN =
  "bg-[repeating-linear-gradient(135deg,var(--in)_0_3px,transparent_3px_6px)] shadow-[inset_0_0_0_1.5px_var(--in)]";
const HATCH_OUT =
  "bg-[repeating-linear-gradient(135deg,var(--out)_0_3px,transparent_3px_6px)] shadow-[inset_0_0_0_1.5px_var(--out)]";

function monthLabel(ym: YearMonth): string {
  return monthName(ym).slice(0, 3);
}

function describe(row: MonthBarsRow, forecast: boolean): string {
  const left = row.income - row.outflow;
  const name = `${monthName(row.ym)} ${row.ym.slice(0, 4)}`;
  return `${name}${forecast ? ", previsão" : ""}: entrou ${formatBRL(row.income)}, saiu e guardou ${formatBRL(row.outflow)}, ${left >= 0 ? "sobrou" : "faltou"} ${formatBRL(Math.abs(left))}`;
}

/** Entradas × saídas por mês (`barsChart` do protótipo), com eixo redondo, dica no mouse, toque e foco. */
export function MonthBars({
  rows,
  currentYm,
  selected,
  onSelect,
  labelFor = monthLabel,
  title,
  className,
}: MonthBarsProps) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.outflow)));
  const { top, ticks } = niceTicks(max);
  const hasForecast = rows.some((r) => r.ym > currentYm);
  const isSelected = (ym: YearMonth) => (Array.isArray(selected) ? selected.includes(ym) : selected === ym);
  const pct = (v: Cents) => `${((v / top) * 100).toFixed(2)}%`;

  return (
    <figure className={cn("min-w-0", className)}>
      <div className="flex h-56 gap-2 lg:h-64">
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
        <div className="relative min-w-0 flex-1">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-6">
            {ticks.map((t) => (
              <i
                key={t}
                className={cn("absolute inset-x-0 border-t", t === 0 ? "border-line2" : "border-dashed border-line")}
                style={{ bottom: pct(t) }}
              />
            ))}
          </div>
          <ul aria-label={title} className="absolute inset-0 flex">
            {rows.map((row, i) => {
              const forecast = row.ym > currentYm;
              const sel = isSelected(row.ym);
              const left = row.income - row.outflow;
              const edge = i === 0 ? "left-0" : i === rows.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <li key={row.ym} className="relative flex min-w-0 flex-1">
                  <button
                    type="button"
                    aria-label={describe(row, forecast)}
                    aria-pressed={onSelect ? sel : undefined}
                    onClick={onSelect ? () => onSelect(row.ym) : undefined}
                    className={cn(
                      "group relative flex min-w-0 flex-1 flex-col items-center rounded-lg",
                      onSelect ? "cursor-pointer" : "cursor-default",
                      sel && "bg-brand-soft",
                    )}
                  >
                    <span className="flex min-h-0 w-full flex-1 items-end justify-center gap-[3px] px-[18%]">
                      <i
                        className={cn("block w-1/2 max-w-4 rounded-t-[3px]", forecast ? HATCH_IN : "bg-in")}
                        style={{ height: pct(row.income) }}
                      />
                      <i
                        className={cn("block w-1/2 max-w-4 rounded-t-[3px]", forecast ? HATCH_OUT : "bg-out")}
                        style={{ height: pct(row.outflow) }}
                      />
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-6 items-end text-xs text-muted",
                        // com muitos meses no celular, mostra um rótulo sim e um não (o selecionado sempre)
                        rows.length > 6 && i % 2 === 1 && !sel && "max-sm:invisible",
                        sel && "font-bold text-brand-text",
                      )}
                    >
                      {labelFor(row.ym)}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute bottom-[calc(100%+0.25rem)] z-10 hidden w-max min-w-44 rounded-field bg-ink px-3 py-2 text-left text-xs text-surface shadow-pop",
                        "group-hover:block group-focus:block",
                        edge,
                      )}
                    >
                      <b className="mb-1 block text-sm">
                        {monthName(row.ym)} {row.ym.slice(0, 4)}
                        {forecast ? ", previsão" : ""}
                      </b>
                      <span className="flex justify-between gap-4">
                        Entrou <em className="hv num not-italic">{formatBRL(row.income)}</em>
                      </span>
                      <span className="flex justify-between gap-4">
                        Saiu e guardou <em className="hv num not-italic">{formatBRL(row.outflow)}</em>
                      </span>
                      <span className="mt-1 flex justify-between gap-4 border-t border-white/20 pt-1 font-semibold">
                        {left >= 0 ? "Sobrou" : "Faltou"}
                        <em className="hv num not-italic">
                          {left < 0 ? "− " : ""}
                          {formatBRL(Math.abs(left))}
                        </em>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <i aria-hidden="true" className="size-2.5 rounded-[0.2rem] bg-in" />
          Entrou
        </span>
        <span className="flex items-center gap-1.5">
          <i aria-hidden="true" className="size-2.5 rounded-[0.2rem] bg-out" />
          Saiu e guardou
        </span>
        {hasForecast ? (
          <span className="flex items-center gap-1.5">
            <i
              aria-hidden="true"
              className="size-2.5 rounded-[0.2rem] bg-[repeating-linear-gradient(135deg,var(--muted)_0_2px,transparent_2px_4px)]"
            />
            Previsão
          </span>
        ) : null}
        <span className="ml-auto text-xs">
          {onSelect ? "Toque num mês para ver o resumo dele" : "Passe o mouse ou toque num mês para ver os valores"}
        </span>
      </figcaption>
      <ChartTable
        caption={title}
        columns={["Mês", "Entrou", "Saiu e guardou", "Sobra"]}
        rows={rows.map((r) => [
          `${monthName(r.ym)} ${r.ym.slice(0, 4)}${r.ym > currentYm ? " (previsão)" : ""}`,
          formatBRL(r.income),
          formatBRL(r.outflow),
          formatBRL(r.income - r.outflow),
        ])}
      />
    </figure>
  );
}
