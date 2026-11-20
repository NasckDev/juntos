"use server";

import { todayInSaoPaulo } from "@juntos/core";
import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/recurrences";
import type { Actor } from "../services/transactions";
import type { UndoTokenInfo } from "../undo";
import {
  type RecurrenceRefInput,
  recurrenceRefSchema,
  type SetRecurrencePausedInput,
  setRecurrencePausedSchema,
  type UpdateRecurrenceInput,
  updateRecurrenceSchema,
} from "../validators/recurrences";

/* Contas fixas: só `editor` e `owner` mudam. Criar é pelo formulário de lançamento, com "Repetir". */

async function editor(spaceId: string): Promise<Actor> {
  const { user, membership } = await requireMember(spaceId, "editor");
  return { userId: user.id, memberId: membership.memberId };
}

/** Descrição, valor, dia e categoria; vale do mês atual em diante, nos lançamentos em aberto. */
export async function updateRecurrence(input: UpdateRecurrenceInput): Promise<ActionResult<{ id: string }>> {
  return runAction(updateRecurrenceSchema, input, async (data) => {
    const actor = await editor(data.spaceId);
    const result = await service.updateRecurrence(getDb(), actor, data, todayInSaoPaulo());
    revalidatePath("/", "layout");
    return result;
  });
}

/** Pausar (apaga os futuros em aberto) ou retomar. */
export async function setRecurrencePaused(
  input: SetRecurrencePausedInput,
): Promise<ActionResult<{ id: string; paused: boolean }>> {
  return runAction(setRecurrencePausedSchema, input, async ({ spaceId, id, paused }) => {
    const actor = await editor(spaceId);
    const result = await service.setRecurrencePaused(getDb(), actor, spaceId, id, paused, todayInSaoPaulo());
    revalidatePath("/", "layout");
    return result;
  });
}

/** Exclui (para de repetir), com "Desfazer" por 10 minutos. */
export async function deleteRecurrence(input: RecurrenceRefInput): Promise<ActionResult<{ undo: UndoTokenInfo }>> {
  return runAction(recurrenceRefSchema, input, async ({ spaceId, id }) => {
    const actor = await editor(spaceId);
    const result = await service.deleteRecurrence(getDb(), actor, spaceId, id, todayInSaoPaulo());
    revalidatePath("/", "layout");
    return result;
  });
}
