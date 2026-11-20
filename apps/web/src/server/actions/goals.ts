"use server";

import { todayInSaoPaulo } from "@juntos/core";
import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/goals";
import type { Actor } from "../services/transactions";
import type { UndoTokenInfo } from "../undo";
import {
  type CreateGoalInput,
  createGoalSchema,
  type DepositInput,
  depositSchema,
  type GoalRefInput,
  goalRefSchema,
  type UpdateGoalInput,
  updateGoalSchema,
} from "../validators/goals";

/* Metas. Mutações exigem `editor` (ou `owner`). "Hoje" é o dia em America/Sao_Paulo, calculado na borda. */

async function editor(spaceId: string): Promise<Actor> {
  const { user, membership } = await requireMember(spaceId, "editor");
  return { userId: user.id, memberId: membership.memberId };
}

function refresh(): void {
  revalidatePath("/", "layout");
}

export async function createGoal(
  input: CreateGoalInput,
): Promise<ActionResult<{ id: string; transactionId: string | null }>> {
  return runAction(createGoalSchema, input, async (data) => {
    const actor = await editor(data.spaceId);
    const created = await service.createGoal(getDb(), actor, data.spaceId, data, todayInSaoPaulo());
    refresh();
    return created;
  });
}

export async function updateGoal(input: UpdateGoalInput): Promise<ActionResult<{ id: string }>> {
  return runAction(updateGoalSchema, input, async (data) => {
    await editor(data.spaceId);
    const updated = await service.updateGoal(getDb(), data.spaceId, data);
    refresh();
    return updated;
  });
}

/** Exclui com "Desfazer" por 10 minutos (`undo({ token })`). */
export async function deleteGoal(input: GoalRefInput): Promise<ActionResult<{ undo: UndoTokenInfo }>> {
  return runAction(goalRefSchema, input, async ({ spaceId, id }) => {
    const actor = await editor(spaceId);
    const result = await service.deleteGoal(getDb(), actor, spaceId, id);
    refresh();
    return result;
  });
}

/** "Guardar nesta meta": grava o depósito e o lançamento Guardado na mesma transação. */
export async function depositToGoal(input: DepositInput): Promise<ActionResult<service.DepositResult>> {
  return runAction(depositSchema, input, async ({ spaceId, goalId, amount }) => {
    const actor = await editor(spaceId);
    const result = await service.depositToGoal(getDb(), actor, spaceId, goalId, amount, todayInSaoPaulo());
    refresh();
    return result;
  });
}
