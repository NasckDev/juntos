import { isRealDate } from "../calendar.ts";
import { categoryByName, DEFAULT_CATEGORIES, guessCategory } from "../categories.ts";
import { parseMoney } from "../money.ts";
import type { Category, Kind } from "../types.ts";
import { type Cell, type ImportItem, parseInstallment } from "./types.ts";

export const DETAILED_SHEET_NAME = "Lançamentos";

const KIND_BY_LABEL: Readonly<Record<string, Kind>> = {
  entrada: "in",
  receita: "in",
  saída: "out",
  saida: "out",
  despesa: "out",
  guardado: "save",
  economia: "save",
  guardar: "save",
};

const HEADER_SCAN_ROWS = 10;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;
const PAID_STATUS = /conclu|pago|recebido/;
const DMY = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})/;

function norm(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

function text(cell: Cell | undefined): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Data como número de série do Excel, "dd/mm/aaaa" ou "aaaa-mm-dd". Data que não existe vira `null`. */
export function parseSheetDate(cell: Cell | undefined): DateParts | null {
  let parts: DateParts | null = null;
  if (typeof cell === "number") {
    if (!(cell >= 1)) return null;
    const d = new Date(EXCEL_EPOCH_UTC + Math.floor(cell) * MS_PER_DAY);
    parts = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  } else if (typeof cell === "string") {
    const br = DMY.exec(cell);
    const iso = YMD.exec(cell);
    if (br) parts = { year: Number(br[3]), month: Number(br[2]), day: Number(br[1]) };
    else if (iso) parts = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  }
  return parts && isRealDate(parts.year, parts.month, parts.day) ? parts : null;
}

function headerIndex(rows: readonly (readonly Cell[])[]): number {
  return rows.slice(0, HEADER_SCAN_ROWS).findIndex((row) => {
    const names = row.map((c) => norm(text(c)));
    return names.includes("data") && names.includes("descricao") && names.includes("valor");
  });
}

function amountOf(cell: Cell | undefined): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? Math.round(cell * 100) : null;
  return parseMoney(text(cell));
}

/**
 * Aba "Lançamentos" gerada pelo próprio app (colunas Data, Tipo, Descrição, Categoria, Valor, Situação, Pago com,
 * Quem, Parcela, Observação). Linhas sem data válida, descrição, valor maior que zero ou tipo reconhecido são ignoradas.
 */
export function parseDetailedSheet(
  rows: readonly (readonly Cell[])[],
  categories: readonly Category[] = DEFAULT_CATEGORIES,
): ImportItem[] {
  const headerAt = headerIndex(rows);
  if (headerAt < 0) return [];
  const header = (rows[headerAt] ?? []).map((c) => norm(text(c)));
  const at = (row: readonly Cell[], name: string): Cell | undefined => {
    const i = header.indexOf(name);
    return i < 0 ? undefined : row[i];
  };
  const items: ImportItem[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    const date = parseSheetDate(at(row, "data"));
    const description = text(at(row, "descricao"));
    const kind = KIND_BY_LABEL[text(at(row, "tipo")).toLowerCase()];
    const amount = amountOf(at(row, "valor"));
    if (!date || !description || !kind || amount === null || !(amount > 0)) continue;
    const category = categoryByName(text(at(row, "categoria")), kind, categories);
    const installment = parseInstallment(text(at(row, "parcela")));
    const status = text(at(row, "situacao")).toLowerCase();
    items.push({
      source: "detailed",
      year: date.year,
      month: date.month,
      day: date.day,
      kind,
      description,
      amount,
      status,
      paid: PAID_STATUS.test(status),
      paymentMethod: text(at(row, "pago com")),
      categoryId: category?.id ?? guessCategory(description, kind),
      whoName: text(at(row, "quem")),
      note: text(at(row, "observacao")),
      installment: installment?.installment ?? null,
      installmentsTotal: installment?.total ?? null,
    });
  }
  return items;
}
