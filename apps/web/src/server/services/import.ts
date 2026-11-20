import {
  guessCategory,
  type ImportItem,
  type IsoDate,
  type Member,
  markExisting,
  parseWorkbook,
  planImport,
  resolveCompetence,
  type SheetGrid,
  todayParts,
  type YearMonth,
  yearFromFileName,
} from "@juntos/core";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { importBatches, notifications, spaceMembers, transactions, user } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { type ConfirmImportData, IMPORT_MESSAGES, type ImportDestination } from "../validators/import";
import {
  DESCRIPTION_MAX,
  MAX_AMOUNT_CENTS,
  MAX_INSTALLMENTS,
  MAX_YEAR,
  MIN_YEAR,
  NOTE_MAX,
  PAYMENT_METHOD_MAX,
} from "../validators/transactions";
import { listCategories } from "./categories-read";
import { toCoreCategories } from "./export";
import type { CategoryView } from "./finance-types";
import { materializeMonths } from "./month";
import { insertOwnedSpace, isSpaceNameTaken } from "./spaces";
import { competenceDate, listTransactions } from "./transactions";

/*
 * Importação em três passos (`parseBook`, `dImport` e `doImport` do protótipo):
 * 1. `createImportBatch`: as abas lidas viram itens pelo core e ficam num lote `review` (só um por pessoa e espaço).
 * 2. `reviewExisting`: a tela de revisão marca o que já existe ("Já existe" vem desmarcado).
 * 3. `confirmImport`: grava os escolhidos numa transação (somar ou substituir; neste espaço ou num novo), marca o
 *    lote `done`, registra o aviso "N lançamentos importados" e devolve o "Desfazer" do lote inteiro.
 * Quem chama confere o papel (`editor`).
 */

export interface ImportActor {
  readonly userId: string;
  readonly memberId: string;
}

export type ImportSourceKind = "monthly" | "detailed";

export interface PendingImport {
  readonly id: string;
  readonly fileName: string;
  readonly source: ImportSourceKind;
  readonly items: readonly ImportItem[];
  /** Ano da planilha mensal (do nome do arquivo); na detalhada, o ano do primeiro lançamento. */
  readonly year: number;
}

const SOURCE_COLUMN = { monthly: "monthly-sheet", detailed: "detailed-export" } as const;

/**
 * Categoria do item no banco: a mesma (detalhada, pelo nome), a padrão pela chave que o core sugeriu ou, se a
 * categoria não vale no destino (espaço novo), a sugerida pelo nome.
 */
function resolveCategoryId(list: readonly CategoryView[], item: ImportItem): string | null {
  const { categoryId: id, kind } = item;
  const guessed = guessCategory(item.description, kind);
  return (
    list.find((c) => c.id === id && c.kind === kind)?.id ??
    list.find((c) => c.key === id && c.kind === kind)?.id ??
    list.find((c) => c.key === guessed && c.kind === kind)?.id ??
    list.find((c) => c.kind === kind)?.id ??
    null
  );
}

/** Limites das colunas do lançamento; o que não cabe é cortado e o que é impossível fica de fora. */
function normalizeItem(item: ImportItem, list: readonly CategoryView[]): ImportItem | null {
  const categoryId = resolveCategoryId(list, item);
  const description = item.description.trim().slice(0, DESCRIPTION_MAX);
  if (!categoryId || description.length < 1) return null;
  if (!(item.amount > 0) || item.amount > MAX_AMOUNT_CENTS || !Number.isInteger(item.amount)) return null;
  if (item.year < MIN_YEAR || item.year > MAX_YEAR) return null;
  const validInstallment =
    item.installment !== null &&
    item.installmentsTotal !== null &&
    item.installment > 0 &&
    item.installmentsTotal >= item.installment &&
    item.installmentsTotal <= MAX_INSTALLMENTS;
  return {
    ...item,
    description,
    categoryId,
    paymentMethod: item.paymentMethod.trim().slice(0, PAYMENT_METHOD_MAX),
    note: item.note.trim().slice(0, NOTE_MAX),
    installment: validInstallment ? item.installment : null,
    installmentsTotal: validInstallment ? item.installmentsTotal : null,
  };
}

