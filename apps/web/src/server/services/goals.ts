import { depositTx, type Goal, type IsoDate, todayParts, validateDeposit } from "@juntos/core";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Database, Executor } from "../db";
import { categories, goalDeposits, goals, transactions } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { GOAL_MESSAGES, type UpdateGoalData } from "../validators/goals";
import type { GoalView } from "./finance-types";
import type { Actor } from "./transactions";

type GoalRow = typeof goals.$inferSelect;

/**
 * Soma dos depósitos cujo lançamento "Guardado" não foi excluído. Nomes qualificados: a subconsulta não pode depender
 * de como o drizzle escreve as colunas da consulta externa.
 */
function savedSql(goalId: ReturnType<typeof sql>) {
  return sql<number>`coalesce((
    select sum(gd.amount_cents) from goal_deposits gd
    inner join transactions t on t.id = gd.transaction_id
    where gd.goal_id = ${goalId} and t.deleted_at is null
  ), 0)`.mapWith(Number);
}

/** Metas do espaço (as excluídas não aparecem), da mais antiga para a mais nova, com o quanto já foi guardado. */
export async function listGoals(db: Executor, spaceId: string): Promise<GoalView[]> {
  return db
    .select({
      id: goals.id,
      name: goals.name,
      icon: goals.icon,
      target: goals.targetCents,
      saved: savedSql(sql`"goals"."id"`),
      monthly: goals.monthlyCents,
    })
    .from(goals)
    .where(and(eq(goals.spaceId, spaceId), isNull(goals.deletedAt)))
    .orderBy(asc(goals.createdAt));
}

async function savedInGoal(db: Executor, goalId: string): Promise<number> {
  const [row] = await db
    .select({ saved: savedSql(sql`${goalId}::uuid`) })
    .from(goals)
    .where(eq(goals.id, goalId));
  return row?.saved ?? 0;
}

/** O nome da meta não pode repetir o de outra meta do espaço (sem diferenciar maiúsculas). */
async function assertNameFree(db: Executor, spaceId: string, name: string, exceptId: string | null): Promise<void> {
  const rows = await db
    .select({ id: goals.id })
    .from(goals)
    .where(
      and(eq(goals.spaceId, spaceId), isNull(goals.deletedAt), sql`lower(trim(${goals.name})) = ${name.toLowerCase()}`),
    );
  if (rows.some((row) => row.id !== exceptId)) throw new DomainError(GOAL_MESSAGES.nameTaken, "name");
}

async function reserveCategoryId(db: Executor): Promise<string> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(isNull(categories.spaceId), eq(categories.key, "reserva")));
  if (!row) throw new Error("Categoria padrão Reserva não encontrada.");
  return row.id;
}

/** Busca a meta e a trava até o fim da transação (depósitos e edições da mesma meta não se misturam). */
async function lockGoal(db: Executor, spaceId: string, id: string): Promise<GoalRow> {
  const [row] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.spaceId, spaceId), isNull(goals.deletedAt)))
    .for("update");
  if (!row) throw new DomainError(GOAL_MESSAGES.notFound);
  return row;
}

export interface DepositResult {
  readonly goalId: string;
  readonly transactionId: string;
  readonly saved: number;
  readonly target: number;
  /** Este depósito completou a meta. */
  readonly reached: boolean;
}

/**
 * Grava o depósito: o lançamento "Guardado" (pago, categoria Reserva, no mês de hoje, o `depositTx` do core) e a
 * ligação em `goal_deposits`. Quem chama já travou a meta, então dois depósitos ao mesmo tempo não passam juntos do
 * que falta (`validateDeposit`).
 */
