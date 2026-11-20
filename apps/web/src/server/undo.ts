import { and, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { Database, Executor } from "./db";
import {
  goals,
  importBatches,
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
    const affected =
      action.type === "restore"
        ? await restore(tx, userId, spaceId, action.entity, action.ids)
        : await revertImport(tx, userId, spaceId, action.batchId, now);
    return { spaceId, action, affected };
  });
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

async function revertImport(
  tx: Executor,
  userId: string,
  spaceId: string,
  batchId: string,
  now: Date,
): Promise<number> {
  await assertMember(tx, userId, spaceId, "editor");
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
  return rows.length;
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
