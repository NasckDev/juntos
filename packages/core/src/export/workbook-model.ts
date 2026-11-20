import { isoDateOf, MAX_EXPORT_SPAN, monthName } from "../calendar.ts";
import { categoryById, DEFAULT_CATEGORIES } from "../categories.ts";
import { INSTALLMENT_PATTERN } from "../import/types.ts";
import { totals } from "../totals.ts";
import type { Category, Cents, IsoDate, Kind, Member, Tx, YearMonth } from "../types.ts";

/** Formato de moeda do Excel; os valores do modelo estão em reais, como o Excel espera. */
export const MONEY_FORMAT = '"R$" #,##0.00';
export const PERCENT_FORMAT = "0%";
export const DATE_FORMAT = "dd/mm/yyyy";
export const TABLE_STYLE = "TableStyleMedium2";
export const HEADER_FILL = "FF4F46E5";
export const OVERVIEW_SHEET_NAME = "Visão Geral";
export const LISTING_SHEET_NAME = "Lançamentos";

export interface ModelFormula {
  readonly formula: string;
  readonly result: number;
}
export interface ModelDate {
  readonly date: IsoDate;
}
export type ModelValue = string | number | null | ModelFormula | ModelDate;

export interface ModelFont {
  readonly name: string;
  readonly size: number;
  readonly bold?: boolean;
  readonly color?: string;
}

export interface ModelCell {
  readonly address: string;
  readonly value: ModelValue;
  readonly numFmt?: string;
  readonly font?: ModelFont;
}

/** Tabela do Excel: o cabeçalho fica na linha de `ref` e os dados logo abaixo, a partir da coluna de `ref`. */
export interface ModelTable {
  readonly name: string;
  readonly ref: string;
  readonly style: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly ModelValue[])[];
  /** Formato por coluna (`null` = geral). */
  readonly columnFormats: readonly (string | null)[];
  readonly font: ModelFont;
}

export interface ModelColumn {
  readonly width: number;
}

export interface SheetModel {
  readonly name: string;
  readonly showGridLines: boolean;
  readonly columns: readonly ModelColumn[];
  readonly cells: readonly ModelCell[];
  readonly tables: readonly ModelTable[];
  /** Linhas congeladas no topo. */
  readonly frozenRows: number;
  readonly autoFilter: { readonly from: string; readonly to: string } | null;
  /** Estilo da linha 1 (aba Lançamentos). */
  readonly headerRow: { readonly font: ModelFont; readonly fill: string } | null;
}

export interface WorkbookModel {
  readonly creator: string;
  readonly sheets: readonly SheetModel[];
}

export interface WorkbookInput {
  readonly months: readonly YearMonth[];
  readonly txs: readonly Tx[];
  readonly members: readonly Member[];
  readonly categories?: readonly Category[];
  /** Filtro de tipo, situação, pessoa e categoria (ver `exportFilter`). */
  readonly filter?: (tx: Tx) => boolean;
}

const BODY: ModelFont = { name: "Arial", size: 10 };
const BOLD: ModelFont = { name: "Arial", size: 10, bold: true };
const TITLE: ModelFont = { name: "Arial", size: 18, bold: true };
const SECTION: ModelFont = { name: "Arial", size: 14, bold: true };
const BIG: ModelFont = { name: "Arial", size: 28, bold: true };
const FIRST_SECTION_ROW = 12;
const KIND_LABEL: Readonly<Record<Kind, string>> = { in: "Entrada", out: "Saída", save: "Guardado" };

const toReais = (cents: Cents): number => cents / 100;
const quote = (sheetName: string): string => `'${sheetName}'`;
const column = (index: number): string => String.fromCharCode(65 + index);

interface SheetDraft {
  readonly name: string;
  readonly cells: ModelCell[];
  readonly tables: ModelTable[];
  nextSectionRow: number;
}

function newSheet(name: string): SheetDraft {
  const draft: SheetDraft = { name, cells: [], tables: [], nextSectionRow: FIRST_SECTION_ROW };
  put(draft, "B1", "Orçamento", undefined, TITLE);
  put(draft, "B2", "Percentual da renda gasta", undefined, BOLD);
  put(draft, "C2", "Resumo", undefined, BOLD);
  return draft;
}

function put(sheet: SheetDraft, address: string, value: ModelValue, numFmt?: string, font: ModelFont = BOLD): void {
  sheet.cells.push(numFmt === undefined ? { address, value, font } : { address, value, numFmt, font });
}

