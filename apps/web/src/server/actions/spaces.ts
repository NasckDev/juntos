"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../access";
import { writeActiveSpaceId } from "../active-space";
import { getDb } from "../db";
import { assertMember } from "../membership";
import { enforceUserRateLimit, RATE_RULES } from "../rate-limit";
import { type ActionResult, runAction } from "../result";
import * as spaces from "../services/spaces";
import type { UndoTokenInfo } from "../undo";
import {
  type CreateSpaceInput,
  createSpaceSchema,
  type DeleteSpaceInput,
  deleteSpaceSchema,
  type RenameSpaceInput,
  renameSpaceSchema,
  type SwitchSpaceInput,
  switchSpaceSchema,
} from "../validators/spaces";

/** Cria um espaço vazio (a pessoa é a dona) e já o deixa ativo. No máximo 10 por dia. */
export async function createSpace(input: CreateSpaceInput): Promise<ActionResult<spaces.SpaceSummary>> {
  return runAction(createSpaceSchema, input, async ({ name }) => {
    const user = await requireUser();
    await enforceUserRateLimit(getDb(), RATE_RULES.spaceCreate, user.id);
    const created = await spaces.createSpace(getDb(), user.id, name);
    await writeActiveSpaceId(created.id);
    revalidatePath("/", "layout");
    return created;
  });
}

/** Renomeia (só o dono). */
export async function renameSpace(input: RenameSpaceInput): Promise<ActionResult<{ name: string }>> {
  return runAction(renameSpaceSchema, input, async ({ spaceId, name }) => {
    const user = await requireUser();
    await spaces.renameSpace(getDb(), user.id, spaceId, name);
    revalidatePath("/", "layout");
    return { name };
  });
}

/** Exclui (só o dono), com "Desfazer" por 10 minutos (`undo({ token })`). */
export async function deleteSpace(
  input: DeleteSpaceInput,
): Promise<ActionResult<{ undo: UndoTokenInfo; nextSpaceId: string }>> {
  return runAction(deleteSpaceSchema, input, async ({ spaceId }) => {
    const user = await requireUser();
    const result = await spaces.deleteSpace(getDb(), user.id, spaceId);
    await writeActiveSpaceId(result.nextSpaceId);
    revalidatePath("/", "layout");
    return result;
  });
}

/** Troca o espaço ativo (guardado em cookie). */
export async function switchSpace(input: SwitchSpaceInput): Promise<ActionResult<{ spaceId: string }>> {
  return runAction(switchSpaceSchema, input, async ({ spaceId }) => {
    const user = await requireUser();
    await assertMember(getDb(), user.id, spaceId, "viewer");
    await writeActiveSpaceId(spaceId);
    revalidatePath("/", "layout");
    return { spaceId };
  });
}
