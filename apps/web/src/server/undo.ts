import { and, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { Database, Executor } from "./db";
import {
  budgets,
  categories,
  type DeletedCategorySnapshot,
  goals,
  importBatches,
  type PreviousBudget,
  type RestorableEntity,
  recurrences,
  settlements,
  spaceMembers,
  spaces,
  transactions,
  type UndoAction,
  undoTokens,
} from "./db/schema";
import { assertMember } from "./membership";
import { DomainError } from "./result";
import { isUniqueViolation } from "./services/db-errors";

/** Prazo do "Desfazer" no servidor (especificação 5.7). */
export const UNDO_TTL_MS = 10 * 60 * 1000;

export const UNDO_EXPIRED_MESSAGE = "Não dá mais para desfazer: o prazo de 10 minutos passou.";

export interface UndoTokenInfo {
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Cria o token de "Desfazer" para uma ação já feita (grave na mesma transação da ação).
 * O token só vale para quem o criou, uma vez, por 10 minutos.
 */
export async function createUndoToken(
  db: Executor,
  input: { readonly userId: string; readonly spaceId: string; readonly action: UndoAction; readonly now?: Date },
): Promise<UndoTokenInfo> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + UNDO_TTL_MS);
  const [row] = await db
    .insert(undoTokens)
    .values({ userId: input.userId, spaceId: input.spaceId, action: input.action, createdAt: now, expiresAt })
    .returning({ id: undoTokens.id });
  if (!row) throw new Error("Falha ao criar o token de desfazer.");
  return { token: row.id, expiresAt };
}

export interface UndoResult {
  readonly spaceId: string;
  readonly action: UndoAction;
  /** Quantos registros voltaram (ou saíram, no caso de lote). */
  readonly affected: number;
}

/**
 * Aplica o "Desfazer": restaura o que foi excluído (soft delete) ou reverte um lote de importação.
 * Consome o token de forma atômica (não dá para desfazer duas vezes).
 */
export async function applyUndo(db: Database, userId: string, token: string, now = new Date()): Promise<UndoResult> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(undoTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(undoTokens.id, token),
          eq(undoTokens.userId, userId),
          isNull(undoTokens.usedAt),
          gt(undoTokens.expiresAt, now),
        ),
      )
      .returning();
    if (!row) throw new DomainError(UNDO_EXPIRED_MESSAGE);
    const { action, spaceId } = row;
    const affected = await applyAction(tx, userId, spaceId, action, now);
    return { spaceId, action, affected };
  });
}

async function applyAction(
  tx: Executor,
  userId: string,
  spaceId: string,
  action: UndoAction,
  now: Date,
): Promise<number> {
  switch (action.type) {
    case "restore":
      return restore(tx, userId, spaceId, action.entity, action.ids);
    case "revert-import":
      return revertImport(tx, userId, spaceId, action, now);
    case "restore-category":
      return restoreCategory(tx, userId, spaceId, action.category);
    case "restore-budgets":
      return restoreBudgets(tx, userId, spaceId, action.previous);
  }
}

