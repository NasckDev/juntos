import {
  FALLBACK_CATEGORY_ID,
  guessCategory,
  type IsoDate,
  isYearMonth,
  type Kind,
  MAX_SCREEN_SPAN,
  monthName,
  todayParts,
  type YearMonth,
  ymAdd,
} from "@juntos/core";
import type { CategoryView, TxView } from "@/server/services/finance-types";

/*
 * Regras de apresentação das telas financeiras, puras (cliente e servidor). As regras de negócio ficam no core.
 */

/** Categoria sugerida pelo nome (`guessCategory` do core devolve a chave da categoria padrão). */
export function suggestCategoryId(list: readonly CategoryView[], description: string, kind: Kind): string | null {
  const key = guessCategory(description, kind);
  const byKey = list.find((category) => category.key === key && category.kind === kind);
  if (byKey) return byKey.id;
  return list.find((category) => category.kind === kind)?.id ?? null;
}

/** Categoria pelo id, com "Outros" como reserva (igual ao `cat()` do protótipo). */
export function categoryOf(list: readonly CategoryView[], id: string): CategoryView {
  return (
    list.find((category) => category.id === id) ??
    list.find((category) => category.key === FALLBACK_CATEGORY_ID) ?? {
      id,
      key: FALLBACK_CATEGORY_ID,
      name: "Outros",
      icon: "caixa",
      hue: 222,
      kind: "out",
    }
  );
}

/** Cor da categoria nos gráficos (`catColor` do protótipo). */
export function categoryColor(category: Pick<CategoryView, "hue">): string {
  return `hsl(${category.hue} 52% 56%)`;
}

/**
 * Id que as regras do core entendem: a chave da categoria padrão ("assin") ou o próprio id nas categorias do
 * espaço. Necessário ao chamar `tips`, que reconhece as assinaturas pela chave.
 */
export function withCoreCategoryIds(list: readonly CategoryView[], txs: readonly TxView[]): TxView[] {
  const keys = new Map(list.map((category) => [category.id, category.key ?? category.id]));
  return txs.map((tx) => ({ ...tx, categoryId: keys.get(tx.categoryId) ?? tx.categoryId }));
}

/** Ordem do protótipo (`monthTx`): por dia e, no mesmo dia, por nome. */
export function byDayThenName(a: TxView, b: TxView): number {
  return a.competence.localeCompare(b.competence) || a.day - b.day || a.description.localeCompare(b.description);
}

export interface Period {
  readonly start: YearMonth;
  /** De 1 a 3 meses. */
  readonly span: number;
}

/** Lê `?mes=2026-11&meses=3` (mês inválido = mês de hoje; período limitado a 3 meses). */
export function parsePeriod(mes: unknown, meses: unknown, today: IsoDate): Period {
  const currentYm = todayParts(today).ym;
  const start = typeof mes === "string" && isYearMonth(mes) ? mes : currentYm;
  const n = typeof meses === "string" ? Number.parseInt(meses, 10) : 1;
  const span = Number.isInteger(n) ? Math.min(Math.max(n, 1), MAX_SCREEN_SPAN) : 1;
  return { start, span };
}

/** Meses do período, em ordem. */
export function periodMonthsOf(period: Period): YearMonth[] {
  return Array.from({ length: period.span }, (_, i) => ymAdd(period.start, i));
}

/** "novembro" ou "novembro a janeiro de 2027" (`perName` do protótipo). */
export function periodName(period: Period): string {
  if (period.span <= 1) return monthName(period.start).toLowerCase();
  const end = ymAdd(period.start, period.span - 1);
  const year = period.start.slice(0, 4) === end.slice(0, 4) ? "" : ` de ${end.slice(0, 4)}`;
  return `${monthName(period.start).toLowerCase()} a ${monthName(end).toLowerCase()}${year}`;
}

/** Rótulo do botão de pago (`chkBtn` do protótipo). */
export function paidLabel(tx: Pick<TxView, "kind" | "paid">): string {
  if (tx.kind === "in") return tx.paid ? "Recebido" : "Marcar como recebido";
  return tx.paid ? "Pago" : "Marcar como pago";
}

/** Sinal do valor na lista (`sign` do protótipo): entrada "+", saída "−", guardado sem sinal. */
export function signOf(kind: Kind): string {
  if (kind === "in") return "+ ";
  if (kind === "out") return "− ";
  return "";
}

/** Saudação pelo horário de São Paulo (`vGeral`). */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Primeiro nome, para a saudação. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
