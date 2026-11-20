"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import { applyUndo } from "../undo";
import { type UndoInput, undoSchema } from "../validators/undo";

/** Botão "Desfazer" do toast: restaura o que foi excluído ou reverte o lote (até 10 minutos). */
export async function undo(input: UndoInput): Promise<ActionResult<{ spaceId: string; affected: number }>> {
  return runAction(undoSchema, input, async ({ token }) => {
    const user = await requireUser();
    const result = await applyUndo(getDb(), user.id, token);
    revalidatePath("/", "layout");
    return { spaceId: result.spaceId, affected: result.affected };
  });
}
