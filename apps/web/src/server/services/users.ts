import { and, asc, eq, gt, lte, ne, notExists, sql } from "drizzle-orm";
import type { Database, Executor } from "../db";
import {
  auditLog,
  goals,
  importBatches,
  invites,
  notificationReads,
  notifications,
  pushSubscriptions,
  recurrences,
  session,
  settlements,
  spaceMembers,
  spaces,
  transactions,
  undoTokens,
  user,
  userPreferences,
} from "../db/schema";
import { DEFAULT_SPACE_NAME, insertOwnedSpace, isPristineSpace, listUserSpaces } from "./spaces";

/**
 * Garante o que todo usuário precisa: preferências padrão e pelo menos um espaço.
 * Usado quando a conta é criada (Google ou convidado) e, por segurança, ao abrir o app
 * (ex.: a pessoa ficou sem espaço porque o dono excluiu o único espaço compartilhado).
 */
export async function ensureUserSetup(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(userPreferences).values({ userId }).onConflictDoNothing();
    // Trava a linha do usuário para duas requisições simultâneas não criarem dois "Casa".
    await tx.execute(sql`select 1 from ${user} where ${user.id} = ${userId} for update`);
    const owned = await listUserSpaces(tx, userId);
    if (owned.length === 0) await insertOwnedSpace(tx, userId, DEFAULT_SPACE_NAME);
  });
}

/**
 * Convidado entrou com Google: tudo o que era do convidado passa para a conta Google, numa transação.
 * Depois disso o Better Auth apaga o usuário convidado.
 *
 * - Participações nos espaços mudam de dono (se a conta já participa do mesmo espaço, fica o maior papel).
 * - Nome repetido entre os espaços (ex.: os dois "Casa"): o espaço vazio sai; se os dois têm dados,
 *   o que veio do convidado ganha um sufixo ("Casa (2)").
 * - Autoria de lançamentos, avisos e inscrições de push passam para a conta.
 * - Preferências do convidado vão para a conta se a conta nunca mudou as dela.
 */
export async function linkGuestToAccount(db: Database, guestId: string, accountId: string): Promise<void> {
  if (guestId === accountId) return;
  await db.transaction(async (tx) => {
    const guestMemberships = await tx
      .select()
      .from(spaceMembers)
      .where(and(eq(spaceMembers.userId, guestId), ne(spaceMembers.status, "invited")));
    const transferred: string[] = [];
    for (const membership of guestMemberships) {
      const [existing] = await tx
        .select()
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, membership.spaceId), eq(spaceMembers.userId, accountId)));
      if (existing) {
        await mergeDuplicateMembership(tx, membership, existing);
        continue;
      }
      await tx.update(spaceMembers).set({ userId: accountId }).where(eq(spaceMembers.id, membership.id));
      if (membership.status === "active") transferred.push(membership.spaceId);
    }

    await transferAuthorship(tx, guestId, accountId);

    await resolveNameClashes(tx, accountId, transferred);
    await carryPreferences(tx, guestId, accountId);
  });
}

type MemberRow = typeof spaceMembers.$inferSelect;

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 } as const;

/** A conta e o convidado estão no mesmo espaço: fica uma linha só, com o maior papel. */
async function mergeDuplicateMembership(tx: Executor, guest: MemberRow, account: MemberRow): Promise<void> {
  const role = ROLE_RANK[guest.role] > ROLE_RANK[account.role] ? guest.role : account.role;
  const status = guest.status === "active" || account.status === "active" ? "active" : account.status;
  await tx.update(transactions).set({ paidBy: account.id }).where(eq(transactions.paidBy, guest.id));
  await tx.update(recurrences).set({ paidBy: account.id }).where(eq(recurrences.paidBy, guest.id));
  await tx.update(settlements).set({ fromMember: account.id }).where(eq(settlements.fromMember, guest.id));
  await tx.update(settlements).set({ toMember: account.id }).where(eq(settlements.toMember, guest.id));
  await tx.delete(spaceMembers).where(eq(spaceMembers.id, guest.id));
  await tx
    .update(spaceMembers)
    .set({ role, status, joinedAt: account.joinedAt ?? guest.joinedAt })
    .where(eq(spaceMembers.id, account.id));
}

async function resolveNameClashes(
  tx: Executor,
  accountId: string,
  transferredSpaceIds: readonly string[],
): Promise<void> {
  if (transferredSpaceIds.length === 0) return;
  const transferred = new Set(transferredSpaceIds);
  const all = await listUserSpaces(tx, accountId);
  const own = all.filter((space) => !transferred.has(space.id));
  for (const incoming of all.filter((space) => transferred.has(space.id))) {
    const clash = own.find((space) => space.name.trim().toLowerCase() === incoming.name.trim().toLowerCase());
    if (!clash) continue;
    if (clash.role === "owner" && (await isPristineSpace(tx, clash.id))) {
      await tx.delete(spaces).where(eq(spaces.id, clash.id));
      continue;
    }
    if (incoming.role === "owner" && (await isPristineSpace(tx, incoming.id))) {
      await tx.delete(spaces).where(eq(spaces.id, incoming.id));
      continue;
    }
    if (incoming.role !== "owner") continue; // Só o dono renomeia; nomes iguais em espaços alheios são aceitáveis.
    const taken = new Set(all.map((space) => space.name.trim().toLowerCase()));
    await tx
      .update(spaces)
      .set({ name: uniqueName(incoming.name, taken) })
      .where(eq(spaces.id, incoming.id));
  }
}

