import { type Cents, computeDivision, type Division, type Settlement, ymAdd } from "@juntos/core";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { type Period, periodMonthsOf } from "@/lib/finance";
import type { Database, Executor } from "../db";
import { settlements, spaces } from "../db/schema";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { SPLIT_MESSAGES } from "../validators/settlements";
import { getSplitConfig, listSplitMembers, type SplitConfig, type SplitMember } from "./split";
import { listTransactions } from "./transactions";

/** Quem faz a ação (já conferido com `requireMember`). */
export interface SettlementActor {
  readonly userId: string;
}

/** Acerto registrado, como a tela mostra. */
export interface SettlementView extends Settlement {
  /** Quando foi registrado (ISO). */
  readonly settledAt: string;
}

/** "2026-11" → "2026-11-01": o acerto guarda o dia 1 do primeiro e do último mês do período. */
function monthStart(ym: string): string {
  return `${ym}-01`;
}

function lastMonthOf(period: Period): string {
  return ymAdd(period.start, period.span - 1);
}

/** Acertos (não desfeitos) cujo período cabe inteiro no período da tela. */
export async function listSettlements(db: Executor, spaceId: string, period: Period): Promise<SettlementView[]> {
  const rows = await db
    .select()
    .from(settlements)
    .where(
      and(
        eq(settlements.spaceId, spaceId),
        isNull(settlements.deletedAt),
        gte(settlements.periodStart, monthStart(period.start)),
        lte(settlements.periodEnd, monthStart(lastMonthOf(period))),
      ),
    )
    .orderBy(asc(settlements.settledAt), asc(settlements.id));
  return rows.map((row) => ({
    id: row.id,
    from: row.fromMember,
    to: row.toMember,
    amount: row.amountCents,
    periodStart: row.periodStart.slice(0, 7),
    periodEnd: row.periodEnd.slice(0, 7),
    settledAt: row.settledAt.toISOString(),
  }));
}

export interface SpaceDivision {
  readonly division: Division;
  readonly config: SplitConfig;
  readonly members: readonly SplitMember[];
  /** Acertos que entraram na conta do período. */
  readonly settlements: readonly SettlementView[];
}

/**
 * Divisão do espaço no período, com os dados reais: pessoas ativas, lançamentos do período, modo salvo e acertos
 * já registrados. A conta é do core (`computeDivision`); a renda do modo proporcional são só as entradas recebidas.
 */
export async function computeSpaceDivision(db: Executor, spaceId: string, period: Period): Promise<SpaceDivision> {
  const months = periodMonthsOf(period);
  const [members, config, txs, saved] = await Promise.all([
    listSplitMembers(db, spaceId),
    getSplitConfig(db, spaceId),
    listTransactions(db, spaceId, months),
    listSettlements(db, spaceId, period),
  ]);
  const division = computeDivision({
    members: members.map((member) => ({ id: member.id, name: member.name, active: true })),
    txs,
    mode: config.mode,
    customPct: config.pct,
    settlements: saved,
    period: { start: period.start, end: lastMonthOf(period) },
  });
  const applied = new Set(division.settlements.map((s) => s.id));
  return { division, config, members, settlements: saved.filter((s) => applied.has(s.id)) };
}

export interface RegisteredSettlement {
  readonly ids: readonly string[];
  /** Soma dos movimentos registrados. */
  readonly total: Cents;
}

/**
 * Registra o acerto do período: grava, numa transação, os movimentos que a divisão calcula agora, com início e
 * fim do período (decisão 6), e a diferença zera. O servidor refaz a conta (nunca confia em valor do cliente) e
 * trava a linha do espaço para duas requisições ao mesmo tempo não registrarem o mesmo acerto duas vezes.
 */
export async function registerSettlement(
  db: Database,
  actor: SettlementActor,
  spaceId: string,
  period: Period,
): Promise<RegisteredSettlement> {
  return db.transaction(async (tx) => {
    await tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.id, spaceId)).for("update");
    const { division } = await computeSpaceDivision(tx, spaceId, period);
    if (division.moves.length === 0) throw new DomainError(SPLIT_MESSAGES.nothingToSettle);
    const rows = await tx
      .insert(settlements)
      .values(
        division.moves.map((move) => ({
          spaceId,
          fromMember: move.from,
          toMember: move.to,
          amountCents: move.amount,
          periodStart: monthStart(period.start),
          periodEnd: monthStart(lastMonthOf(period)),
          createdBy: actor.userId,
        })),
      )
      .returning({ id: settlements.id });
    return { ids: rows.map((row) => row.id), total: division.moves.reduce((acc, move) => acc + move.amount, 0) };
  });
}

/** Desfaz acertos (soft delete) e devolve o token para "Desfazer" por 10 minutos. */
export async function removeSettlements(
  db: Database,
  actor: SettlementActor,
  spaceId: string,
  ids: readonly string[],
  now = new Date(),
): Promise<{ readonly undo: UndoTokenInfo; readonly removed: number }> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(settlements)
      .set({ deletedAt: now })
      .where(and(eq(settlements.spaceId, spaceId), inArray(settlements.id, [...ids]), isNull(settlements.deletedAt)))
      .returning({ id: settlements.id });
    if (rows.length === 0) throw new DomainError(SPLIT_MESSAGES.settlementNotFound);
    const undo = await createUndoToken(tx, {
      userId: actor.userId,
      spaceId,
      action: { type: "restore", entity: "settlements", ids: rows.map((row) => row.id) },
      now,
    });
    return { undo, removed: rows.length };
  });
}
