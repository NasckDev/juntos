import { type IsoDate, previousPeriod, type Role, todayInSaoPaulo } from "@juntos/core";
import { and, asc, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import { type Period, periodMonthsOf } from "@/lib/finance";
import { requireMember } from "./access";
import { getDb } from "./db";
import {
  budgets,
  goals,
  type NotificationType,
  type NotifyPreferences,
  notifications,
  spaceMembers,
  user,
} from "./db/schema";
import { getAppContext } from "./loaders";
import { listCategories } from "./services/categories-read";
import type {
  BudgetLine,
  CategoryView,
  EntryFormData,
  GoalView,
  MemberOption,
  RecurrenceView,
  TxView,
} from "./services/finance-types";
import { materializeMonths } from "./services/month";
import { listRecurrences } from "./services/recurrences-read";
import {
  hasTransactions,
  listTransactions,
  loadDescriptionMemories,
  loadPaymentMethods,
} from "./services/transactions";

/*
 * Leitura das telas financeiras (Server Components). Toda leitura confere que a pessoa participa do espaço
 * (`requireMember`, papel mínimo "viewer"), filtra pelo `space_id` e ignora o que foi excluído.
 * Abrir um mês ou período lança antes as contas fixas que faltam (`materializeMonths`, idempotente).
 */

/** `getAppContext` uma vez por requisição (o layout e a página precisam dele). */
export const loadAppContext = cache(getAppContext);

/** Pessoas ativas do espaço, a pessoa logada primeiro. */
export async function listActiveMembers(spaceId: string, userId: string): Promise<MemberOption[]> {
  const rows = await getDb()
    .select({ id: spaceMembers.id, userId: spaceMembers.userId, name: user.name, avatar: user.avatar })
    .from(spaceMembers)
    .innerJoin(user, eq(user.id, spaceMembers.userId))
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.status, "active")))
    .orderBy(asc(spaceMembers.joinedAt), asc(spaceMembers.createdAt));
  return rows
    .map((row) => ({ id: row.id, name: row.name, avatar: row.avatar, isYou: row.userId === userId }))
    .sort((a, b) => Number(b.isYou) - Number(a.isYou));
}

/** Quantas pessoas ativas tem cada espaço (seletor de espaço: "2 pessoas" ou "Só você"). */
export async function countMembers(spaceIds: readonly string[]): Promise<Record<string, number>> {
  if (spaceIds.length === 0) return {};
  const rows = await getDb()
    .select({ spaceId: spaceMembers.spaceId, total: count() })
    .from(spaceMembers)
    .where(and(inArray(spaceMembers.spaceId, [...spaceIds]), eq(spaceMembers.status, "active")))
    .groupBy(spaceMembers.spaceId);
  return Object.fromEntries(rows.map((row) => [row.spaceId, row.total]));
}

const TYPE_PREF: Record<NotificationType, keyof NotifyPreferences> = {
  late: "late",
  due: "due",
  budget: "budget",
  goal: "goal",
  invite: "people",
  auto: "auto",
};

/** Avisos ainda não vistos no espaço (para a pessoa ou para todos), respeitando os tipos ligados em Ajustes. */
export async function countUnseenNotifications(
  spaceId: string,
  userId: string,
  prefs: NotifyPreferences,
): Promise<number> {
  const types = (Object.keys(TYPE_PREF) as NotificationType[]).filter((type) => prefs[TYPE_PREF[type]]);
  if (types.length === 0) return 0;
  const [row] = await getDb()
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.spaceId, spaceId),
        or(isNull(notifications.userId), eq(notifications.userId, userId)),
        isNull(notifications.seenAt),
        inArray(notifications.type, types),
      ),
    );
  return row?.total ?? 0;
}

