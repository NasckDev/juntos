"use server";

import { todayInSaoPaulo } from "@juntos/core";
import { requireMember } from "../access";
import { getDb } from "../db";
import { type ActionResult, runAction } from "../result";
import { type ExportSummary, summarizeExport } from "../services/export";
import { type ExportFilterInput, exportFilterSchema } from "../validators/export";

/** Resumo ao vivo da exportação (quantos lançamentos e os totais) com os filtros da tela. Quem só vê nunca grava. */
export async function getExportSummary(input: ExportFilterInput): Promise<ActionResult<ExportSummary>> {
  return runAction(exportFilterSchema, input, async (filter) => {
    const { membership } = await requireMember(filter.spaceId, "viewer");
    return summarizeExport(getDb(), filter, todayInSaoPaulo(), membership.role);
  });
}