/** Título da seção + tabela; devolve o intervalo da coluna de valores (ex.: "C14:C16"). */
function addSection(
  sheet: SheetDraft,
  title: string,
  columns: readonly string[],
  rows: readonly (readonly ModelValue[])[],
  tableName: string,
): string {
  const titleRow = sheet.nextSectionRow;
  put(sheet, `B${titleRow}`, title, undefined, SECTION);
  const header = titleRow + 1;
  const data = rows.length > 0 ? rows : [columns.map((_, i): ModelValue => (i === 1 ? 0 : ""))];
  sheet.tables.push({
    name: tableName,
    ref: `B${header}`,
    style: TABLE_STYLE,
    columns,
    rows: data,
    columnFormats: columns.map((_, i) => (i === 1 ? MONEY_FORMAT : null)),
    font: BODY,
  });
  sheet.nextSectionRow = header + data.length + 2;
  return `C${header + 1}:C${header + data.length}`;
}

function sheetLabel(tx: Tx): string {
  const needsSuffix =
    tx.installmentsTotal !== null && tx.installment !== null && !INSTALLMENT_PATTERN.test(tx.description);
  return needsSuffix ? `${tx.description} ${tx.installment}/${tx.installmentsTotal}` : tx.description;
}

function byDayAndName(a: Tx, b: Tx): number {
  return a.day - b.day || a.description.localeCompare(b.description);
}

function summary(
  sheet: SheetDraft,
  labels: readonly [string, string, string, string],
  t: ReturnType<typeof totals>,
  ranges: readonly [string, string, string],
  override?: readonly [ModelFormula, ModelFormula, ModelFormula],
): void {
  const [renda, despesa, economia] = override ?? [
    { formula: `SUM(${ranges[0]})`, result: toReais(t.in) },
    { formula: `SUM(${ranges[1]})`, result: toReais(t.out) },
    { formula: `SUM(${ranges[2]})`, result: toReais(t.save) },
  ];
  put(sheet, "C3", labels[0]);
  put(sheet, "C4", renda, MONEY_FORMAT);
  put(sheet, "C5", labels[1]);
  put(sheet, "C6", despesa, MONEY_FORMAT);
  put(sheet, "C7", labels[2]);
  put(sheet, "C8", economia, MONEY_FORMAT);
  put(sheet, "C9", labels[3]);
  put(sheet, "C10", { formula: "C4-C6-C8", result: toReais(t.left) }, MONEY_FORMAT);
  const ratio = t.in > 0 ? Math.min(t.out / t.in, 1) : 0;
  put(sheet, "B11", { formula: "IF(C4>0,MIN(C6/C4,1),0)", result: ratio }, PERCENT_FORMAT, BIG);
}

function sheetName(ym: YearMonth, sameYear: boolean): string {
  return sameYear ? monthName(ym) : `${monthName(ym).slice(0, 3)} ${ym.slice(0, 4)}`;
}

function freeze(draft: SheetDraft, widths: readonly number[]): SheetModel {
  return {
    name: draft.name,
    showGridLines: false,
    columns: widths.map((width) => ({ width })),
    cells: draft.cells,
    tables: draft.tables,
    frozenRows: 0,
    autoFilter: null,
    headerRow: null,
  };
}

const BASE_WIDTHS = [3.3, 40, 20, 14];

function listingSheet(txs: readonly Tx[], members: readonly Member[], categories: readonly Category[]): SheetModel {
  const headers = [
    "Data",
    "Tipo",
    "Descrição",
    "Categoria",
    "Valor",
    "Situação",
    "Pago com",
    "Quem",
    "Parcela",
    "Observação",
  ];
  const widths = [12, 10, 34, 18, 14, 12, 18, 12, 9, 30];
  const cells: ModelCell[] = headers.map((h, i) => ({ address: `${column(i)}1`, value: h }));
  txs.forEach((t, index) => {
    const row = index + 2;
    const who = members.find((m) => m.id === t.paidBy)?.name ?? "";
    const values: readonly (readonly [ModelValue, string?])[] = [
      [{ date: isoDateOf(Number(t.competence.slice(0, 4)), Number(t.competence.slice(5)), t.day) }, DATE_FORMAT],
      [KIND_LABEL[t.kind]],
      [t.description],
      [categoryById(t.categoryId, categories).name],
      [toReais(t.amount), MONEY_FORMAT],
      [t.paid ? (t.kind === "in" ? "Recebido" : "Pago") : "Em aberto"],
      [t.paymentMethod],
      [who],
      [t.installmentsTotal !== null ? `${t.installment ?? 0}/${t.installmentsTotal}` : ""],
      [t.note],
    ];
    values.forEach(([value, numFmt], i) => {
      cells.push(
        numFmt === undefined
          ? { address: `${column(i)}${row}`, value }
          : { address: `${column(i)}${row}`, value, numFmt },
      );
    });
  });
  return {
    name: LISTING_SHEET_NAME,
    showGridLines: true,
    columns: widths.map((width) => ({ width })),
    cells,
    tables: [],
    frozenRows: 1,
    autoFilter: { from: "A1", to: "J1" },
    headerRow: { font: { name: "Calibri", size: 11, bold: true, color: "FFFFFFFF" }, fill: HEADER_FILL },
  };
}

