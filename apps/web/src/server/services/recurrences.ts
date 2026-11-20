import { applyForward, deleteEffects, type IsoDate, pauseEffects, todayParts, ymAdd } from "@juntos/core";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { recurrences, transactions } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { REC_MESSAGES, type UpdateRecurrenceData } from "../validators/recurrences";
import { assertCategory } from "./categories-read";
import { recurrenceToCore } from "./recurrences-read";
import { type Actor, toTxView } from "./transactions";

/*
 * Contas fixas: editar, pausar, retomar e excluir (`recf`, `A.recpause`, `A.recdel` do protótipo).
 *
 * Os lançamentos futuros em aberto que a pausa e a exclusão tiram são apagados de verdade (não soft delete):
 * assim, ao retomar ou ao desfazer a exclusão, a materialização do mês volta a lançá-los. Já o lançamento que a
 * pessoa exclui à mão fica com `deleted_at` e nunca volta.
 */

async function findRecurrence(db: Executor, spaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(recurrences)
    .where(and(eq(recurrences.id, id), eq(recurrences.spaceId, spaceId), isNull(recurrences.deletedAt)))
    .limit(1);
  if (!row) throw new DomainError(REC_MESSAGES.notFound);
  return row;
}

/** Lançamentos (não excluídos) da conta fixa. */
async function liveTransactionsOf(db: Executor, spaceId: string, recurrenceId: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.recurrenceId, recurrenceId),
        eq(transactions.spaceId, spaceId),
        isNull(transactions.deletedAt),
      ),
    );
  return rows.map((row) => toTxView(row));
}

async function removeTransactions(db: Executor, spaceId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(transactions).where(and(eq(transactions.spaceId, spaceId), inArray(transactions.id, [...ids])));
}

/** "Vale deste mês em diante, nos lançamentos ainda em aberto." */
export async function updateRecurrence(
  db: Database,
  actor: Actor,
  data: UpdateRecurrenceData,
  today: IsoDate,
): Promise<{ id: string }> {
  const rec = await findRecurrence(db, data.spaceId, data.id);
  await assertCategory(db, data.spaceId, data.categoryId, rec.kind);
  const changes = { description: data.description, amount: data.amount, day: data.day, categoryId: data.categoryId };
  await db.transaction(async (tx) => {
    const before = await liveTransactionsOf(tx, data.spaceId, rec.id);
    // applyForward muda o que vem depois do mês informado: o mês anterior ao de hoje inclui o mês atual.
    const fromYm = ymAdd(todayParts(today).ym, -1);
    const result = applyForward(recurrenceToCore(rec), before, fromYm, changes);
    await tx
      .update(recurrences)
      .set({
        description: data.description,
        amountCents: data.amount,
        day: data.day,
        categoryId: data.categoryId,
        updatedBy: actor.userId,
      })
      .where(eq(recurrences.id, rec.id));
    for (const [index, next] of result.txs.entries()) {
      if (next === before[index]) continue;
      await tx
        .update(transactions)
        .set({
          description: next.description,
          amountCents: next.amount,
          day: next.day,
          categoryId: next.categoryId,
          updatedBy: actor.userId,
        })
        .where(eq(transactions.id, next.id));
    }
  });
  return { id: rec.id };
}

/**
 * Pausar apaga os lançamentos futuros em aberto (meses depois do atual); retomar volta a lançar quando os meses
 * forem abertos.
 */
export async function setRecurrencePaused(
  db: Database,
  actor: Actor,
  spaceId: string,
  id: string,
  paused: boolean,
  today: IsoDate,
): Promise<{ id: string; paused: boolean }> {
  const rec = await findRecurrence(db, spaceId, id);
  await db.transaction(async (tx) => {
    await tx.update(recurrences).set({ paused, updatedBy: actor.userId }).where(eq(recurrences.id, rec.id));
    if (!paused) return;
    const { removeIds } = pauseEffects(recurrenceToCore(rec), await liveTransactionsOf(tx, spaceId, rec.id), today);
    await removeTransactions(tx, spaceId, removeIds);
  });
  return { id: rec.id, paused };
}

/**
 * Excluir: a conta para de se repetir. Os lançamentos futuros em aberto saem; o histórico fica (sem o vínculo
 * na tela). Pode ser desfeito por 10 minutos.
 */
export async function deleteRecurrence(
  db: Database,
  actor: Actor,
  spaceId: string,
  id: string,
  today: IsoDate,
): Promise<{ undo: UndoTokenInfo }> {
  const rec = await findRecurrence(db, spaceId, id);
  return db.transaction(async (tx) => {
    const { removeIds } = deleteEffects(recurrenceToCore(rec), await liveTransactionsOf(tx, spaceId, rec.id), today);
    await removeTransactions(tx, spaceId, removeIds);
    await tx
      .update(recurrences)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(eq(recurrences.id, rec.id));
    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: { type: "restore", entity: "recurrences", ids: [rec.id] },
    });
    return { undo };
  });
}
