"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/categories";
import type { UndoTokenInfo } from "../undo";
import {
  type CategoryRefInput,
  type CreateCategoryInput,
  categoryRefSchema,
  createCategorySchema,
} from "../validators/categories";

/* Categorias do espaço. Mutações exigem `editor` (ou `owner`); as categorias padrão são globais e não mudam. */

function refresh(): void {
  revalidatePath("/", "layout");
}

/** Cria uma categoria do espaço (e o limite mensal, se vier). */
export async function createCategory(input: CreateCategoryInput): Promise<ActionResult<{ id: string }>> {
  return runAction(createCategorySchema, input, async (data) => {
    await requireMember(data.spaceId, "editor");
    const created = await service.createCategory(getDb(), data.spaceId, data);
    refresh();
    return created;
  });
}

/** Exclui uma categoria personalizada, mandando o que estava nela para a de reserva, com "Desfazer". */
export async function deleteCategory(input: CategoryRefInput): Promise<ActionResult<{ undo: UndoTokenInfo }>> {
  return runAction(categoryRefSchema, input, async ({ spaceId, id }) => {
    const { user, membership } = await requireMember(spaceId, "editor");
    const result = await service.deleteCategory(
      getDb(),
      { userId: user.id, memberId: membership.memberId },
      spaceId,
      id,
    );
    refresh();
    return result;
  });
}
