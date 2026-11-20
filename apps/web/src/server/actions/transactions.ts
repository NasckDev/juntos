"use server";

import { todayInSaoPaulo, type YearMonth } from "@juntos/core";
import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import type { TxSearchHit } from "../services/finance-types";
import * as service from "../services/transactions";
import type { UndoTokenInfo } from "../undo";
import {
  type CreateTransactionInput,
  createTransactionSchema,
  type DiscardCreatedInput,
  discardCreatedSchema,
  type SearchTransactionsInput,
  type SetPaidInput,
  searchTransactionsSchema,
  setPaidSchema,
  type TransactionRefInput,
  transactionRefSchema,
  type UpdateTransactionInput,
  updateTransactionSchema,
} from "../validators/transactions";

/*
 * Lançamentos. Quem só vê (viewer) lê, mas não escreve: toda mutação exige `editor` (ou `owner`).
 * "Hoje" é sempre o dia em America/Sao_Paulo, calculado aqui na borda.
 */

async function editor(spaceId: string): Promise<service.Actor> {
  const { user, membership } = await requireMember(spaceId, "editor");
  return { userId: user.id, memberId: membership.memberId };
}

function refresh(): void {
  revalidatePath("/", "layout");
}

/**
 * Novo lançamento (ou conta fixa, com `repeat`). Lançamento igual no mesmo dia volta como erro no campo
 * `description` até a pessoa confirmar (`confirmDuplicate: true`).
 */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<ActionResult<service.CreatedTransaction>> {
  return runAction(createTransactionSchema, input, async (data) => {
    const actor = await editor(data.spaceId);
    const created = await service.createTransaction(getDb(), actor, data, todayInSaoPaulo());
    refresh();
    return created;
  });
}

/** "Desfazer" do toast depois de criar: tira o lançamento (e a conta fixa que ele criou, se houver). */
export async function discardCreatedTransaction(
  input: DiscardCreatedInput,
): Promise<ActionResult<{ removed: number }>> {
  return runAction(discardCreatedSchema, input, async ({ spaceId, id, recurrenceId }) => {
    const actor = await editor(spaceId);
    const result = await service.discardCreatedTransaction(getDb(), actor, spaceId, id, recurrenceId);
    refresh();
    return result;
  });
}

/** Edita; `scope: "next"` em conta fixa muda também o modelo e os próximos em aberto. */
export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<ActionResult<{ id: string; competence: YearMonth }>> {
  return runAction(updateTransactionSchema, input, async (data) => {
    const actor = await editor(data.spaceId);
    const updated = await service.updateTransaction(getDb(), actor, data, todayInSaoPaulo());
    refresh();
    return updated;
  });
}

/** Marca como pago/recebido ou volta para em aberto. */
export async function setTransactionPaid(input: SetPaidInput): Promise<ActionResult<{ id: string; paid: boolean }>> {
  return runAction(setPaidSchema, input, async ({ spaceId, id, paid }) => {
    const actor = await editor(spaceId);
    const result = await service.setTransactionPaid(getDb(), actor, spaceId, id, paid, todayInSaoPaulo());
    refresh();
    return result;
  });
}

/** Cópia em aberto com "(cópia)" no nome. */
export async function duplicateTransaction(
  input: TransactionRefInput,
): Promise<ActionResult<{ id: string; competence: YearMonth }>> {
  return runAction(transactionRefSchema, input, async ({ spaceId, id }) => {
    const actor = await editor(spaceId);
    const copy = await service.duplicateTransaction(getDb(), actor, spaceId, id);
    refresh();
    return copy;
  });
}

/** Exclui com "Desfazer" por 10 minutos (`undo({ token })`). */
export async function deleteTransaction(input: TransactionRefInput): Promise<ActionResult<{ undo: UndoTokenInfo }>> {
  return runAction(transactionRefSchema, input, async ({ spaceId, id }) => {
    const actor = await editor(spaceId);
    const result = await service.deleteTransaction(getDb(), actor, spaceId, id);
    refresh();
    return result;
  });
}

/** Busca por nome ou observação em todos os meses (Ctrl/⌘+K e "Buscar em todos os meses"). Só leitura. */
export async function searchTransactions(input: SearchTransactionsInput): Promise<ActionResult<TxSearchHit[]>> {
  return runAction(searchTransactionsSchema, input, async ({ spaceId, query, limit }) => {
    await requireMember(spaceId, "viewer");
    return service.searchTransactions(getDb(), spaceId, query, limit);
  });
}
