"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/split";
import { type SetSplitInput, setSplitSchema } from "../validators/split";

/** Modo de divisão do espaço (partes iguais, pela renda, personalizado). Só `owner` e `editor` mudam. */
export async function setSplitMode(input: SetSplitInput): Promise<ActionResult<service.SplitConfig>> {
  return runAction(setSplitSchema, input, async (data) => {
    await requireMember(data.spaceId, "editor");
    const config = await service.setSplitConfig(getDb(), data.spaceId, data);
    revalidatePath("/", "layout");
    return config;
  });
}
