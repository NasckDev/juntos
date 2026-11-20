import {
  currentNotices,
  DEFAULT_NOTICE_PREFS,
  type Goal,
  type IsoDate,
  type Member,
  type Notice,
  type NoticePrefs,
  type NoticeTarget,
  todayParts,
} from "@juntos/core";
import { and, desc, eq, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import type { NoticeFilter } from "@/lib/notices";
import type { Database, Executor } from "../db";
import {
  budgets,
  goals,
  NOTIFICATION_TYPES,
  type NotificationType,
  type NotifyPreferences,
  notificationReads,
  notifications,
  spaceMembers,
  transactions,
} from "../db/schema";
import { listCategories } from "./categories-read";
import { toCoreCategories } from "./export";
import type { TxView } from "./finance-types";
import { materializeMonths } from "./month";
import { competenceDate, toTxView } from "./transactions";

/*
 * Central de notificações (`notifs`, `syncEv`, `logEv` e `vAvisos` do protótipo).
 *
 * - Os avisos ativos são calculados agora pelo core (`currentNotices`) com os dados reais do espaço.
 * - O histórico é a tabela `notifications`, uma por espaço: cada aviso entra uma vez (índice único em
 *   `space_id + dedupe_key`) e ficam guardados os últimos 200. Todos os tipos são guardados; o que cada pessoa vê
 *   (lista, contador do sino, push) respeita os tipos que ela ligou em Ajustes > Avisos.
 * - Visto e lido são de cada pessoa (`notification_reads`): no aviso do espaço todo, cada membro tem o seu.
 */

/** Quantos avisos ficam no histórico de cada espaço. */
export const HISTORY_LIMIT = 200;

/** Preferência que liga cada tipo; `null` = sempre aparece (aviso de importação, feito pela própria pessoa). */
export const NOTICE_PREF: Readonly<Record<NotificationType, keyof NotifyPreferences | null>> = {
  late: "late",
  due: "due",
  budget: "budget",
  goal: "goal",
  invite: "people",
  auto: "auto",
  import: null,
};

/** Tipos que a pessoa quer ver. */
export function enabledTypes(prefs: NotifyPreferences): NotificationType[] {
  return NOTIFICATION_TYPES.filter((type) => {
    const key = NOTICE_PREF[type];
    return key === null || prefs[key];
  });
}

const FILTER_TYPES: Readonly<Record<Exclude<NoticeFilter, "todas" | "nao-lidas">, readonly NotificationType[]>> = {
  contas: ["late", "due"],
  automaticos: ["auto"],
  pessoas: ["invite"],
  plano: ["budget", "goal"],
};

/** Para onde o aviso leva (as telas do app). */
export const TARGET_HREF: Readonly<Record<NoticeTarget, string>> = {
  lancamentos: "/lancamentos",
  planejar: "/planejamento",
  ajustes: "/ajustes/pessoas",
};

export function toNoticePrefs(prefs: NotifyPreferences): NoticePrefs {
  return {
    late: prefs.late,
    due: prefs.due,
    budget: prefs.budget,
    goal: prefs.goal,
    people: prefs.people,
    auto: prefs.auto,
  };
}

/** Saídas em aberto de meses passados (atrasadas) e todo o mês de hoje (vencendo e orçamento). */
async function noticeTransactions(db: Executor, spaceId: string, today: IsoDate): Promise<TxView[]> {
  const current = competenceDate(todayParts(today).ym);
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.spaceId, spaceId),
        isNull(transactions.deletedAt),
        or(
          eq(transactions.competence, current),
          and(lt(transactions.competence, current), eq(transactions.paid, false)),
        ),
      ),
    );
  return rows.map((row) => toTxView(row));
}

async function noticeGoals(db: Executor, spaceId: string): Promise<Goal[]> {
  const saved = sql<number>`coalesce((
    select sum(gd.amount_cents) from goal_deposits gd
    inner join transactions t on t.id = gd.transaction_id
    where gd.goal_id = "goals"."id" and t.deleted_at is null
  ), 0)`.mapWith(Number);
  return db
    .select({ id: goals.id, name: goals.name, target: goals.targetCents, saved, monthly: goals.monthlyCents })
    .from(goals)
    .where(and(eq(goals.spaceId, spaceId), isNull(goals.deletedAt)));
}

