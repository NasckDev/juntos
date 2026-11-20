import { monthName, todayParts, ymAdd, ymDiff, ymLabel } from "./calendar.ts";
import { formatBRL } from "./money.ts";
import { missingForMonth } from "./recurrence.ts";
import { totals } from "./totals.ts";
import type { Cents, IsoDate, Recurrence, Tx, YearMonth } from "./types.ts";

export const PROJECTION_MONTHS = 6;
/** Meses passados usados na média dos gastos variáveis. */
export const VARIABLE_LOOKBACK_MONTHS = 3;

export interface ProjectionRow {
  readonly ym: YearMonth;
  readonly in: Cents;
  /** Contas já lançadas (ou que as fixas vão lançar) no mês. */
  readonly fixed: Cents;
  /** Média de variáveis ainda não lançada no mês. */
  readonly variable: Cents;
  readonly save: Cents;
  readonly out: Cents;
  readonly left: Cents;
  readonly accumulated: Cents;
}

export interface Projection {
  readonly rows: readonly ProjectionRow[];
  readonly variableAverage: Cents;
  /** Sobra acumulada ao fim do horizonte. */
  readonly accumulated: Cents;
  readonly tightest: ProjectionRow | null;
  /** Falso quando não há entradas nem contas fixas para projetar. */
  readonly hasData: boolean;
}

export interface ProjectionInput {
  readonly txs: readonly Tx[];
  readonly recurrences: readonly Recurrence[];
  readonly today: IsoDate;
  readonly months?: number;
}

function variableOut(txs: readonly Tx[], ym: YearMonth): Cents {
  return txs
    .filter((t) => t.competence === ym && t.kind === "out" && t.recurrenceId === null)
    .reduce((acc, t) => acc + t.amount, 0);
}

/** Média dos gastos variáveis (saídas fora de conta fixa) dos 3 meses anteriores que têm algum. */
export function variableAverage(txs: readonly Tx[], today: IsoDate): Cents {
  const current = todayParts(today).ym;
  const perMonth = [1, 2, 3].map((n) => {
    const ym = ymAdd(current, -n);
    return {
      total: variableOut(txs, ym),
      has: txs.some((t) => t.competence === ym && t.kind === "out" && t.recurrenceId === null),
    };
  });
  const withData = perMonth.filter((m) => m.has);
  return withData.length ? Math.round(withData.reduce((a, m) => a + m.total, 0) / withData.length) : 0;
}

/**
 * Projeção dos próximos meses: o que já está lançado (mais o que as contas fixas ainda vão lançar) e a média dos
 * variáveis menos o variável já lançado em cada mês.
 */
export function projectMonths(input: ProjectionInput): Projection {
  const horizon = input.months ?? PROJECTION_MONTHS;
  const current = todayParts(input.today).ym;
  const average = variableAverage(input.txs, input.today);
  let accumulated = 0;
  const rows: ProjectionRow[] = [];
  for (let n = 1; n <= horizon; n++) {
    const ym = ymAdd(current, n);
    const monthTxs = input.txs.filter((t) => t.competence === ym);
    const pending = missingForMonth(input.recurrences, input.txs, ym, input.today).map((t, i) => ({
      ...t,
      id: `pending-${ym}-${i}`,
    }));
    const base = totals([...monthTxs, ...pending]);
    const variable = Math.max(average - variableOut(input.txs, ym), 0);
    const left = base.left - variable;
    accumulated += left;
    rows.push({
      ym,
      in: base.in,
      fixed: base.out,
      variable,
      save: base.save,
      out: base.out + variable,
      left,
      accumulated,
    });
  }
  const tightest = rows.reduce<ProjectionRow | null>(
    (worst, r) => (worst === null || r.left < worst.left ? r : worst),
    null,
  );
  return {
    rows,
    variableAverage: average,
    accumulated,
    tightest,
    hasData: rows.some((r) => r.in > 0 || r.fixed > 0),
  };
}

export interface UpcomingChange {
  readonly monthsAhead: number;
  readonly tone: "in" | "warn";
  readonly icon: "check" | "cal";
  readonly title: string;
  readonly body: string;
}

/** Distância em meses até a próxima ocorrência anual (0 conta como daqui a 12). */
export function yearlyDistance(rec: Recurrence, ym: YearMonth): number {
  let d = ymDiff(ym, rec.start) % 12;
  if (d <= 0) d += 12;
  return d;
}

/** "O que muda no caminho": parcelas que terminam (em até 12 meses) e contas anuais que chegam (em até 6). */
export function upcomingChanges(recurrences: readonly Recurrence[], today: IsoDate): UpcomingChange[] {
  const current = todayParts(today).ym;
  const changes: UpcomingChange[] = [];
  for (const rec of recurrences) {
    if (rec.paused) continue;
    if (rec.installmentsTotal !== null) {
      const end = ymAdd(rec.start, rec.installmentsTotal - 1);
      const d = ymDiff(current, end);
      if (d >= 0 && d <= 12) {
        changes.push({
          monthsAhead: d,
          tone: "in",
          icon: "check",
          title: `${rec.description} termina em ${ymLabel(end).toLowerCase()}`,
          body: `Libera ${formatBRL(rec.amount)} por mês a partir de ${monthName(ymAdd(end, 1)).toLowerCase()}.`,
        });
      }
    }
    if (rec.frequency === "yearly") {
      const d = yearlyDistance(rec, current);
      if (d <= 6) {
        changes.push({
          monthsAhead: d,
          tone: "warn",
          icon: "cal",
          title: `${rec.description} em ${ymLabel(ymAdd(current, d)).toLowerCase()}`,
          body: `Conta anual de ${formatBRL(rec.amount)}.`,
        });
      }
    }
  }
  return changes.sort((a, b) => a.monthsAhead - b.monthsAhead);
}
