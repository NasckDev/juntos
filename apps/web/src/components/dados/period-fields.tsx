"use client";

import { MONTH_NAMES, type YearMonth, ymOf } from "@juntos/core";
import { Select } from "@/components/ui/select";

/** Anos oferecidos (`ymSel` do protótipo: 5 anos atrás até 2 à frente), mais o ano já escolhido se ficar fora. */
export function yearOptions(currentYear: number, ...extra: readonly number[]): number[] {
  const years = new Set<number>();
  for (let y = currentYear - 5; y <= currentYear + 2; y += 1) years.add(y);
  for (const y of extra) years.add(y);
  return [...years].sort((a, b) => a - b);
}

export interface MonthYearFieldProps {
  /** "De" ou "Até". */
  readonly label: string;
  /** "inicial" ou "final", para os rótulos dos leitores de tela. */
  readonly which: "inicial" | "final";
  readonly value: YearMonth;
  readonly years: readonly number[];
  readonly onChange: (value: YearMonth) => void;
  readonly invalid?: boolean;
}

/** Mês e ano em dois selects nativos, como no protótipo. */
export function MonthYearField({ label, which, value, years, onChange, invalid = false }: MonthYearFieldProps) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-muted">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <Select
          aria-label={`Mês ${which}`}
          aria-invalid={invalid || undefined}
          value={String(month)}
          options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
          onChange={(event) => onChange(ymOf(year, Number(event.target.value)))}
        />
        <Select
          aria-label={`Ano ${which}`}
          aria-invalid={invalid || undefined}
          value={String(year)}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          onChange={(event) => onChange(ymOf(Number(event.target.value), month))}
        />
      </div>
    </fieldset>
  );
}
