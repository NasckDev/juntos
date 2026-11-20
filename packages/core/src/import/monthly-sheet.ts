import { MONTH_NAMES } from "../calendar.ts";
import { guessCategory } from "../categories.ts";
import type { Kind } from "../types.ts";
import { type Cell, type ImportItem, parseInstallment, type SheetGrid } from "./types.ts";

const INCOME_DAY = 5;
const EXPENSE_DAY = 10;

const SECTION_INCOME = /^renda mensal$/i;
const SECTION_EXPENSE = /^despesas? mensa(l|is)$/i;
const SECTION_SAVING = /^economias? mensa(l|is)$/i;
const SUBSECTION_APE = /^ap[êe]$/i;
/** Situações que não são meio de pagamento. */
const NOT_A_METHOD = /^(pago|-|usado|gasto|ofertado|descontado|recebido)$/;

function monthOfSheet(name: string): number {
  const wanted = name.trim().toLowerCase();
  return MONTH_NAMES.findIndex((m) => m.toLowerCase() === wanted) + 1;
}

function labelOf(cell: Cell | undefined): string {
  return typeof cell === "string" ? cell.trim().replace(/\s+/g, " ") : "";
}

function sectionKind(label: string): Kind | null {
  if (SECTION_INCOME.test(label)) return "in";
  if (SECTION_EXPENSE.test(label)) return "out";
  if (SECTION_SAVING.test(label)) return "save";
  return null;
}

function parseMonth(sheet: SheetGrid, month: number, year: number): ImportItem[] {
  const items: ImportItem[] = [];
  let kind: Kind = "in";
  let col = -1;
  for (const row of sheet.rows) {
    if (col < 0) {
      col = row.findIndex((c) => SECTION_INCOME.test(labelOf(c)));
      if (col < 0) continue;
    }
    const label = labelOf(row[col]);
    const value = row[col + 1] ?? null;
    const section = sectionKind(label);
    if (section) {
      kind = section;
      continue;
    }
    if (label && value === null && SUBSECTION_APE.test(label)) {
      kind = "out";
      continue;
    }
    if (!label || typeof value !== "number" || value <= 0) continue;
    const raw = row[col + 2];
    const statusText = typeof raw === "string" ? raw.trim() : "";
    const status = statusText.toLowerCase();
    const installment = parseInstallment(label);
    items.push({
      source: "monthly",
      year,
      month,
      day: kind === "in" ? INCOME_DAY : EXPENSE_DAY,
      kind,
      description: label,
      amount: Math.round(value * 100),
      status,
      paid: null,
      paymentMethod: statusText && !NOT_A_METHOD.test(status) ? statusText : "",
      categoryId: guessCategory(label, kind),
      whoName: "",
      note: "",
      installment: installment?.installment ?? null,
      installmentsTotal: installment?.total ?? null,
    });
  }
  return items;
}

/**
 * Planilha mensal: abas "Janeiro" a "Dezembro", cada uma com as seções Renda mensal, Despesas mensais (com
 * situação), Economia mensal e a subseção "Apê". Parcelas vêm no nome ("Taxa 7/29"). Abas de outro nome são ignoradas.
 */
export function parseMonthlySheet(sheets: readonly SheetGrid[], fileYear: number): ImportItem[] {
  return sheets.flatMap((sheet) => {
    const month = monthOfSheet(sheet.name);
    return month === 0 ? [] : parseMonth(sheet, month, fileYear);
  });
}
