import { monthName, ymAdd, ymDiff, ymLabel } from "./calendar.ts";
import { SUBSCRIPTIONS_CATEGORY_ID } from "./categories.ts";
import { formatBRL } from "./money.ts";
import { yearlyDistance } from "./projection.ts";
import { totals } from "./totals.ts";
import type { Cents, Recurrence, Tx, YearMonth } from "./types.ts";

export type TipTone = "out" | "warn" | "in" | "save" | "muted";
export type TipIcon = "alert" | "chart" | "cal" | "rep";

export interface Tip {
  readonly tone: TipTone;
  readonly icon: TipIcon;
  readonly title: string;
  readonly body: string;
}

export interface TipsInput {
  /** Mês analisado (nas telas de período, o último mês do período). */
  readonly ym: YearMonth;
  /** Lançamentos do espaço (o mês analisado e o anterior são filtrados aqui dentro). */
  readonly txs: readonly Tx[];
  readonly recurrences: readonly Recurrence[];
}

export const MAX_TIPS = 3;
/** Conta fixa que subiu mais que isso (R$ 50) em relação ao mês anterior vira dica. */
export const PRICE_RISE_THRESHOLD: Cents = 5000;
/** Arredondamento do valor sugerido para guardar por mês (R$ 10). */
const SAVE_ROUNDING: Cents = 1000;
const INSTALLMENT_HORIZON_MONTHS = 6;
const YEARLY_HORIZON_MONTHS = 3;
const COMMITTED_WARNING_PERCENT = 90;

function byDayAndName(a: Tx, b: Tx): number {
  return a.day - b.day || a.description.localeCompare(b.description);
}

function balanceTip(list: readonly Tx[]): Tip | null {
  const t = totals(list);
  if (t.in <= 0) return null;
  if (t.left < 0) {
    return {
      tone: "out",
      icon: "alert",
      title: `As saídas passam das entradas em ${formatBRL(-t.left)}`,
      body: "Veja o que pode ficar para o mês que vem.",
    };
  }
  const pct = Math.round(((t.out + t.save) / t.in) * 100);
  if (pct < COMMITTED_WARNING_PERCENT) return null;
  return {
    tone: "warn",
    icon: "alert",
    title: `${pct}% do que entra já tem destino`,
    body: "Sobra pouco para imprevistos neste mês.",
  };
}

function priceRiseTip(list: readonly Tx[], previous: readonly Tx[], ym: YearMonth): Tip | null {
  let best: { name: string; rise: Cents } | null = null;
  for (const tx of list) {
    if (tx.kind !== "out" || tx.recurrenceId === null) continue;
    const before = previous.find((p) => p.recurrenceId === tx.recurrenceId);
    if (!before) continue;
    const rise = tx.amount - before.amount;
    if (rise > PRICE_RISE_THRESHOLD && (best === null || rise > best.rise)) best = { name: tx.description, rise };
  }
  if (!best) return null;
  return {
    tone: "warn",
    icon: "chart",
    title: `${best.name} subiu ${formatBRL(best.rise)}`,
    body: `Comparado com ${monthName(ymAdd(ym, -1)).toLowerCase()}.`,
  };
}

function installmentEndTip(recs: readonly Recurrence[], ym: YearMonth): Tip | null {
  const ending = recs
    .filter((r) => r.installmentsTotal !== null && !r.paused)
    .map((r) => ({ rec: r, left: (r.installmentsTotal ?? 0) - (ymDiff(r.start, ym) + 1) }))
    .filter((x) => x.left >= 0 && x.left <= INSTALLMENT_HORIZON_MONTHS)
    .sort((a, b) => a.left - b.left)[0];
  if (!ending) return null;
  return {
    tone: "in",
    icon: "cal",
    title: `${ending.rec.description} termina em ${ymLabel(ymAdd(ym, ending.left)).toLowerCase()}`,
    body: `Depois disso sobram ${formatBRL(ending.rec.amount)} a mais por mês.`,
  };
}

function yearlyTip(recs: readonly Recurrence[], ym: YearMonth): Tip | null {
  const next = recs
    .filter((r) => r.frequency === "yearly" && !r.paused)
    .map((r) => ({ rec: r, months: yearlyDistance(r, ym) }))
    .filter((x) => x.months <= YEARLY_HORIZON_MONTHS)
    .sort((a, b) => a.months - b.months)[0];
  if (!next) return null;
  const { rec, months } = next;
  const advice =
    months > 1
      ? `. Guardando ${formatBRL(Math.ceil(rec.amount / months / SAVE_ROUNDING) * SAVE_ROUNDING)} por mês até lá, ela não pesa.`
      : ". É no mês que vem: vale separar o valor agora.";
  return {
    tone: "save",
    icon: "cal",
    title: `${rec.description} chega em ${monthName(ymAdd(ym, months)).toLowerCase()}`,
    body: `Conta anual de ${formatBRL(rec.amount)}${advice}`,
  };
}

function subscriptionsTip(list: readonly Tx[]): Tip | null {
  const subs = list.filter((t) => t.categoryId === SUBSCRIPTIONS_CATEGORY_ID);
  if (subs.length < 2) return null;
  const yearly = subs.reduce((acc, t) => acc + t.amount, 0) * 12;
  return {
    tone: "muted",
    icon: "rep",
    title: `${subs.length} assinaturas somam ${formatBRL(yearly)} por ano`,
    body: `${subs.map((t) => t.description).join(", ")}.`,
  };
}

/** "Vale saber": até 3 dicas, pelas 6 regras do protótipo, na ordem em que aparecem. */
export function tips(input: TipsInput): Tip[] {
  const list = input.txs.filter((t) => t.competence === input.ym).sort(byDayAndName);
  const previous = input.txs.filter((t) => t.competence === ymAdd(input.ym, -1));
  const found = [
    balanceTip(list),
    priceRiseTip(list, previous, input.ym),
    installmentEndTip(input.recurrences, input.ym),
    yearlyTip(input.recurrences, input.ym),
    subscriptionsTip(list),
  ];
  return found.filter((t): t is Tip => t !== null).slice(0, MAX_TIPS);
}
