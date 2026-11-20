import type { Cents, Kind } from "../types.ts";

/** Célula já lida da planilha (o app lê o .xlsx com ExcelJS; o core não depende de biblioteca de planilha). */
export type Cell = string | number | null;

/** Uma aba da planilha como grade de linhas e colunas. */
export interface SheetGrid {
  readonly name: string;
  readonly rows: readonly (readonly Cell[])[];
}

export type ImportSource = "monthly" | "detailed";

/** Uma linha candidata a virar lançamento, antes da revisão. */
export interface ImportItem {
  readonly source: ImportSource;
  /** Ano da planilha (mensal) ou do lançamento (detalhada). */
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly kind: Kind;
  readonly description: string;
  readonly amount: Cents;
  /** Situação como veio, em minúsculas ("pago", "-", um meio de pagamento...). */
  readonly status: string;
  /** Detalhada: situação já resolvida. Mensal: `null` (depende de "hoje" e do mês). */
  readonly paid: boolean | null;
  readonly paymentMethod: string;
  readonly categoryId: string;
  readonly whoName: string;
  readonly note: string;
  readonly installment: number | null;
  readonly installmentsTotal: number | null;
}

/** "7/29" (com ou sem espaços) em qualquer ponto do texto. */
export const INSTALLMENT_PATTERN = /(\d+)\s*\/\s*(\d+)/;

export function parseInstallment(text: string): { installment: number; total: number } | null {
  const m = INSTALLMENT_PATTERN.exec(text);
  return m ? { installment: Number(m[1]), total: Number(m[2]) } : null;
}
