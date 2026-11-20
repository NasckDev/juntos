import { type Cents, type IsoDate, suggestBudgets, todayParts, ymAdd } from "@juntos/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { budgets, type PreviousBudget } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { BUDGET_MESSAGES } from "../validators/budgets";
import { assertCategory } from "./categories-read";
import type { BudgetLine } from "./finance-types";
import { materializeMonths } from "./month";
import { type Actor, listTransactions } from "./transactions";

/** Limites por categoria do espaço. */
export async function listBudgets(db: Executor, spaceId: string): Promise<BudgetLine[]> {
  return db
    .select({ categoryId: budgets.categoryId, monthlyLimit: budgets.monthlyLimitCents })
    .from(budgets)
    .where(eq(budgets.spaceId, spaceId));
}

/** Define (ou, com `null`, tira) o limite mensal de uma categoria de saída. */
export async function setBudget(
  db: Executor,
  spaceId: string,
  categoryId: string,
  limit: Cents | null,
): Promise<{ categoryId: string; limit: Cents | null }> {
  await assertCategory(db, spaceId, categoryId, "out");
  if (limit === null) {
    await db.delete(budgets).where(and(eq(budgets.spaceId, spaceId), eq(budgets.categoryId, categoryId)));
    return { categoryId, limit: null };
  }
  await db
    .insert(budgets)
    .values({ spaceId, categoryId, monthlyLimitCents: limit })
    .onConflictDoUpdate({ target: [budgets.spaceId, budgets.categoryId], set: { monthlyLimitCents: limit } });
  return { categoryId, limit };
}

/** Meses da sugestão: os 3 anteriores ao mês de hoje. */
export const SUGGESTION_LOOKBACK = [1, 2, 3] as const;

/**
 * "Sugerir pelos últimos 3 meses": limite = média dos 3 meses anteriores, arredondada para cima de R$ 50
 * (`suggestBudgets` do core). Lança antes as contas fixas que faltam nesses meses (como as outras telas) e devolve
 * o token de "Desfazer", que volta cada categoria ao limite que tinha.
 */
export async function suggestBudgetLimits(
  db: Database,
  actor: Actor,
  spaceId: string,
  today: IsoDate,
): Promise<{ applied: number; undo: UndoTokenInfo }> {
  const nowYm = todayParts(today).ym;
  const months = SUGGESTION_LOOKBACK.map((back) => ymAdd(nowYm, -back));
  await materializeMonths(db, spaceId, months, today);
  const suggestion = suggestBudgets(await listTransactions(db, spaceId, months));
  const categoryIds = Object.keys(suggestion);
  if (categoryIds.length === 0) throw new DomainError(BUDGET_MESSAGES.noHistory);

  return db.transaction(async (tx) => {
    const current = await tx
      .select({ categoryId: budgets.categoryId, limit: budgets.monthlyLimitCents })
      .from(budgets)
      .where(and(eq(budgets.spaceId, spaceId), inArray(budgets.categoryId, categoryIds)));
    const before = new Map(current.map((row) => [row.categoryId, row.limit]));
    const previous: PreviousBudget[] = categoryIds.map((categoryId) => ({
      categoryId,
      limitCents: before.get(categoryId) ?? null,
    }));
    await tx
      .insert(budgets)
      .values(
        categoryIds.map((categoryId) => ({ spaceId, categoryId, monthlyLimitCents: suggestion[categoryId] ?? 0 })),
      )
      .onConflictDoUpdate({
        target: [budgets.spaceId, budgets.categoryId],
        set: { monthlyLimitCents: sql`excluded.monthly_limit_cents` },
      });
    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: { type: "restore-budgets", previous },
    });
    return { applied: categoryIds.length, undo };
  });
}
