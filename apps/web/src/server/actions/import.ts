"use server";

import { todayInSaoPaulo, type YearMonth } from "@juntos/core";
import { revalidatePath } from "next/cache";
import { requireMember } from "../access";
import { writeActiveSpaceId } from "../active-space";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import * as service from "../services/import";
import type { UndoTokenInfo } from "../undo";
import {
  type CancelImportInput,
  type ConfirmImportInput,
  cancelImportSchema,
  confirmImportSchema,
  type ReviewImportInput,
  reviewImportSchema,
} from "../validators/import";

/*
 * Revisão e confirmação da importação (o upload em si é o Route Handler `/api/importar`). Só quem edita o espaço.
 */

/** "Já existe" de cada linha para o ano e o destino escolhidos. */
export async function reviewImport(input: ReviewImportInput): Promise<ActionResult<{ existing: boolean[] }>> {
  return runAction(reviewImportSchema, input, async (data) => {
    const { user } = await requireMember(data.spaceId, "editor");
    return { existing: await service.reviewImport(getDb(), user.id, data) };
  });
}

export interface ConfirmImportResult {
  readonly count: number;
  readonly spaceId: string;
  readonly createdSpace: boolean;
  readonly openMonth: YearMonth;
  readonly undo: UndoTokenInfo;
}

/** Grava os lançamentos escolhidos e devolve o "Desfazer" do lote. Num espaço novo, ele vira o ativo. */
export async function confirmImport(input: ConfirmImportInput): Promise<ActionResult<ConfirmImportResult>> {
  return runAction(confirmImportSchema, input, async (data) => {
    const { user, membership } = await requireMember(data.spaceId, "editor");
    const result = await service.confirmImport(
      getDb(),
      { userId: user.id, memberId: membership.memberId },
      data,
      todayInSaoPaulo(),
    );
    if (result.createdSpace) await writeActiveSpaceId(result.spaceId);
    revalidatePath("/", "layout");
    return result;
  });
}

/** "Cancelar": descarta o lote em revisão. */
export async function cancelImport(input: CancelImportInput): Promise<ActionResult<{ canceled: true }>> {
  return runAction(cancelImportSchema, input, async ({ spaceId, batchId }) => {
    const { user } = await requireMember(spaceId, "editor");
    await service.cancelImport(getDb(), user.id, spaceId, batchId);
    revalidatePath("/dados");
    return { canceled: true as const };
  });
}
