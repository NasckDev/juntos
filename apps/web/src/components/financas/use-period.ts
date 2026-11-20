"use client";

import { type IsoDate, todayParts, type YearMonth } from "@juntos/core";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { type Period, parsePeriod } from "@/lib/finance";

const PERIOD_PARAMS = { mes: parseAsString, meses: parseAsInteger };

/**
 * Mês ou período da tela, guardado na URL (`?mes=2026-11&meses=3`). Mudar refaz a página no servidor
 * (`shallow: false`), que lança as contas fixas do mês aberto e traz os números.
 */
export function usePeriod(today: IsoDate): {
  readonly period: Period;
  readonly currentYm: YearMonth;
  readonly setPeriod: (next: Period) => void;
} {
  const [query, setQuery] = useQueryStates(PERIOD_PARAMS, { shallow: false, scroll: false });
  const currentYm = todayParts(today).ym;
  const period = parsePeriod(query.mes ?? undefined, query.meses === null ? undefined : String(query.meses), today);
  function setPeriod(next: Period) {
    void setQuery({ mes: next.start === currentYm ? null : next.start, meses: next.span > 1 ? next.span : null });
  }
  return { period, currentYm, setPeriod };
}
