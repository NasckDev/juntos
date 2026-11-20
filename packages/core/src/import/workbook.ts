import { DEFAULT_CATEGORIES } from "../categories.ts";
import type { Category } from "../types.ts";
import { DETAILED_SHEET_NAME, parseDetailedSheet } from "./detailed.ts";
import { parseMonthlySheet } from "./monthly-sheet.ts";
import type { ImportItem, ImportSource, SheetGrid } from "./types.ts";

export interface ParsedWorkbook {
  readonly source: ImportSource;
  readonly items: ImportItem[];
}

/** Ano citado no nome do arquivo ("Gasto 2025.xlsx"), ou `fallbackYear`. */
export function yearFromFileName(fileName: string, fallbackYear: number): number {
  const m = /(20\d\d)/.exec(fileName);
  return m ? Number(m[1]) : fallbackYear;
}

/**
 * Reconhece o formato: se existe a aba "Lançamentos" é o arquivo do próprio app; senão, a planilha mensal.
 * Lista vazia de itens = nenhum formato reconhecido.
 */
export function parseWorkbook(
  sheets: readonly SheetGrid[],
  fileYear: number,
  categories: readonly Category[] = DEFAULT_CATEGORIES,
): ParsedWorkbook {
  const detailed = sheets.find((s) => s.name.trim().toLowerCase() === DETAILED_SHEET_NAME.toLowerCase());
  if (detailed) return { source: "detailed", items: parseDetailedSheet(detailed.rows, categories) };
  return { source: "monthly", items: parseMonthlySheet(sheets, fileYear) };
}