async function recordDeposit(
  tx: Executor,
  actor: Actor,
  row: GoalRow,
  amount: number,
  today: IsoDate,
): Promise<DepositResult> {
  const saved = await savedInGoal(tx, row.id);
  const goal: Goal = { id: row.id, name: row.name, target: row.targetCents, saved, monthly: row.monthlyCents };
  const check = validateDeposit(goal, amount);
  if (!check.ok) throw new DomainError(check.error, "amount");
  const model = depositTx(goal, amount, today, actor.memberId);
  const [created] = await tx
    .insert(transactions)
    .values({
      spaceId: row.spaceId,
      kind: model.kind,
      description: model.description,
      amountCents: model.amount,
      competence: `${todayParts(today).ym}-01`,
      day: model.day,
      categoryId: await reserveCategoryId(tx),
      paid: model.paid,
      paidAt: today,
      paymentMethod: model.paymentMethod,
      paidBy: model.paidBy,
      personal: model.personal,
      note: model.note,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    })
    .returning({ id: transactions.id });
  if (!created) throw new Error("Falha ao gravar o lançamento Guardado.");
  await tx.insert(goalDeposits).values({
    spaceId: row.spaceId,
    goalId: row.id,
    transactionId: created.id,
    amountCents: amount,
  });
  const total = saved + amount;
  return {
    goalId: row.id,
    transactionId: created.id,
    saved: total,
    target: row.targetCents,
    reached: total >= row.targetCents,
  };
}

/** "Guardar nesta meta": lançamento Guardado e depósito na mesma transação. */
export async function depositToGoal(
  db: Database,
  actor: Actor,
  spaceId: string,
  goalId: string,
  amount: number,
  today: IsoDate,
): Promise<DepositResult> {
  return db.transaction(async (tx) => recordDeposit(tx, actor, await lockGoal(tx, spaceId, goalId), amount, today));
}

export interface NewGoalData {
  readonly name: string;
  readonly icon: string;
  readonly target: number;
  readonly saved: number;
  readonly monthly: number;
}

/** Meta nova. O "já guardado" entra como um depósito (lançamento Guardado de hoje), igual a qualquer outro. */
export async function createGoal(
  db: Database,
  actor: Actor,
  spaceId: string,
  data: NewGoalData,
  today: IsoDate,
): Promise<{ id: string; transactionId: string | null }> {
  return db.transaction(async (tx) => {
    await assertNameFree(tx, spaceId, data.name, null);
    const [row] = await tx
      .insert(goals)
      .values({
        spaceId,
        name: data.name,
        icon: data.icon,
        targetCents: data.target,
        monthlyCents: data.monthly,
        createdBy: actor.userId,
      })
      .returning();
    if (!row) throw new Error("Falha ao gravar a meta.");
    if (data.saved <= 0) return { id: row.id, transactionId: null };
    const deposit = await recordDeposit(tx, actor, row, data.saved, today);
    return { id: row.id, transactionId: deposit.transactionId };
  });
}

/** Edita nome, tipo, valor da meta e valor por mês. A meta não pode ficar menor do que já foi guardado. */
export async function updateGoal(db: Database, spaceId: string, data: UpdateGoalData): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const row = await lockGoal(tx, spaceId, data.id);
    await assertNameFree(tx, spaceId, data.name, row.id);
    const saved = await savedInGoal(tx, row.id);
    if (data.target < saved) throw new DomainError(GOAL_MESSAGES.savedOverTarget, "target");
    await tx
      .update(goals)
      .set({ name: data.name, icon: data.icon, targetCents: data.target, monthlyCents: data.monthly })
      .where(eq(goals.id, row.id));
    return { id: row.id };
  });
}

/**
 * Exclui a meta com "Desfazer" (10 minutos). Os lançamentos "Guardado" dos depósitos continuam: o dinheiro guardado
 * não deixa de existir porque a meta foi apagada.
 */
export async function deleteGoal(
  db: Database,
  actor: Actor,
  spaceId: string,
  id: string,
): Promise<{ undo: UndoTokenInfo }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(goals)
      .set({ deletedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.spaceId, spaceId), isNull(goals.deletedAt)))
      .returning({ id: goals.id });
    if (rows.length === 0) throw new DomainError(GOAL_MESSAGES.notFound);
    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: { type: "restore", entity: "goals", ids: [id] },
    });
    return { undo };
  });
}
