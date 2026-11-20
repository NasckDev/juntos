import type { Cell, SheetGrid } from "@juntos/core";
import ExcelJS from "exceljs";
import { IMPORT_MESSAGES, MAX_IMPORT_BYTES } from "../validators/import";

/*
 * Leitura do .xlsx enviado (no servidor, com ExcelJS) e conversão de cada aba numa grade de células que o core
 * entende (`SheetGrid`): fórmulas viram o valor calculado guardado no arquivo e datas viram o número de série do
 * Excel. O arquivo é conferido antes: extensão, tipo informado pelo navegador, tamanho e assinatura ZIP.
 */

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/**
 * Navegadores sem o Office instalado às vezes mandam o .xlsx sem tipo ou como binário genérico; a assinatura
 * ZIP e a leitura pelo ExcelJS decidem nesses casos. Qualquer outro tipo declarado é recusado.
 */
const ACCEPTED_MIME = new Set([XLSX_MIME, "", "application/octet-stream"]);
/** Todo .xlsx é um ZIP: começa com "PK\x03\x04". */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;

/** Limites de leitura (uma planilha da casa tem 13 abas e poucas centenas de linhas). */
const MAX_SHEETS = 60;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 40;

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export interface UploadInfo {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

/** Mensagem de erro do upload, ou `null` se o arquivo pode ser lido. */
export function checkUpload(file: UploadInfo, bytes: Uint8Array | null = null): string | null {
  if (file.size === 0) return IMPORT_MESSAGES.missingFile;
  if (file.size > MAX_IMPORT_BYTES) return IMPORT_MESSAGES.tooBig;
  if (!/\.xlsx$/i.test(file.name.trim())) return IMPORT_MESSAGES.notXlsx;
  if (!ACCEPTED_MIME.has(file.type.toLowerCase())) return IMPORT_MESSAGES.notXlsx;
  if (bytes && !ZIP_SIGNATURE.every((byte, i) => bytes[i] === byte)) return IMPORT_MESSAGES.notXlsx;
  return null;
}

/** Data lida pelo ExcelJS (meia-noite UTC) → número de série do Excel. */
export function excelSerial(date: Date): number {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((day - EXCEL_EPOCH_UTC) / MS_PER_DAY);
}

/** Valor de uma célula do ExcelJS no formato do core. */
export function toGridCell(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "VERDADEIRO" : "FALSO";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : excelSerial(value);
  if ("error" in value) return null;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("hyperlink" in value) return value.text;
  if ("formula" in value || "sharedFormula" in value)
    return value.result === undefined ? null : toGridCell(value.result);
  return null;
}

/** Lê o .xlsx e devolve uma grade por aba. Arquivo que não abre lança `Error` (quem chama mostra a mensagem). */
export async function readWorkbook(bytes: Uint8Array): Promise<SheetGrid[]> {
  const workbook = new ExcelJS.Workbook();
  // O ExcelJS declara o próprio `Buffer` como um ArrayBuffer: entrega uma cópia exata dos bytes.
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  return workbook.worksheets.slice(0, MAX_SHEETS).map((sheet) => {
    const rows: Cell[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) return;
      const line: Cell[] = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber > MAX_COLUMNS) return;
        while (line.length < colNumber - 1) line.push(null);
        line[colNumber - 1] = toGridCell(cell.value);
      });
      while (rows.length < rowNumber - 1) rows.push([]);
      rows[rowNumber - 1] = line;
    });
    return { name: sheet.name, rows };
  });
}
