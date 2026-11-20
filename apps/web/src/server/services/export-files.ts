import {
  byCategory,
  type Category,
  categoryById,
  type ExportFilter,
  formatBRL,
  type Member,
  type ModelFont,
  type ModelValue,
  type Tx,
  todayInSaoPaulo,
  totals,
  type WorkbookModel,
  ymLabel,
} from "@juntos/core";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

/*
 * Renderização dos arquivos de exportação. Recebe dados já filtrados; não acessa banco.
 * - xlsx: o modelo puro do core (`buildWorkbookModel`) célula por célula, com fórmulas, tabelas e formatos.
 * - PDF: o relatório do protótipo (`buildPdf`): resumo, saídas por categoria e a lista, com rodapé paginado.
 * - CSV: BOM + ";" (abre direto no Excel em pt-BR), uma linha por lançamento.
 */

const KIND_LABEL = { in: "Entrada", out: "Saída", save: "Guardado" } as const;

// ---------------------------------------------------------------- xlsx

type TableTheme = NonNullable<NonNullable<ExcelJS.TableProperties["style"]>["theme"]>;

function isTableTheme(value: string): value is TableTheme {
  return /^TableStyle(Light|Medium|Dark)\d{1,2}$/.test(value);
}

function parseAddress(address: string): { row: number; col: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match?.[1] || !match[2]) throw new RangeError(`Endereço de célula inválido: ${address}`);
  let col = 0;
  for (const ch of match[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]), col };
}