/** Lê as abas pelo core e guarda o lote para revisão. Nenhum formato reconhecido = erro do protótipo. */
export async function createImportBatch(
  db: Database,
  actor: ImportActor,
  spaceId: string,
  fileName: string,
  sheets: readonly SheetGrid[],
  today: IsoDate,
): Promise<{ batchId: string; count: number }> {
  const categories = await listCategories(db, spaceId);
  const fileYear = yearFromFileName(fileName, Number(today.slice(0, 4)));
  const parsed = parseWorkbook(sheets, fileYear, toCoreCategories(categories));
  const items = parsed.items.flatMap((item) => normalizeItem(item, categories) ?? []);
  if (items.length === 0) throw new DomainError(IMPORT_MESSAGES.noSheets);
  return db.transaction(async (tx) => {
    await tx
      .delete(importBatches)
      .where(
        and(
          eq(importBatches.spaceId, spaceId),
          eq(importBatches.createdBy, actor.userId),
          eq(importBatches.status, "review"),
        ),
      );
    const [row] = await tx
      .insert(importBatches)
      .values({
        spaceId,
        fileName: fileName.slice(0, 200),
        source: SOURCE_COLUMN[parsed.source],
        rowsTotal: items.length,
        mode: "add",
        status: "review",
        items,
        createdBy: actor.userId,
      })
      .returning({ id: importBatches.id });
    if (!row) throw new Error("Falha ao gravar o lote de importação.");
    return { batchId: row.id, count: items.length };
  });
}

type BatchRow = typeof importBatches.$inferSelect;

function toPending(row: BatchRow): PendingImport {
  const source: ImportSourceKind = row.source === "monthly-sheet" ? "monthly" : "detailed";
  const first = row.items[0];
  return {
    id: row.id,
    fileName: row.fileName,
    source,
    items: row.items,
    year: first?.year ?? Number(row.createdAt.toISOString().slice(0, 4)),
  };
}

/** O lote em revisão da pessoa neste espaço (o mais recente), ou `null`. */
export async function findPendingImport(db: Executor, spaceId: string, userId: string): Promise<PendingImport | null> {
  const [row] = await db
    .select()
    .from(importBatches)
    .where(
      and(eq(importBatches.spaceId, spaceId), eq(importBatches.createdBy, userId), eq(importBatches.status, "review")),
    )
    .orderBy(desc(importBatches.createdAt))
    .limit(1);
  return row ? toPending(row) : null;
}

async function requirePending(db: Executor, spaceId: string, userId: string, batchId: string): Promise<PendingImport> {
  const [row] = await db
    .select()
    .from(importBatches)
    .where(
      and(
        eq(importBatches.id, batchId),
        eq(importBatches.spaceId, spaceId),
        eq(importBatches.createdBy, userId),
        eq(importBatches.status, "review"),
      ),
    );
  if (!row) throw new DomainError(IMPORT_MESSAGES.gone);
  return toPending(row);
}

/** Ano usado nas competências: só a planilha mensal tem ano escolhido na revisão. */
function yearFor(pending: PendingImport, year: number | null): number | null {
  return pending.source === "monthly" ? (year ?? pending.year) : null;
}

/** "Já existe" de cada item (mesma competência, nome, valor e tipo). Num espaço novo, nada existe ainda. */
export async function reviewExisting(
  db: Database,
  spaceId: string,
  pending: PendingImport,
  year: number | null,
  destination: ImportDestination,
): Promise<boolean[]> {
  if (destination === "new") return pending.items.map(() => false);
  const chosenYear = yearFor(pending, year);
  const months = [...new Set(pending.items.map((item) => resolveCompetence(item, chosenYear)))];
  const txs = await listTransactions(db, spaceId, months);
  return markExisting(pending.items, txs, { year: chosenYear }).map((row) => row.existing);
}

/** Versão para a Server Action: confere o lote antes. */
export async function reviewImport(
  db: Database,
  userId: string,
  input: { spaceId: string; batchId: string; year: number | null; destination: ImportDestination },
): Promise<boolean[]> {
  const pending = await requirePending(db, input.spaceId, userId, input.batchId);
  return reviewExisting(db, input.spaceId, pending, input.year, input.destination);
}

/** Descarta o lote em revisão ("Cancelar"). */
export async function cancelImport(db: Executor, userId: string, spaceId: string, batchId: string): Promise<void> {
  await db
    .delete(importBatches)
    .where(
      and(
        eq(importBatches.id, batchId),
        eq(importBatches.spaceId, spaceId),
        eq(importBatches.createdBy, userId),
        eq(importBatches.status, "review"),
      ),
    );
}

async function activeMembers(db: Executor, spaceId: string): Promise<Member[]> {
  const rows = await db
    .select({ id: spaceMembers.id, name: user.name })
    .from(spaceMembers)
    .innerJoin(user, eq(user.id, spaceMembers.userId))
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.status, "active")))
    .orderBy(asc(spaceMembers.createdAt));
  return rows.map((row) => ({ ...row, active: true }));
}

