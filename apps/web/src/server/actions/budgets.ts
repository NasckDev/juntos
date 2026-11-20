"use server";

import { todayInSaoPaulo } from "@juntos/core";
import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/budgets";
import type { UndoTokenInfo } from "../undo";
import {
  type SetBudgetInput,
  type SuggestBudgetsInput,
  setBudgetSchema,
  suggestBudgetsSchema,
} from "../validators/budgets";

/* Orçamento. Quem só vê (viewer) lê, mas não escreve: toda mutação exige `editor` (ou `owner`). */

function refresh(): void {
  revalidatePath("/", "layout");
}

/** Define o limite mensal de uma categoria de saída; `limit: null` tira o limite. */
export async function setBudget(
  input: SetBudgetInput,
): Promise<ActionResult<{ categoryId: string; limit: number | null }>> {
  return runAction(setBudgetSchema, input, async ({ spaceId, categoryId, limit }) => {
    await requireMember(spaceId, "editor");
    const result = await service.setBudget(getDb(), spaceId, categoryId, limit);
    refresh();
    return result;
  });
}

/** "Sugerir pelos últimos 3 meses": grava a média dos 3 meses anteriores (arredondada para cima de R$ 50). */
export async function suggestBudgetLimits(
  input: SuggestBudgetsInput,
): Promise<ActionResult<{ applied: number; undo: UndoTokenInfo }>> {
  return runAction(suggestBudgetsSchema, input, async ({ spaceId }) => {
    const { user, membership } = await requireMember(spaceId, "editor");
    const result = await service.suggestBudgetLimits(
      getDb(),
      { userId: user.id, memberId: membership.memberId },
      spaceId,
      todayInSaoPaulo(),
    );
    refresh();
    return result;
  });
}