function toCellValue(value: ModelValue): ExcelJS.CellValue {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  if ("formula" in value) return { formula: value.formula, result: value.result };
  const [year, month, day] = value.date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function toFont(font: ModelFont): Partial<ExcelJS.Font> {
  return {
    name: font.name,
    size: font.size,
    ...(font.bold ? { bold: true } : {}),
    ...(font.color ? { color: { argb: font.color } } : {}),
  };
}

/** Desenha o modelo do core numa planilha do ExcelJS e devolve o .xlsx. */
export async function renderXlsx(model: WorkbookModel, generatedAt: Date): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = model.creator;
  workbook.created = generatedAt;
  for (const sheet of model.sheets) {
    const view: Partial<ExcelJS.WorksheetView> =
      sheet.frozenRows > 0
        ? { state: "frozen", ySplit: sheet.frozenRows, showGridLines: sheet.showGridLines }
        : { showGridLines: sheet.showGridLines };
    const ws = workbook.addWorksheet(sheet.name, { views: [view] });
    ws.columns = sheet.columns.map((column) => ({ width: column.width }));

    for (const table of sheet.tables) {
      const { row, col } = parseAddress(table.ref);
      ws.addTable({
        name: table.name,
        ref: table.ref,
        headerRow: true,
        style: { ...(isTableTheme(table.style) ? { theme: table.style } : {}), showRowStripes: true },
        columns: table.columns.map((name) => ({ name, filterButton: false })),
        rows: table.rows.map((values) => values.map(toCellValue)),
      });
      table.rows.forEach((values, r) => {
        values.forEach((_, c) => {
          const cell = ws.getCell(row + 1 + r, col + c);
          cell.font = toFont(table.font);
          const format = table.columnFormats[c];
          if (format) cell.numFmt = format;
        });
      });
    }

    for (const modelCell of sheet.cells) {
      const cell = ws.getCell(modelCell.address);
      cell.value = toCellValue(modelCell.value);
      if (modelCell.numFmt) cell.numFmt = modelCell.numFmt;
      if (modelCell.font) cell.font = toFont(modelCell.font);
    }

    if (sheet.headerRow) {
      const { font, fill } = sheet.headerRow;
      ws.getRow(1).eachCell((cell) => {
        cell.font = toFont(font);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      });
    }
    if (sheet.autoFilter) ws.autoFilter = { from: sheet.autoFilter.from, to: sheet.autoFilter.to };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ---------------------------------------------------------------- PDF

/** As fontes padrão do PDF só têm o Latin-1: troca o que não existe nelas por um equivalente. */
/** Troca por código (espaço fino e inquebrável, sinais de menos e travessões, aspas curvas, reticências). */
const PDF_REPLACEMENTS: ReadonlyMap<number, string> = new Map([
  [0x00a0, " "],
  [0x202f, " "],
  [0x2212, "-"],
  [0x2013, "-"],
  [0x2014, "-"],
  [0x201c, '"'],
  [0x201d, '"'],
  [0x2018, "'"],
  [0x2019, "'"],
  [0x2026, "..."],
]);
/** Último caractere das fontes padrão do PDF (Latin-1). */
const LATIN1_MAX = 0xff;

export function pdfText(text: string): string {
  return Array.from(text, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return PDF_REPLACEMENTS.get(code) ?? (code > LATIN1_MAX ? "?" : ch);
  }).join("");
}

const money = (cents: number): string => pdfText(formatBRL(cents));

function brDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export interface PdfInput {
  readonly txs: readonly Tx[];
  readonly filter: ExportFilter;
  readonly categories: readonly Category[];
  readonly members: readonly Member[];
  readonly spaceName: string;
  readonly generatedAt: Date;
}

function filterNotes(input: PdfInput): string[] {
  const { filter } = input;
  const notes: string[] = [];
  if (filter.kinds.length < 3) notes.push(`Tipos: ${filter.kinds.map((k) => KIND_LABEL[k]).join(", ")}`);
  if (filter.status !== "all") notes.push(filter.status === "paid" ? "Só pagos ou recebidos" : "Só em aberto");
  if (filter.who !== null) notes.push(`Quem: ${input.members.find((m) => m.id === filter.who)?.name ?? "-"}`);
  if (filter.categoryIds.length > 0) {
    notes.push(`Categorias: ${filter.categoryIds.map((id) => categoryById(id, input.categories).name).join(", ")}`);
  }
  return notes;
}

const INK: [number, number, number] = [15, 17, 23];
const MUTED: [number, number, number] = [88, 93, 107];
const MARGIN = 40;

/** Relatório em PDF (A4, em pontos), como o `buildPdf` do protótipo. */
export function renderPdf(input: PdfInput): Uint8Array<ArrayBuffer> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const t = totals(input.txs);
  const { from, to } = input.filter;
  const period = `${ymLabel(from)}${from !== to ? ` a ${ymLabel(to)}` : ""}`;
  const notes = filterNotes(input);

  doc.setProperties({ title: pdfText(`Relatório de lançamentos - ${input.spaceName}`), creator: "Juntos" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(pdfText("Relatório de lançamentos"), MARGIN, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const generated = brDate(todayInSaoPaulo(input.generatedAt));
  doc.text(pdfText(`${input.spaceName}  ·  ${period}  ·  gerado em ${generated}`), MARGIN, 70);
  if (notes.length > 0)
    doc.text(doc.splitTextToSize(pdfText(`Filtros: ${notes.join("; ")}`), width - 2 * MARGIN), MARGIN, 86);

  const top = notes.length > 0 ? 108 : 92;
  const boxWidth = (width - 2 * MARGIN - 30) / 4;
  const boxes: readonly [string, number][] = [
    ["Entradas", t.in],
    ["Saídas", t.out],
    ["Guardado", t.save],
    ["Saldo", t.left],
  ];
  boxes.forEach(([label, value], i) => {
    const x = MARGIN + i * (boxWidth + 10);
    doc.setDrawColor(230, 231, 236);
    doc.setFillColor(247, 247, 250);
    doc.roundedRect(x, top, boxWidth, 46, 6, 6, "FD");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(label), x + 10, top + 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(money(value), x + 10, top + 35);
    doc.setFont("helvetica", "normal");
  });

  let y = top + 70;
  const byCat = byCategory(input.txs, "out");
  if (byCat.length > 0 && t.out > 0) {
    autoTable(doc, {
      startY: y,
      head: [[pdfText("Saídas por categoria"), "Valor", "%"]],
      body: byCat.map((c) => [
        pdfText(categoryById(c.categoryId, input.categories).name),
        money(c.total),
        `${Math.round((c.total * 100) / t.out)}%`,
      ]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 4, textColor: INK },
      headStyles: { fontStyle: "bold", textColor: MUTED, lineWidth: { bottom: 0.6 }, lineColor: [220, 222, 228] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right", cellWidth: 40 } },
      margin: { left: MARGIN, right: width / 2 },
      didDrawPage: (data) => {
        y = (data.cursor?.y ?? y) + 24;
      },
    });
  }

  autoTable(doc, {
    startY: y,
    head: [["Data", pdfText("Descrição"), "Categoria", "Tipo", pdfText("Situação"), "Valor"]],
    body: input.txs.map((tx) => {
      const installment = tx.installmentsTotal !== null ? ` (${tx.installment ?? 0}/${tx.installmentsTotal})` : "";
      return [
        `${String(tx.day).padStart(2, "0")}/${tx.competence.slice(5)}/${tx.competence.slice(0, 4)}`,
        pdfText(`${tx.description}${installment}`),
        pdfText(categoryById(tx.categoryId, input.categories).name),
        pdfText(KIND_LABEL[tx.kind]),
        tx.paid ? (tx.kind === "in" ? "Recebido" : "Pago") : "Em aberto",
        `${tx.kind === "in" ? "+ " : "- "}${money(tx.amount)}`,
      ];
    }),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 247, 250] },
    columnStyles: { 0: { cellWidth: 62 }, 5: { halign: "right", cellWidth: 82 } },
    margin: { left: MARGIN, right: MARGIN, bottom: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(pdfText(`Juntos · página ${page} de ${pages}`), width - MARGIN, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

// ---------------------------------------------------------------- CSV

/** Centavos como "1234,56" (sem ponto flutuante). */
export function csvAmount(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Texto entre aspas; quem começa com =, +, -, @ ganha um apóstrofo para o Excel não executar como fórmula. */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const CSV_HEADER = "Mês;Dia;Tipo;Descrição;Categoria;Valor;Situação;Pago com;Quem;Observação";

/** CSV com BOM (o Excel reconhece o UTF-8) e ";" como separador. */
export function renderCsv(
  txs: readonly Tx[],
  categories: readonly Category[],
  members: readonly Member[],
): Uint8Array<ArrayBuffer> {
  const lines = txs.map((tx) =>
    [
      tx.competence,
      String(tx.day),
      KIND_LABEL[tx.kind],
      csvText(tx.description),
      csvText(categoryById(tx.categoryId, categories).name),
      csvAmount(tx.amount),
      tx.paid ? "Concluído" : "Em aberto",
      csvText(tx.paymentMethod),
      csvText(members.find((m) => m.id === tx.paidBy)?.name ?? ""),
      csvText(tx.note),
    ].join(";"),
  );
  return new TextEncoder().encode(`﻿${[CSV_HEADER, ...lines].join("\r\n")}\r\n`);
}
