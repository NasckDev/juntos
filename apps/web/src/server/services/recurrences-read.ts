import type { Recurrence } from "@juntos/core";
import { ymAdd } from "@juntos/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Executor } from "../db";
import { recurrences } from "../db/schema";
import type { RecurrenceView } from "./finance-types";

type RecurrenceRow = typeof recurrences.$inferSelect;

/** Linha do banco → conta fixa do core. */
export function recurrenceToCore(row: RecurrenceRow): Recurrence {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    amount: row.amountCents,
    categoryId: row.categoryId,
    frequency: row.frequency,
    day: row.day,
    start: row.startCompetence.slice(0, 7),
    installmentsTotal: row.installmentsTotal,
    paymentMethod: row.paymentMethod,
    paidBy: row.paidBy,
    personal: row.personal,
    paused: row.paused,
  };
}

export function toRecurrenceView(row: RecurrenceRow): RecurrenceView {
  const core = recurrenceToCore(row);
  return {
    ...core,
    endCompetence: core.installmentsTotal === null ? null : ymAdd(core.start, core.installmentsTotal - 1),
  };
}

/** Contas fixas do espaço (as excluídas não aparecem), pelo dia e pelo nome. */
export async function listRecurrences(db: Executor, spaceId: string): Promise<RecurrenceView[]> {
  const rows = await db
    .select()
    .from(recurrences)
    .where(and(eq(recurrences.spaceId, spaceId), isNull(recurrences.deletedAt)))
    .orderBy(asc(recurrences.day), asc(recurrences.description));
  return rows.map(toRecurrenceView);
}
