import { daysIn, monthName, ymAdd } from "./calendar.ts";
import type { Cents, Kind, Tx, YearMonth } from "./types.ts";

export interface Totals {
  readonly in: Cents;
  readonly out: Cents;
  readonly save: Cents;
  readonly outPaid: Cents;
  readonly outDue: Cents;
  /** Sobra: entradas - saídas - guardado. */
  readonly left: Cents;
}

export function totals(txs: readonly Tx[]): Totals {
  let inn = 0;
  let out = 0;
  let save = 0;
  let outPaid = 0;
  let outDue = 0;
  for (const t of txs) {
    if (t.kind === "in") inn += t.amount;
    else if (t.kind === "save") save += t.amount;
    else {
      out += t.amount;
      if (t.paid) outPaid += t.amount;
      else outDue += t.amount;
    }
  }
  return { in: inn, out, save, outPaid, outDue, left: inn - out - save };
}

export interface CategoryTotal {
  readonly categoryId: string;
  readonly total: Cents;
}

/** Total por categoria do tipo informado, do maior para o menor (empate mantém a ordem de chegada). */
export function byCategory(txs: readonly Tx[], kind: Kind): CategoryTotal[] {
  const map = new Map<string, Cents>();
  for (const t of txs) if (t.kind === kind) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  return [...map].map(([categoryId, total]) => ({ categoryId, total })).sort((a, b) => b.total - a.total);
}

/** "Até hoje entrou X e saiu Y": só o que já foi recebido e o que já foi pago (saídas e guardado). */
export function receivedSoFar(txs: readonly Tx[]): { received: Cents; spent: Cents } {
  let received = 0;
  let spent = 0;
  for (const t of txs) {
    if (!t.paid) continue;
    if (t.kind === "in") received += t.amount;
    else spent += t.amount;
  }
  return { received, spent };
}

export interface DailyPoint {
  readonly day: number;
  readonly balance: Cents;
}

/** Saldo acumulado dia a dia do mês: ponto 0 é zero; entradas somam, saídas e guardado subtraem. */
export function dailyBalance(txs: readonly Tx[], ym: YearMonth): DailyPoint[] {
  const perDay = new Map<number, Cents>();
  for (const t of txs) {
    if (t.competence !== ym) continue;
    perDay.set(t.day, (perDay.get(t.day) ?? 0) + (t.kind === "in" ? t.amount : -t.amount));
  }
  const points: DailyPoint[] = [{ day: 0, balance: 0 }];
  let acc = 0;
  for (let day = 1; day <= daysIn(ym); day++) {
    acc += perDay.get(day) ?? 0;
    points.push({ day, balance: acc });
  }
  return points;
}

export interface Delta {
  /** Variação absoluta, em %, arredondada. */
  readonly percent: number;
  readonly direction: "up" | "down" | "same";
}

/** Variação em relação ao período anterior; `null` quando não há base de comparação (anterior zero). */
export function delta(cur: Cents, prev: Cents): Delta | null {
  if (prev === 0) return null;
  const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  return { percent: Math.abs(p), direction: p === 0 ? "same" : p > 0 ? "up" : "down" };
}

/** Frase da variação: "12% acima de outubro", "igual ao período anterior". Vazio sem base de comparação. */
export function deltaLabel(d: Delta | null, ym: YearMonth, period: boolean): string {
  if (!d) return "";
  const ref = period ? "período anterior" : monthName(ymAdd(ym, -1)).toLowerCase();
  if (d.direction === "same") return `${period ? "igual ao " : "igual a "}${ref}`;
  const word = d.direction === "up" ? "acima" : "abaixo";
  return `${d.percent}% ${word} ${period ? "do " : "de "}${ref}`;
}
