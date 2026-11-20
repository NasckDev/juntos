"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/settlements";
import type { UndoTokenInfo } from "../undo";
import {
  type RegisterSettlementInput,
  registerSettlementSchema,
  type UnsettleInput,
  unsettleSchema,
} from "../validators/settlements";

/*
 * Acertos da divisão. Quem só vê (viewer) lê, mas não registra nem desfaz: as duas ações exigem `editor`
 * (ou `owner`).
 */

async function editor(spaceId: string): Promise<service.SettlementActor> {
  const { user } = await requireMember(spaceId, "editor");
  return { userId: user.id };
}

function refresh(): void {
  revalidatePath("/", "layout");
}

/**
 * "Registrar acerto": grava os movimentos que a divisão calcula agora para o período (início e fim) e zera a
 * diferença. O cliente só diz qual período; os valores vêm sempre do servidor.
 */
export async function registerSettlement(
  input: RegisterSettlementInput,
): Promise<ActionResult<service.RegisteredSettlement>> {
  return runAction(registerSettlementSchema, input, async ({ spaceId, start, span }) => {
    const actor = await editor(spaceId);
    const registered = await service.registerSettlement(getDb(), actor, spaceId, { start, span });
    refresh();
    return registered;
  });
}

/** "Desfazer" um acerto (ou o lote que acabou de ser registrado); volta com `undo({ token })` por 10 minutos. */
export async function unsettle(input: UnsettleInput): Promise<ActionResult<{ undo: UndoTokenInfo; removed: number }>> {
  return runAction(unsettleSchema, input, async ({ spaceId, ids }) => {
    const actor = await editor(spaceId);
    const result = await service.removeSettlements(getDb(), actor, spaceId, ids);
    refresh();
    return result;
  });
}