function uniqueName(name: string, taken: ReadonlySet<string>): string {
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${name.trim().slice(0, 30 - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name;
}

async function carryPreferences(tx: Executor, guestId: string, accountId: string): Promise<void> {
  const [guest] = await tx.select().from(userPreferences).where(eq(userPreferences.userId, guestId));
  if (!guest?.updatedAt) return;
  const [account] = await tx.select().from(userPreferences).where(eq(userPreferences.userId, accountId));
  if (account?.updatedAt) return;
  const values = {
    theme: guest.theme,
    accent: guest.accent,
    fontSize: guest.fontSize,
    hideValues: guest.hideValues,
    notify: guest.notify,
    updatedAt: guest.updatedAt,
  };
  await tx
    .insert(userPreferences)
    .values({ userId: accountId, ...values })
    .onConflictDoUpdate({ target: userPreferences.userId, set: values });
}

/**
 * Apaga a conta de vez (fim da carência de 30 dias, ou convidado parado há 30 dias).
 * - Espaço em que a pessoa é a única participante ativa: apagado com tudo dentro.
 * - Espaço compartilhado de que ela é dona: a posse passa para quem participa há mais tempo (editor primeiro).
 * - Sessões, contas de login, preferências, avisos e inscrições de push saem em cascata com o usuário.
 */
export async function purgeUser(db: Database, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const memberships = await tx
      .select({ spaceId: spaceMembers.spaceId, role: spaceMembers.role })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.userId, userId), eq(spaceMembers.status, "active")));
    for (const membership of memberships) {
      const others = await tx
        .select({ id: spaceMembers.id, role: spaceMembers.role })
        .from(spaceMembers)
        .where(
          and(
            eq(spaceMembers.spaceId, membership.spaceId),
            eq(spaceMembers.status, "active"),
            ne(spaceMembers.userId, userId),
          ),
        )
        .orderBy(
          sql`case ${spaceMembers.role} when 'owner' then 0 when 'editor' then 1 else 2 end`,
          asc(spaceMembers.joinedAt),
        );
      if (others.length === 0) {
        await tx.delete(spaces).where(eq(spaces.id, membership.spaceId));
        continue;
      }
      const heir = others[0];
      if (membership.role === "owner" && heir && heir.role !== "owner") {
        await tx.update(spaceMembers).set({ role: "owner" }).where(eq(spaceMembers.id, heir.id));
      }
    }
    await tx.delete(user).where(eq(user.id, userId));
  });
}

/** Autoria (lançamentos, convites, auditoria) e dados pessoais (avisos, push, desfazer) passam para a conta. */
async function transferAuthorship(tx: Executor, from: string, to: string): Promise<void> {
  await tx.update(transactions).set({ createdBy: to }).where(eq(transactions.createdBy, from));
  await tx.update(transactions).set({ updatedBy: to }).where(eq(transactions.updatedBy, from));
  await tx.update(recurrences).set({ createdBy: to }).where(eq(recurrences.createdBy, from));
  await tx.update(recurrences).set({ updatedBy: to }).where(eq(recurrences.updatedBy, from));
  await tx.update(goals).set({ createdBy: to }).where(eq(goals.createdBy, from));
  await tx.update(settlements).set({ createdBy: to }).where(eq(settlements.createdBy, from));
  await tx.update(importBatches).set({ createdBy: to }).where(eq(importBatches.createdBy, from));
  await tx.update(spaces).set({ createdBy: to }).where(eq(spaces.createdBy, from));
  await tx.update(invites).set({ invitedBy: to }).where(eq(invites.invitedBy, from));
  await tx.update(invites).set({ acceptedBy: to }).where(eq(invites.acceptedBy, from));
  await tx.update(auditLog).set({ actorId: to }).where(eq(auditLog.actorId, from));
  await tx.update(notifications).set({ userId: to }).where(eq(notifications.userId, from));
  await transferNoticeReads(tx, from, to);
  await tx.update(pushSubscriptions).set({ userId: to }).where(eq(pushSubscriptions.userId, from));
  await tx.update(undoTokens).set({ userId: to }).where(eq(undoTokens.userId, from));
}

/** Visto e lido do convidado passam para a conta; se a conta já tinha o seu para o mesmo aviso, fica o da conta. */
async function transferNoticeReads(tx: Executor, from: string, to: string): Promise<void> {
  const guestReads = tx
    .select({
      notificationId: notificationReads.notificationId,
      userId: sql<string>`${to}::text`.as("user_id"),
      seenAt: notificationReads.seenAt,
      readAt: notificationReads.readAt,
    })
    .from(notificationReads)
    .where(eq(notificationReads.userId, from));
  await tx.insert(notificationReads).select(guestReads).onConflictDoNothing();
  await tx.delete(notificationReads).where(eq(notificationReads.userId, from));
}

/** Usuários com exclusão pedida até `cutoff` (30 dias atrás). */
export async function usersDueForDeletion(db: Executor, cutoff: Date): Promise<string[]> {
  const rows = await db.select({ id: user.id }).from(user).where(lte(user.deletionRequestedAt, cutoff));
  return rows.map((row) => row.id);
}

/** Convidados criados antes do corte e sem nenhuma sessão usada depois dele (decisão 10). */
export async function idleGuests(db: Executor, cutoff: Date): Promise<string[]> {
  const recentSession = db
    .select({ one: sql`1` })
    .from(session)
    .where(and(eq(session.userId, user.id), gt(session.updatedAt, cutoff)));
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.isAnonymous, true), lte(user.createdAt, cutoff), notExists(recentSession)));
  return rows.map((row) => row.id);
}
