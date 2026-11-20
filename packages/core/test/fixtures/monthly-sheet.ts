/**
 * Fixtures de planilha GERADAS por código, com nomes e valores fictícios. Nenhum arquivo .xlsx entra no repositório.
 * - `buildMonthlySheets`: planilha mensal no formato da planilha da casa (abas Janeiro e Fevereiro).
 * - `modelToGrids`: converte o modelo de exportação em grade, como o app faz ao ler o .xlsx exportado com ExcelJS.
 */

import type { ModelValue, SheetModel, WorkbookModel } from "../../src/export/workbook-model.ts";
import type { Cell, SheetGrid } from "../../src/import/types.ts";

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function toExcelSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - EXCEL_EPOCH_UTC) / MS_PER_DAY);
}

function cellValue(value: ModelValue): Cell {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if ("formula" in value) return value.result;
  return toExcelSerial(value.date);
}

function parseAddress(address: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(address);
  if (!m) throw new Error(`Endereço inválido: ${address}`);
  const letters = m[1] as string;
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

export function modelToGrid(sheet: SheetModel): SheetGrid {
  const rows: Cell[][] = [];
  const set = (row: number, col: number, value: Cell): void => {
    while (rows.length <= row) rows.push([]);
    const line = rows[row] as Cell[];
    while (line.length <= col) line.push(null);
    line[col] = value;
  };
  for (const cell of sheet.cells) {
    const { col, row } = parseAddress(cell.address);
    set(row, col, cellValue(cell.value));
  }
  for (const table of sheet.tables) {
    const { col, row } = parseAddress(table.ref);
    for (const [i, name] of table.columns.entries()) set(row, col + i, name);
    for (const [r, values] of table.rows.entries()) {
      for (const [i, v] of values.entries()) set(row + 1 + r, col + i, cellValue(v));
    }
  }
  return { name: sheet.name, rows };
}

export function modelToGrids(model: WorkbookModel): SheetGrid[] {
  return model.sheets.map(modelToGrid);
}

/** Uma aba mensal fictícia: coluna B = item, C = valor, D = situação. */
function monthSheet(
  name: string,
  income: readonly [string, number][],
  expenses: readonly (readonly [string, number, string | null])[],
  saving: readonly [string, number][],
): SheetGrid {
  const rows: Cell[][] = [
    [null, "Orçamento"],
    [null, "Percentual da renda gasta", "Resumo"],
    [null, null, "Renda mensal total"],
    [null, null, income.reduce((a, [, v]) => a + v, 0)],
    [],
    [null, "Renda mensal"],
    [null, "Item", "Valor"],
    ...income.map(([item, value]): Cell[] => [null, item, value]),
    [],
    [null, "Despesas mensais"],
    [null, "Item", "Valor", "Situação"],
  ];
  for (const [item, value, status] of expenses) {
    if (item === "Apê") rows.push([null, "Apê", null, null]);
    else rows.push([null, item, value, status]);
  }
  rows.push(
    [],
    [null, "Economia mensal"],
    [null, "Item", "Valor"],
    ...saving.map(([item, value]): Cell[] => [null, item, value]),
  );
  return { name, rows };
}

/** Planilha mensal fictícia: Janeiro (passado) e Fevereiro, mais uma aba que deve ser ignorada. */
export function buildMonthlySheets(): SheetGrid[] {
  return [
    monthSheet(
      "Janeiro",
      [
        ["Salário Ana", 5200],
        ["Freela Bia", 800.5],
      ],
      [
        ["Aluguel", 1500, "pago"],
        ["Internet", 120, "Pix"],
        ["Cartão Azul", 900.75, "-"],
        ["Apê", 0, null],
        ["Taxa de obra 7/29", 1890, "pago"],
        ["Zerada", 0, "pago"],
      ],
      [["Reserva de emergência", 400]],
    ),
    monthSheet("Fevereiro", [["Salário Ana", 5200]], [["Aluguel", 1500, ""]], []),
    {
      name: "Resumo",
      rows: [
        [null, "Renda mensal"],
        [null, "Ignorada", 100],
      ],
    },
  ];
}