async function restore(
  tx: Executor,
  userId: string,
  spaceId: string,
  entity: RestorableEntity,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const list = [...ids];
  if (entity === "spaces") {
    await assertMember(tx, userId, spaceId, "owner", { includeDeleted: true });
    await assertNoNameClash(tx, userId, spaceId);
    const rows = await tx
      .update(spaces)
      .set({ deletedAt: null })
      .where(and(eq(spaces.id, spaceId), isNotNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    return rows.length;
  }
  await assertMember(tx, userId, spaceId, "editor");
  const table = RESTORE_TABLES[entity];
  const rows = await tx
    .update(table)
    .set({ deletedAt: null })
    .where(and(eq(table.spaceId, spaceId), inArray(table.id, list), isNotNull(table.deletedAt)))
    .returning({ id: table.id });
  return rows.length;
}

const RESTORE_TABLES = {
  transactions,
  recurrences,
  goals,
  settlements,
} as const;

/**
 * Reverte o lote inteiro: tira os lançamentos importados, devolve os que o modo "substituir" tirou e, se a
 * importação criou um espaço novo, exclui esse espaço.
 */
async function revertImport(
  tx: Executor,
  userId: string,
  spaceId: string,
  action: Extract<UndoAction, { type: "revert-import" }>,
  now: Date,
): Promise<number> {
  const { batchId } = action;
  await assertMember(tx, userId, spaceId, action.createdSpaceId === spaceId ? "owner" : "editor");
  const [batch] = await tx
    .update(importBatches)
    .set({ status: "undone" })
    .where(and(eq(importBatches.id, batchId), eq(importBatches.spaceId, spaceId), eq(importBatches.status, "done")))
    .returning({ id: importBatches.id });
  if (!batch) throw new DomainError(UNDO_EXPIRED_MESSAGE);
  const rows = await tx
    .update(transactions)
    .set({ deletedAt: now })
    .where(
      and(eq(transactions.spaceId, spaceId), eq(transactions.importBatchId, batchId), isNull(transactions.deletedAt)),
    )
    .returning({ id: transactions.id });
  const restoreIds = [...(action.restoreIds ?? [])];
  if (restoreIds.length > 0) {
    await tx
      .update(transactions)
      .set({ deletedAt: null })
      .where(
        and(eq(transactions.spaceId, spaceId), inArray(transactions.id, restoreIds), isNotNull(transactions.deletedAt)),
      );
  }
  if (action.createdSpaceId === spaceId) {
    await tx
      .update(spaces)
      .set({ deletedAt: now })
      .where(and(eq(spaces.id, spaceId), isNull(spaces.deletedAt)));
  }
  return rows.length;
}

/** Devolve a categoria excluída (mesmo id), os lançamentos e contas fixas que estavam nela e o limite. */
async function restoreCategory(
  tx: Executor,
  userId: string,
  spaceId: string,
  snapshot: DeletedCategorySnapshot,
): Promise<number> {
  await assertMember(tx, userId, spaceId, "editor");
  try {
    await tx.insert(categories).values({
      id: snapshot.id,
      spaceId,
      key: null,
      name: snapshot.name,
      icon: snapshot.icon,
      hue: snapshot.hue,
      kind: snapshot.kind,
    });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      throw new DomainError("Já existe uma categoria com esse nome. Renomeie a outra para desfazer.");
    }
    throw error;
  }
  const txIds = [...snapshot.transactionIds];
  const recIds = [...snapshot.recurrenceIds];
  const movedTx = txIds.length
    ? await tx
        .update(transactions)
        .set({ categoryId: snapshot.id })
        .where(and(eq(transactions.spaceId, spaceId), inArray(transactions.id, txIds)))
        .returning({ id: transactions.id })
    : [];
  const movedRec = recIds.length
    ? await tx
        .update(recurrences)
        .set({ categoryId: snapshot.id })
        .where(and(eq(recurrences.spaceId, spaceId), inArray(recurrences.id, recIds)))
        .returning({ id: recurrences.id })
    : [];
  if (snapshot.budgetCents !== null) {
    await tx.insert(budgets).values({ spaceId, categoryId: snapshot.id, monthlyLimitCents: snapshot.budgetCents });
  }
  return 1 + movedTx.length + movedRec.length;
}

/** Volta os limites ao que eram antes da sugestão automática. */
async function restoreBudgets(
  tx: Executor,
  userId: string,
  spaceId: string,
  previous: readonly PreviousBudget[],
): Promise<number> {
  await assertMember(tx, userId, spaceId, "editor");
  for (const item of previous) {
    if (item.limitCents === null) {
      await tx.delete(budgets).where(and(eq(budgets.spaceId, spaceId), eq(budgets.categoryId, item.categoryId)));
    } else {
      await tx
        .insert(budgets)
        .values({ spaceId, categoryId: item.categoryId, monthlyLimitCents: item.limitCents })
        .onConflictDoUpdate({
          target: [budgets.spaceId, budgets.categoryId],
          set: { monthlyLimitCents: item.limitCents },
        });
    }
  }
  return previous.length;
}

/** Ao restaurar um espaço, o nome não pode repetir outro espaço da mesma pessoa criado nesse meio tempo. */
async function assertNoNameClash(tx: Executor, userId: string, spaceId: string): Promise<void> {
  const [clash] = await tx
    .select({ id: spaces.id })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.status, "active"),
        isNull(spaces.deletedAt),
        sql`lower(trim(${spaces.name})) = (select lower(trim(s.name)) from ${spaces} s where s.id = ${spaceId})`,
      ),
    )
    .limit(1);
  if (clash) throw new DomainError("Você já tem um espaço com esse nome. Renomeie o outro para desfazer.");
}

/** Apaga tokens vencidos ou já usados (rotina diária). */
export async function purgeUndoTokens(db: Executor, now = new Date()): Promise<number> {
  const rows = await db
    .delete(undoTokens)
    .where(or(lte(undoTokens.expiresAt, now), isNotNull(undoTokens.usedAt)))
    .returning({ id: undoTokens.id });
  return rows.length;
}