/** "Planilha 2025", ou "Planilha 2025 (2)" se a pessoa já tem um espaço com esse nome. */
async function newSpaceName(db: Executor, userId: string, year: number): Promise<string> {
  const base = `Planilha ${year}`;
  for (let n = 1; n < 100; n += 1) {
    const name = n === 1 ? base : `${base} (${n})`;
    if (!(await isSpaceNameTaken(db, userId, name))) return name;
  }
  throw new DomainError("Você já tem muitos espaços com esse nome. Renomeie algum e tente de novo.");
}

export interface ConfirmedImport {
  readonly count: number;
  readonly spaceId: string;
  readonly createdSpace: boolean;
  /** Mês para abrir a lista depois de importar (o de hoje, se a planilha é deste ano; senão o último dela). */
  readonly openMonth: YearMonth;
  readonly undo: UndoTokenInfo;
}

function importedTitle(count: number): string {
  return count === 1 ? "1 lançamento importado" : `${count} lançamentos importados`;
}

/** Grava os itens escolhidos (`doImport`). Tudo ou nada, numa transação. */
export async function confirmImport(
  db: Database,
  actor: ImportActor,
  input: ConfirmImportData,
  today: IsoDate,
): Promise<ConfirmedImport> {
  const pending = await requirePending(db, input.spaceId, actor.userId, input.batchId);
  const indexes = [...new Set(input.selected)];
  const chosen = indexes.flatMap((i) => pending.items[i] ?? []);
  if (chosen.length === 0 || chosen.length !== indexes.length) throw new DomainError(IMPORT_MESSAGES.selectOne);
  const year = yearFor(pending, input.year);
  const destination = input.destination;
  const mode = destination === "new" ? "add" : input.mode;
  const months = [...new Set(chosen.map((item) => resolveCompetence(item, year)))].sort();

  // Contas fixas dos meses tocados entram antes (`ensureMonth`): somando, ficam; substituindo, saem junto.
  if (destination === "here") await materializeMonths(db, input.spaceId, months, today);
  const categories = await listCategories(db, input.spaceId);

  return db.transaction(async (tx) => {
    const target =
      destination === "new"
        ? await insertOwnedSpace(tx, actor.userId, await newSpaceName(tx, actor.userId, year ?? pending.year))
        : null;
    const spaceId = target?.id ?? input.spaceId;
    const members = await activeMembers(tx, spaceId);
    // Num espaço novo só valem as categorias padrão (as personalizadas são do espaço de origem).
    const allowed = target ? categories.filter((c) => c.key !== null) : categories;
    const items = chosen.flatMap((item) => normalizeItem(item, allowed) ?? []);
    const plan = planImport(items, { year, mode, today, members });

    const replaced =
      plan.replaceCompetences.length > 0
        ? await tx
            .update(transactions)
            .set({ deletedAt: new Date(), updatedBy: actor.userId })
            .where(
              and(
                eq(transactions.spaceId, spaceId),
                isNull(transactions.deletedAt),
                inArray(transactions.competence, plan.replaceCompetences.map(competenceDate)),
              ),
            )
            .returning({ id: transactions.id })
        : [];

    await tx.insert(transactions).values(
      plan.create.map((t) => ({
        spaceId,
        kind: t.kind,
        description: t.description,
        amountCents: t.amount,
        competence: competenceDate(t.competence),
        day: t.day,
        categoryId: t.categoryId,
        paid: t.paid,
        paidAt: t.paid ? `${t.competence}-${String(t.day).padStart(2, "0")}` : null,
        paymentMethod: t.paymentMethod,
        paidBy: t.paidBy,
        personal: t.personal,
        note: t.note,
        installmentNumber: t.installment,
        installmentsTotal: t.installmentsTotal,
        importBatchId: pending.id,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })),
    );

    await tx
      .update(importBatches)
      .set({ status: "done", mode, rowsImported: plan.create.length, spaceId })
      .where(eq(importBatches.id, pending.id));

    const nowYm = todayParts(today).ym;
    const last = months[months.length - 1] ?? nowYm;
    const openMonth = last.slice(0, 4) === nowYm.slice(0, 4) ? nowYm : last;
    const now = new Date();
    await tx
      .insert(notifications)
      .values({
        spaceId,
        type: "import",
        dedupeKey: `import-${pending.id}`,
        title: importedTitle(plan.create.length),
        body: `Da planilha ${pending.fileName}.`,
        href: `/lancamentos?mes=${openMonth}`,
        seenAt: now,
        readAt: now,
      })
      .onConflictDoNothing({ target: [notifications.spaceId, notifications.dedupeKey] });

    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: {
        type: "revert-import",
        batchId: pending.id,
        ...(replaced.length > 0 ? { restoreIds: replaced.map((row) => row.id) } : {}),
        ...(target ? { createdSpaceId: target.id } : {}),
      },
    });
    return { count: plan.create.length, spaceId, createdSpace: target !== null, openMonth, undo };
  });
}