/** Convites pendentes viram membros inativos (o core gera "Convite aguardando resposta"). */
async function pendingInvites(db: Executor, spaceId: string): Promise<Member[]> {
  const rows = await db
    .select({ id: spaceMembers.id, email: spaceMembers.invitedEmail })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.status, "invited")));
  return rows.map((row) => ({ id: row.id, name: row.email ?? "Alguém", active: false }));
}

/** Avisos ativos hoje no espaço, para as preferências informadas. */
export async function computeNotices(
  db: Executor,
  spaceId: string,
  today: IsoDate,
  prefs: NoticePrefs = DEFAULT_NOTICE_PREFS,
): Promise<Notice[]> {
  const [txs, budgetRows, goalList, members, categories] = await Promise.all([
    noticeTransactions(db, spaceId, today),
    db
      .select({ categoryId: budgets.categoryId, limit: budgets.monthlyLimitCents })
      .from(budgets)
      .where(eq(budgets.spaceId, spaceId)),
    noticeGoals(db, spaceId),
    pendingInvites(db, spaceId),
    listCategories(db, spaceId),
  ]);
  return currentNotices({
    today,
    txs,
    budgets: Object.fromEntries(budgetRows.map((row) => [row.categoryId, row.limit])),
    goals: goalList,
    members,
    categories: toCoreCategories(categories),
    prefs,
  });
}

export interface StoredNotice {
  readonly id: string;
  readonly type: NotificationType;
  readonly dedupeKey: string;
  readonly title: string;
  readonly body: string;
  readonly href: string | null;
}

/** Apaga o que passou dos últimos 200 avisos do espaço. */
export async function trimHistory(db: Executor, spaceId: string): Promise<number> {
  const keep = db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.spaceId, spaceId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(HISTORY_LIMIT);
  const removed = await db
    .delete(notifications)
    .where(and(eq(notifications.spaceId, spaceId), notInArray(notifications.id, keep)))
    .returning({ id: notifications.id });
  return removed.length;
}

/**
 * Leva os avisos ativos para o histórico (`syncEv`), sem repetir a mesma chave. Antes, lança as contas fixas do mês
 * de hoje (que também registram "N contas fixas lançadas"). Devolve só os avisos que entraram agora.
 */
export async function syncNotices(db: Database, spaceId: string, today: IsoDate): Promise<StoredNotice[]> {
  const ym = todayParts(today).ym;
  await materializeMonths(db, spaceId, [ym], today);
  const notices = await computeNotices(db, spaceId, today);
  if (notices.length === 0) return [];
  const inserted = await db
    .insert(notifications)
    .values(
      notices.map((notice) => ({
        spaceId,
        type: notice.kind,
        dedupeKey: notice.dedupeKey,
        title: notice.title,
        body: notice.body,
        href: TARGET_HREF[notice.target],
        competence: competenceDate(ym),
      })),
    )
    .onConflictDoNothing({ target: [notifications.spaceId, notifications.dedupeKey] })
    .returning({
      id: notifications.id,
      type: notifications.type,
      dedupeKey: notifications.dedupeKey,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
    });
  if (inserted.length > 0) await trimHistory(db, spaceId);
  return inserted;
}

export interface HistoryItem extends StoredNotice {
  /** ISO 8601. */
  readonly createdAt: string;
  readonly read: boolean;
}

/** Avisos da pessoa no espaço: os dela e os do espaço todo. */
export function addressedTo(spaceId: string, userId: string) {
  return and(eq(notifications.spaceId, spaceId), or(isNull(notifications.userId), eq(notifications.userId, userId)));
}

/** Avisos que a pessoa pode ver no espaço (dela ou de todos), dos tipos ligados. */
function visibleTo(spaceId: string, userId: string, types: readonly NotificationType[]) {
  return and(addressedTo(spaceId, userId), inArray(notifications.type, [...types]));
}

/** Liga cada aviso ao visto e lido desta pessoa (sem linha = nem visto nem lido). */
export function readsOf(userId: string) {
  return and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, userId));
}

export interface History {
  readonly items: readonly HistoryItem[];
  /** Não lidas (todas as categorias), para o chip "Não lidas (N)" e o "Marcar todas como lidas". */
  readonly unread: number;
  /** Ainda não vistas (contador do sino). */
  readonly unseen: number;
}