/**
 * Modelo puro da planilha de exportação (o app o renderiza com ExcelJS): uma aba por mês com as fórmulas nas
 * mesmas células (C4, C6, C8, C10 e B11), "Visão Geral" com somas 3D entre as abas e a aba "Lançamentos".
 * Valores em reais, como o Excel espera. Lança `RangeError` se o período tiver 0 ou mais de 36 meses.
 */
export function buildWorkbookModel(input: WorkbookInput): WorkbookModel {
  const { months } = input;
  if (months.length === 0) throw new RangeError("Escolha pelo menos um mês.");
  if (months.length > MAX_EXPORT_SPAN) throw new RangeError("Escolha no máximo 36 meses por vez.");
  const categories = input.categories ?? DEFAULT_CATEGORIES;
  const keep = input.filter ?? (() => true);
  const sameYear = months.every((ym) => ym.slice(0, 4) === months[0]?.slice(0, 4));
  const incomeBySource = new Map<string, Cents>();
  const perMonth: { name: string; t: ReturnType<typeof totals> }[] = [];
  const sheets: SheetModel[] = [];
  const listing: Tx[] = [];

  months.forEach((ym, index) => {
    const list = input.txs.filter((t) => t.competence === ym && keep(t)).sort(byDayAndName);
    listing.push(...list);
    const t = totals(list);
    const draft = newSheet(sheetName(ym, sameYear));
    const income = list.filter((x) => x.kind === "in");
    for (const x of income) {
      const key = x.description.trim();
      incomeBySource.set(key, (incomeBySource.get(key) ?? 0) + x.amount);
    }
    const n = index + 1;
    const rIn = addSection(
      draft,
      "Renda mensal",
      ["Item", "Valor"],
      income.map((x) => [sheetLabel(x), toReais(x.amount)]),
      `Renda${n}`,
    );
    const rOut = addSection(
      draft,
      "Despesas mensais",
      ["Item", "Valor", "Situação"],
      list
        .filter((x) => x.kind === "out")
        .map((x) => [sheetLabel(x), toReais(x.amount), x.paid ? "pago" : x.paymentMethod || "-"]),
      `Despesas${n}`,
    );
    const rSave = addSection(
      draft,
      "Economia mensal",
      ["Item", "Valor"],
      list.filter((x) => x.kind === "save").map((x) => [sheetLabel(x), toReais(x.amount)]),
      `Economia${n}`,
    );
    summary(draft, ["Renda mensal total", "Despesa mensal total", "Economia mensal total", "Saldo em dinheiro"], t, [
      rIn,
      rOut,
      rSave,
    ]);
    perMonth.push({ name: draft.name, t });
    sheets.push(freeze(draft, BASE_WIDTHS));
  });

  sheets.push(overview(perMonth, incomeBySource, sameYear, months.length));
  sheets.push(listingSheet(listing, input.members, categories));
  return { creator: "Juntos", sheets };
}

function overview(
  perMonth: readonly { name: string; t: ReturnType<typeof totals> }[],
  incomeBySource: ReadonlyMap<string, Cents>,
  sameYear: boolean,
  monthCount: number,
): SheetModel {
  const sum = perMonth.reduce(
    (acc, m) => ({ in: acc.in + m.t.in, out: acc.out + m.t.out, save: acc.save + m.t.save }),
    { in: 0, out: 0, save: 0 },
  );
  const t = { ...sum, outPaid: 0, outDue: 0, left: sum.in - sum.out - sum.save };
  const first = perMonth[0]?.name ?? "";
  const last = perMonth[perMonth.length - 1]?.name ?? "";
  const range = `'${first}:${last}'!`;
  const annual = monthCount === 12 && sameYear;
  const draft = newSheet(OVERVIEW_SHEET_NAME);
  summary(
    draft,
    [
      annual ? "Renda anual total" : "Renda total do período",
      annual ? "Despesa anual total" : "Despesa total do período",
      annual ? "Economia anual total" : "Economia total do período",
      "Saldo",
    ],
    t,
    ["", "", ""],
    [
      { formula: `SUM(${range}C4)`, result: toReais(sum.in) },
      { formula: `SUM(${range}C6)`, result: toReais(sum.out) },
      { formula: `SUM(${range}C8)`, result: toReais(sum.save) },
    ],
  );
  addSection(
    draft,
    "Renda por fonte",
    ["Item", "Valor"],
    [...incomeBySource].map(([k, v]) => [k, toReais(v)]),
    "RendaTotal",
  );
  addSection(
    draft,
    "Despesas por mês",
    ["Mês", "Valor"],
    perMonth.map((m) => [m.name, { formula: `${quote(m.name)}!C6`, result: toReais(m.t.out) }]),
    "DespesasMes",
  );
  addSection(
    draft,
    "Economia por mês",
    ["Mês", "Valor"],
    perMonth.map((m) => [m.name, { formula: `${quote(m.name)}!C8`, result: toReais(m.t.save) }]),
    "EconomiaMes",
  );
  return freeze(draft, BASE_WIDTHS);
}
