import {
  buildWorkbookModel,
  type Category,
  exportFilter,
  exportMonths,
  filterForExport,
  type IsoDate,
  type Member,
  type Role,
  type Totals,
  totals,
} from "@juntos/core";
import { asc, eq } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { spaceMembers, spaces, user } from "../db/schema";
import { DomainError } from "../result";
import { EXPORT_MESSAGES, type ExportFilterData, type ExportFormat, toCoreFilter } from "../validators/export";
import { listCategories } from "./categories-read";
import { renderCsv, renderPdf, renderXlsx } from "./export-files";
import type { TxView } from "./finance-types";
import { materializeMonths, previewMissingMonths } from "./month";
import { listTransactions } from "./transactions";

/*
 * Exportação (`doExport` do protótipo), sempre no servidor: os filtros do core escolhem os lançamentos e o modelo
 * puro da planilha (`buildWorkbookModel`) vira .xlsx com ExcelJS; PDF com jsPDF e CSV com BOM e ";".
 * Quem chama confere o acesso (`requireMember(spaceId, "viewer")`) e informa o papel: para quem só vê, nada é
 * gravado (as contas fixas que faltam entram calculadas em memória; ADR 0006).
 */

export interface ExportSummary {
  readonly count: number;
  readonly totals: Totals;
}

export interface ExportFile {
  readonly fileName: string;
  readonly contentType: string;
  readonly body: Uint8Array<ArrayBuffer>;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
};

/** Categorias do espaço no formato do core (id = id do banco). */
export function toCoreCategories(list: Awaited<ReturnType<typeof listCategories>>): Category[] {
  return list.map(({ id, name, icon, hue, kind }) => ({ id, name, icon, hue, kind }));
}

/** Todas as pessoas que já passaram pelo espaço (o histórico guarda quem pagou mesmo depois de sair). */
export async function listSpaceMemberNames(db: Executor, spaceId: string): Promise<Member[]> {
  const rows = await db
    .select({ id: spaceMembers.id, name: user.name, status: spaceMembers.status })
    .from(spaceMembers)
    .innerJoin(user, eq(user.id, spaceMembers.userId))
    .where(eq(spaceMembers.spaceId, spaceId))
    .orderBy(asc(spaceMembers.createdAt));
  return rows.map((row) => ({ id: row.id, name: row.name, active: row.status === "active" }));
}

/**
 * Lançamentos do período (contas fixas dos meses lançadas antes, como o `monthTx` do protótipo), já filtrados.
 * Quem edita grava as contas fixas que faltam (como ao abrir o mês); quem só vê recebe as mesmas linhas calculadas,
 * sem escrita no banco.
 */
async function selectForExport(db: Database, filter: ExportFilterData, today: IsoDate, role: Role): Promise<TxView[]> {
  const core = toCoreFilter(filter);
  const months = exportMonths(core);
  const pending = role === "viewer" ? await previewMissingMonths(db, filter.spaceId, months, today) : [];
  if (role !== "viewer") await materializeMonths(db, filter.spaceId, months, today);
  const txs = await listTransactions(db, filter.spaceId, months);
  return filterForExport(core, [...txs, ...pending]);
}

/** Resumo ao vivo da tela de exportação: quantos lançamentos e os totais. */
export async function summarizeExport(
  db: Database,
  filter: ExportFilterData,
  today: IsoDate,
  role: Role,
): Promise<ExportSummary> {
  const list = await selectForExport(db, filter, today, role);
  return { count: list.length, totals: totals(list) };
}

/** "Viagem à praia" → "Viagem_a_praia" (o `slug` do protótipo, sem os acentos). */
export function fileSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Nome do arquivo como o protótipo: ano cheio vira `Gasto_anual_2026_Casa.xlsx`; senão
 * `Juntos_2026-01_a_2026-03_Casa.xlsx` (PDF com `Juntos_relatorio_…`).
 */
export function exportFileName(
  format: ExportFormat,
  filter: Pick<ExportFilterData, "from" | "to">,
  spaceName: string,
): string {
  const { from, to } = filter;
  const fullYear = from.slice(5) === "01" && to.slice(5) === "12" && from.slice(0, 4) === to.slice(0, 4);
  const period = fullYear ? from.slice(0, 4) : `${from}${from !== to ? `_a_${to}` : ""}`;
  const slug = fileSlug(spaceName) || "Juntos";
  if (format === "xlsx") return `${fullYear ? "Gasto_anual_" : "Juntos_"}${period}_${slug}.xlsx`;
  if (format === "pdf") return `Juntos_relatorio_${period}_${slug}.pdf`;
  return `Juntos_${period}_${slug}.csv`;
}

async function spaceName(db: Executor, spaceId: string): Promise<string> {
  const [row] = await db.select({ name: spaces.name }).from(spaces).where(eq(spaces.id, spaceId));
  return row?.name ?? "";
}

/** Gera o arquivo pedido. Sem lançamentos com os filtros, erro com a mensagem do protótipo. */
export async function buildExport(
  db: Database,
  format: ExportFormat,
  filter: ExportFilterData,
  today: IsoDate,
  role: Role,
  generatedAt: Date = new Date(),
): Promise<ExportFile> {
  const list = await selectForExport(db, filter, today, role);
  if (list.length === 0) throw new DomainError(EXPORT_MESSAGES.empty);
  const [categoryRows, members, name] = await Promise.all([
    listCategories(db, filter.spaceId),
    listSpaceMemberNames(db, filter.spaceId),
    spaceName(db, filter.spaceId),
  ]);
  const categories = toCoreCategories(categoryRows);
  const core = toCoreFilter(filter);
  const fileName = exportFileName(format, filter, name);
  if (format === "xlsx") {
    const model = buildWorkbookModel({
      months: exportMonths(core),
      txs: list,
      members,
      categories,
      filter: exportFilter(core),
    });
    return { fileName, contentType: CONTENT_TYPES.xlsx, body: await renderXlsx(model, generatedAt) };
  }
  if (format === "pdf") {
    const body = renderPdf({ txs: list, filter: core, categories, members, spaceName: name, generatedAt });
    return { fileName, contentType: CONTENT_TYPES.pdf, body };
  }
  return { fileName, contentType: CONTENT_TYPES.csv, body: renderCsv(list, categories, members) };
}