/** Histórico com o filtro escolhido, mais recentes primeiro. */
export async function listHistory(
  db: Executor,
  spaceId: string,
  userId: string,
  prefs: NotifyPreferences,
  filter: NoticeFilter,
): Promise<History> {
  const types = enabledTypes(prefs);
  if (types.length === 0) return { items: [], unread: 0, unseen: 0 };
  const shown =
    filter === "todas" || filter === "nao-lidas" ? types : types.filter((t) => FILTER_TYPES[filter].includes(t));
  const [rows, [counts]] = await Promise.all([
    shown.length === 0
      ? Promise.resolve([])
      : db
          .select({ notice: notifications, readAt: notificationReads.readAt })
          .from(notifications)
          .leftJoin(notificationReads, readsOf(userId))
          .where(
            and(
              visibleTo(spaceId, userId, shown),
              filter === "nao-lidas" ? isNull(notificationReads.readAt) : undefined,
            ),
          )
          .orderBy(desc(notifications.createdAt), desc(notifications.id))
          .limit(HISTORY_LIMIT),
    db
      .select({
        unread: sql<number>`count(*) filter (where ${notificationReads.readAt} is null)`.mapWith(Number),
        unseen: sql<number>`count(*) filter (where ${notificationReads.seenAt} is null)`.mapWith(Number),
      })
      .from(notifications)
      .leftJoin(notificationReads, readsOf(userId))
      .where(visibleTo(spaceId, userId, types)),
  ]);
  return {
    items: rows.map(({ notice, readAt }) => ({
      id: notice.id,
      type: notice.type,
      dedupeKey: notice.dedupeKey,
      title: notice.title,
      body: notice.body,
      href: notice.href,
      createdAt: notice.createdAt.toISOString(),
      read: readAt !== null,
    })),
    unread: counts?.unread ?? 0,
    unseen: counts?.unseen ?? 0,
  };
}

const at = (now: Date) => sql`${now.toISOString()}::timestamptz`;

/** Abrir a central marca como vistos, só para esta pessoa, os avisos que ela ainda não viu (o sino dela zera). */
export async function markSeen(db: Executor, spaceId: string, userId: string, now = new Date()): Promise<number> {
  // `insert ... select` exige as colunas na ordem da tabela.
  const unseen = db
    .select({
      notificationId: notifications.id,
      userId: sql<string>`${userId}::text`.as("user_id"),
      seenAt: sql<Date>`${at(now)}`.as("seen_at"),
      readAt: sql<Date | null>`null::timestamptz`.as("read_at"),
    })
    .from(notifications)
    .leftJoin(notificationReads, readsOf(userId))
    .where(and(addressedTo(spaceId, userId), isNull(notificationReads.notificationId)));
  const rows = await db
    .insert(notificationReads)
    .select(unseen)
    .onConflictDoNothing()
    .returning({ id: notificationReads.notificationId });
  return rows.length;
}

/** "Marcar todas como lidas", só para esta pessoa. */
export async function markAllRead(db: Executor, spaceId: string, userId: string, now = new Date()): Promise<number> {
  const unread = db
    .select({
      notificationId: notifications.id,
      userId: sql<string>`${userId}::text`.as("user_id"),
      seenAt: sql<Date>`coalesce(${notificationReads.seenAt}, ${at(now)})`.as("seen_at"),
      readAt: sql<Date>`${at(now)}`.as("read_at"),
    })
    .from(notifications)
    .leftJoin(notificationReads, readsOf(userId))
    .where(and(addressedTo(spaceId, userId), isNull(notificationReads.readAt)));
  const rows = await db
    .insert(notificationReads)
    .select(unread)
    .onConflictDoUpdate({
      target: [notificationReads.notificationId, notificationReads.userId],
      set: { readAt: at(now) },
    })
    .returning({ id: notificationReads.notificationId });
  return rows.length;
}

/** Abrir um aviso marca como lido (para esta pessoa); devolve o caminho para onde ele leva (ou `null` se não existe mais). */
export async function markRead(
  db: Executor,
  spaceId: string,
  userId: string,
  id: string,
  now = new Date(),
): Promise<{ href: string | null } | null> {
  const [row] = await db
    .select({ id: notifications.id, href: notifications.href })
    .from(notifications)
    .where(and(addressedTo(spaceId, userId), eq(notifications.id, id)));
  if (!row) return null;
  await db
    .insert(notificationReads)
    .values({ notificationId: row.id, userId, seenAt: now, readAt: now })
    .onConflictDoUpdate({
      target: [notificationReads.notificationId, notificationReads.userId],
      set: { readAt: sql`coalesce(${notificationReads.readAt}, excluded.read_at)` },
    });
  return { href: row.href };
}