/** Dados do formulário de lançamento (abre em qualquer tela). */
export async function loadEntryFormData(spaceId: string): Promise<EntryFormData> {
  const { user: current, membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const [categories, members, memories, paymentMethods] = await Promise.all([
    listCategories(db, spaceId),
    listActiveMembers(spaceId, current.id),
    loadDescriptionMemories(db, spaceId),
    loadPaymentMethods(db, spaceId),
  ]);
  return {
    spaceId,
    role: membership.role,
    today: todayInSaoPaulo(),
    categories,
    members,
    currentMemberId: membership.memberId,
    memories,
    paymentMethods,
  };
}

async function loadBudgets(spaceId: string): Promise<BudgetLine[]> {
  const rows = await getDb()
    .select({ categoryId: budgets.categoryId, monthlyLimit: budgets.monthlyLimitCents })
    .from(budgets)
    .where(eq(budgets.spaceId, spaceId));
  return rows;
}

async function loadGoals(spaceId: string): Promise<GoalView[]> {
  // Subconsulta com nomes qualificados: sem junção, o drizzle escreve as colunas sem o nome da tabela.
  const saved = sql<number>`coalesce((
    select sum(gd.amount_cents) from goal_deposits gd
    inner join transactions t on t.id = gd.transaction_id
    where gd.goal_id = "goals"."id" and t.deleted_at is null
  ), 0)`.mapWith(Number);
  return getDb()
    .select({
      id: goals.id,
      name: goals.name,
      icon: goals.icon,
      target: goals.targetCents,
      saved,
      monthly: goals.monthlyCents,
    })
    .from(goals)
    .where(and(eq(goals.spaceId, spaceId), isNull(goals.deletedAt)))
    .orderBy(asc(goals.createdAt));
}

export interface HomeData {
  readonly today: IsoDate;
  readonly period: Period;
  /** O espaço tem algum lançamento (senão, os primeiros passos). */
  readonly hasData: boolean;
  readonly txs: readonly TxView[];
  /** Período anterior de mesmo tamanho (variação e "Vale saber"). */
  readonly previousTxs: readonly TxView[];
  readonly recurrences: readonly RecurrenceView[];
  readonly categories: readonly CategoryView[];
  readonly budgets: readonly BudgetLine[];
  readonly goals: readonly GoalView[];
  readonly role: Role;
}

/** Início: o período, o anterior (para comparar), contas fixas, orçamento e metas. */
export async function loadHomeData(spaceId: string, period: Period): Promise<HomeData> {
  const { membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  const months = periodMonthsOf(period);
  const previous = previousPeriod(period.start, period.span);
  await materializeMonths(db, spaceId, [...previous, ...months], today);
  const [txs, previousTxs, hasData, recurrences, categories, budgetLines, goalList] = await Promise.all([
    listTransactions(db, spaceId, months),
    listTransactions(db, spaceId, previous),
    hasTransactions(db, spaceId),
    listRecurrences(db, spaceId),
    listCategories(db, spaceId),
    loadBudgets(spaceId),
    loadGoals(spaceId),
  ]);
  return {
    today,
    period,
    hasData,
    txs,
    previousTxs,
    recurrences,
    categories,
    budgets: budgetLines,
    goals: goalList,
    role: membership.role,
  };
}

export interface LancamentosData {
  readonly today: IsoDate;
  readonly period: Period;
  readonly hasData: boolean;
  readonly txs: readonly TxView[];
  readonly recurrences: readonly RecurrenceView[];
  readonly categories: readonly CategoryView[];
  readonly members: readonly MemberOption[];
  readonly role: Role;
}

/** Lançamentos: lista e calendário do período e as contas fixas. */
export async function loadLancamentosData(spaceId: string, period: Period): Promise<LancamentosData> {
  const { user: current, membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  const months = periodMonthsOf(period);
  await materializeMonths(db, spaceId, months, today);
  const [txs, hasData, recurrences, categories, members] = await Promise.all([
    listTransactions(db, spaceId, months),
    hasTransactions(db, spaceId),
    listRecurrences(db, spaceId),
    listCategories(db, spaceId),
    listActiveMembers(spaceId, current.id),
  ]);
  return { today, period, hasData, txs, recurrences, categories, members, role: membership.role };
}
