import { MAX_EXPORT_SPAN, monthsBetween, ymDiff } from "../calendar.ts";
import type { Kind, Tx, YearMonth } from "../types.ts";

export type ExportStatus = "all" | "paid" | "open";

export interface ExportFilter {
  readonly from: YearMonth;
  readonly to: YearMonth;
  readonly kinds: readonly Kind[];
  readonly status: ExportStatus;
  /** Id do membro (`paidBy`); `null` = todos. */
  readonly who: string | null;
  /** Vazio = todas as categorias. */
  readonly categoryIds: readonly string[];
}

/** Predicado dos filtros de tipo, situação, pessoa e categoria (o período é tratado em {@link filterForExport}). */
export function exportFilter(filter: ExportFilter): (tx: Tx) => boolean {
  return (tx) => {
    if (!filter.kinds.includes(tx.kind)) return false;
    if (filter.categoryIds.length > 0 && !filter.categoryIds.includes(tx.categoryId)) return false;
    if (filter.status === "paid" && !tx.paid) return false;
    if (filter.status === "open" && tx.paid) return false;
    if (filter.who !== null && tx.paidBy !== filter.who) return false;
    return true;
  };
}

/** Mensagem de erro do período/tipos (textos do protótipo), ou `null` se está tudo certo. Máximo de 36 meses. */
export function validateExportRange(filter: ExportFilter): string | null {
  if (filter.from > filter.to) return "O mês inicial vem depois do final. Ajuste o período.";
  if (ymDiff(filter.from, filter.to) >= MAX_EXPORT_SPAN) return "Escolha no máximo 36 meses por vez.";
  if (filter.kinds.length === 0) return "Marque pelo menos um tipo de lançamento.";
  return null;
}

/** Meses do período (vazio se o período é inválido; nunca passa de 36). */
export function exportMonths(filter: ExportFilter): YearMonth[] {
  return monthsBetween(filter.from, filter.to).slice(0, MAX_EXPORT_SPAN);
}

/** Lançamentos a exportar, por mês, dia e descrição. Período inválido não exporta nada. */
export function filterForExport(filter: ExportFilter, txs: readonly Tx[]): Tx[] {
  if (validateExportRange(filter) !== null) return [];
  const months = new Set(exportMonths(filter));
  const keep = exportFilter(filter);
  return txs
    .filter((t) => months.has(t.competence) && keep(t))
    .sort(
      (a, b) => a.competence.localeCompare(b.competence) || a.day - b.day || a.description.localeCompare(b.description),
    );
}
