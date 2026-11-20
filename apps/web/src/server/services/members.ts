import type { Role } from "@juntos/core";
import { and, asc, eq, gt, isNull, lte, ne, sql } from "drizzle-orm";
import { randomToken, sha256Hex } from "../crypto";
import type { Database, Executor } from "../db";
import { invites, notifications, spaceMembers, spaces, user } from "../db/schema";
import { appUrl } from "../env";
import { assertMember } from "../membership";
import { DomainError } from "../result";
import { MESSAGES } from "../validators/common";

/** Prazo do convite (especificação 5.6). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const INVITE_MESSAGES = {
  invalid: "Este convite não existe ou já foi usado.",
  used: "Este convite já foi usado.",
  expired: "Este convite venceu. Peça um novo para quem convidou você.",
  alreadyIn: "Você já participa deste espaço.",
  ownerRole: "O dono do espaço não muda de permissão.",
  ownerRemoval: "O dono não pode ser removido do espaço.",
  memberNotFound: "Essa pessoa não está neste espaço.",
  tooManyPending: "Este espaço já tem 20 convites pendentes. Cancele algum antes de convidar outra pessoa.",
} as const;

/** Convites pendentes por espaço (ADR 0006): o bastante para a casa, pouco para virar disparador. */
export const MAX_PENDING_INVITES = 20;

export type MemberStatus = "invited" | "active";

export interface MemberView {
  readonly id: string;
  readonly userId: string | null;
  /** Nome da pessoa; no convite pendente, o e-mail convidado. */
  readonly name: string;
  readonly email: string | null;
  readonly avatar: string | null;
  readonly image: string | null;
  readonly role: Role;
  readonly status: MemberStatus;
  readonly isYou: boolean;
  /** Só no convite pendente. */
  readonly inviteExpiresAt: Date | null;
}

/** Pessoas do espaço (ativas e convites pendentes). Qualquer membro pode ver. */
export async function listMembers(db: Executor, actorId: string, spaceId: string): Promise<MemberView[]> {
  await assertMember(db, actorId, spaceId, "viewer");
  const rows = await db
    .select({
      id: spaceMembers.id,
      userId: spaceMembers.userId,
      invitedEmail: spaceMembers.invitedEmail,
      role: spaceMembers.role,
      status: spaceMembers.status,
      userName: user.name,
      userEmail: user.email,
      isAnonymous: user.isAnonymous,
      avatar: user.avatar,
      image: user.image,
      inviteExpiresAt: sql<Date | null>`(
        select max(${invites.expiresAt}) from ${invites}
        where ${invites.memberId} = ${spaceMembers.id} and ${invites.acceptedAt} is null
      )`.mapWith((value: string | Date | null) => (value === null ? null : new Date(value))),
    })
    .from(spaceMembers)
    .leftJoin(user, eq(user.id, spaceMembers.userId))
    .where(and(eq(spaceMembers.spaceId, spaceId), ne(spaceMembers.status, "removed")))
    .orderBy(sql`case ${spaceMembers.role} when 'owner' then 0 else 1 end`, asc(spaceMembers.createdAt));
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.userName ?? row.invitedEmail ?? "",
    email: row.isAnonymous ? null : (row.userEmail ?? row.invitedEmail),
    avatar: row.avatar,
    image: row.image,
    role: row.role,
    status: row.status === "invited" ? "invited" : "active",
    isYou: row.userId === actorId,
    inviteExpiresAt: row.status === "invited" ? row.inviteExpiresAt : null,
  }));
}

export interface CreatedInvite {
  readonly memberId: string;
  readonly email: string;
  readonly role: Role;
  /** Link com o token; é a única vez que o token existe fora do navegador de quem convida. */
  readonly inviteUrl: string;
  readonly expiresAt: Date;
  readonly spaceName: string;
}

export interface InviteActor {
  readonly id: string;
  readonly email: string | null;
}

/**
 * Convida por e-mail (só o dono). O token tem 32 bytes aleatórios e só o SHA-256 vai para o banco.
 * Um convite vencido para o mesmo e-mail é renovado (novo token, novo prazo); um vigente é recusado.
 * No máximo `MAX_PENDING_INVITES` convites pendentes por espaço.
 */
export async function createInvite(
  db: Database,
  actor: InviteActor,
  input: { readonly spaceId: string; readonly email: string; readonly role: "editor" | "viewer" },
  now = new Date(),
): Promise<CreatedInvite> {
  const membership = await assertMember(db, actor.id, input.spaceId, "owner");
  const email = input.email.trim().toLowerCase();
  if (actor.email && actor.email.toLowerCase() === email) throw new DomainError(MESSAGES.ownEmail, "email");

  return db.transaction(async (tx) => {
    const [activeWithEmail] = await tx
      .select({ id: spaceMembers.id })
      .from(spaceMembers)
      .innerJoin(user, eq(user.id, spaceMembers.userId))
      .where(
        and(
          eq(spaceMembers.spaceId, input.spaceId),
          eq(spaceMembers.status, "active"),
          eq(user.isAnonymous, false),
          sql`lower(${user.email}) = ${email}`,
        ),
      )
      .limit(1);
    if (activeWithEmail) throw new DomainError(MESSAGES.alreadyMember, "email");

    const [existing] = await tx
      .select()
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, input.spaceId), eq(spaceMembers.invitedEmail, email)))
      .limit(1);

    if (existing?.status === "active") throw new DomainError(MESSAGES.alreadyMember, "email");
    if (existing?.status === "invited") {
      const [live] = await tx
        .select({ id: invites.id })
        .from(invites)
        .where(and(eq(invites.memberId, existing.id), isNull(invites.acceptedAt), gt(invites.expiresAt, now)))
        .limit(1);
      if (live) throw new DomainError(MESSAGES.alreadyMember, "email");
    }
    if (existing?.status === "removed") {
      // Quem foi removida guarda a linha antiga (histórico); o novo convite usa uma linha nova.
      await tx.update(spaceMembers).set({ invitedEmail: null }).where(eq(spaceMembers.id, existing.id));
    }

    let memberId: string;
    if (existing?.status === "invited") {
      // Convite vencido para o mesmo e-mail: renova na mesma linha.
      await tx.delete(invites).where(and(eq(invites.memberId, existing.id), isNull(invites.acceptedAt)));
      await tx.update(spaceMembers).set({ role: input.role }).where(eq(spaceMembers.id, existing.id));
      memberId = existing.id;
    } else {
      // Trava o espaço para dois convites ao mesmo tempo não passarem juntos do limite.
      await tx.execute(sql`select 1 from ${spaces} where ${spaces.id} = ${input.spaceId} for update`);
      const [pending] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, input.spaceId), eq(spaceMembers.status, "invited")));
      if ((pending?.count ?? 0) >= MAX_PENDING_INVITES) throw new DomainError(INVITE_MESSAGES.tooManyPending, "email");
      const [created] = await tx
        .insert(spaceMembers)
        .values({ spaceId: input.spaceId, invitedEmail: email, role: input.role, status: "invited" })
        .returning({ id: spaceMembers.id });
      if (!created) throw new Error("Falha ao criar o convite.");
      memberId = created.id;
    }

    const token = randomToken(32);
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    await tx.insert(invites).values({
      spaceId: input.spaceId,
      memberId,
      tokenHash: sha256Hex(token),
      email,
      role: input.role,
      invitedBy: actor.id,
      expiresAt,
      createdAt: now,
    });
    return {
      memberId,
      email,
      role: input.role,
      inviteUrl: `${appUrl()}/convite/${token}`,
      expiresAt,
      spaceName: membership.spaceName,
    };
  });
}

export type InvitePreview =
  | { readonly status: "invalid" }
  | {
      readonly status: "valid" | "expired" | "used";
      readonly spaceName: string;
      readonly inviterName: string | null;
      readonly role: Role;
      readonly expiresAt: Date;
    };

/** Dados para a página `/convite/[token]` mostrar antes de aceitar (não consome o convite). */
export async function getInvitePreview(db: Executor, token: string, now = new Date()): Promise<InvitePreview> {
  const [row] = await db
    .select({
      spaceName: spaces.name,
      spaceDeletedAt: spaces.deletedAt,
      inviterName: user.name,
      role: invites.role,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
    })
    .from(invites)
    .innerJoin(spaces, eq(spaces.id, invites.spaceId))
    .leftJoin(user, eq(user.id, invites.invitedBy))
    .where(eq(invites.tokenHash, sha256Hex(token)))
    .limit(1);
  if (!row || row.spaceDeletedAt) return { status: "invalid" };
  const status = row.acceptedAt ? "used" : row.expiresAt <= now ? "expired" : "valid";
  return {
    status,
    spaceName: row.spaceName,
    inviterName: row.inviterName,
    role: row.role,
    expiresAt: row.expiresAt,
  };
}

export interface AcceptedInvite {
  readonly spaceId: string;
  readonly spaceName: string;
  readonly role: Role;
}

/** Aceita o convite (uso único, atômico). Quem aceita precisa estar logado (Google ou convidado). */
export async function acceptInvite(
  db: Database,
  acceptor: { readonly id: string; readonly name: string },
  token: string,
  now = new Date(),
): Promise<AcceptedInvite> {
  const tokenHash = sha256Hex(token);
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({
        id: invites.id,
        spaceId: invites.spaceId,
        memberId: invites.memberId,
        expiresAt: invites.expiresAt,
        acceptedAt: invites.acceptedAt,
        invitedBy: invites.invitedBy,
        spaceName: spaces.name,
        spaceDeletedAt: spaces.deletedAt,
        role: spaceMembers.role,
      })
      .from(invites)
      .innerJoin(spaces, eq(spaces.id, invites.spaceId))
      .innerJoin(spaceMembers, eq(spaceMembers.id, invites.memberId))
      .where(eq(invites.tokenHash, tokenHash))
      .limit(1);
    if (!invite || invite.spaceDeletedAt) throw new DomainError(INVITE_MESSAGES.invalid);
    if (invite.acceptedAt) throw new DomainError(INVITE_MESSAGES.used);
    if (invite.expiresAt <= now) throw new DomainError(INVITE_MESSAGES.expired);

    const [own] = await tx
      .select({ id: spaceMembers.id, status: spaceMembers.status })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, invite.spaceId), eq(spaceMembers.userId, acceptor.id)))
      .limit(1);
    if (own?.status === "active") throw new DomainError(INVITE_MESSAGES.alreadyIn);

    // Marca como usado só se ninguém usou antes (duas abas aceitando ao mesmo tempo).
    const [claimed] = await tx
      .update(invites)
      .set({ acceptedAt: now, acceptedBy: acceptor.id })
      .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt)))
      .returning({ id: invites.id });
    if (!claimed) throw new DomainError(INVITE_MESSAGES.used);

    if (own && own.id !== invite.memberId) {
      // A pessoa tinha sido removida antes: volta na linha antiga (mantém o histórico da divisão).
      await tx
        .update(spaceMembers)
        .set({ status: "active", role: invite.role, joinedAt: now })
        .where(eq(spaceMembers.id, own.id));
      await tx
        .delete(spaceMembers)
        .where(and(eq(spaceMembers.id, invite.memberId), eq(spaceMembers.status, "invited")));
    } else {
      await tx
        .update(spaceMembers)
        .set({ userId: acceptor.id, status: "active", joinedAt: now })
        .where(eq(spaceMembers.id, invite.memberId));
    }

    if (invite.invitedBy) {
      await tx
        .insert(notifications)
        .values({
          spaceId: invite.spaceId,
          userId: invite.invitedBy,
          type: "invite",
          dedupeKey: `invite-accepted-${invite.id}`,
          title: `${acceptor.name} aceitou seu convite`,
          body: `Agora vocês lançam e acompanham as contas de ${invite.spaceName} juntos.`,
          href: "/ajustes/pessoas",
        })
        .onConflictDoNothing();
    }
    return { spaceId: invite.spaceId, spaceName: invite.spaceName, role: invite.role };
  });
}

/** Troca entre "Pode editar" e "Só vê" (só o dono). Vale também para convite pendente. */
export async function changeMemberRole(
  db: Database,
  actorId: string,
  input: { readonly spaceId: string; readonly memberId: string; readonly role: "editor" | "viewer" },
): Promise<void> {
  await assertMember(db, actorId, input.spaceId, "owner");
  await db.transaction(async (tx) => {
    const target = await findMember(tx, input.spaceId, input.memberId);
    if (target.role === "owner") throw new DomainError(INVITE_MESSAGES.ownerRole);
    await tx.update(spaceMembers).set({ role: input.role }).where(eq(spaceMembers.id, target.id));
    await tx
      .update(invites)
      .set({ role: input.role })
      .where(and(eq(invites.memberId, target.id), isNull(invites.acceptedAt)));
  });
}

/**
 * Remove a pessoa do espaço (só o dono). Convite pendente some de vez; quem já participava fica
 * como `removed`, sem acesso, para os lançamentos que pagou continuarem com nome na divisão.
 */
export async function removeMember(
  db: Database,
  actorId: string,
  input: { readonly spaceId: string; readonly memberId: string },
): Promise<void> {
  await assertMember(db, actorId, input.spaceId, "owner");
  await db.transaction(async (tx) => {
    const target = await findMember(tx, input.spaceId, input.memberId);
    if (target.role === "owner") throw new DomainError(INVITE_MESSAGES.ownerRemoval);
    if (target.status === "invited") {
      await tx.delete(spaceMembers).where(eq(spaceMembers.id, target.id));
      return;
    }
    await tx.update(spaceMembers).set({ status: "removed" }).where(eq(spaceMembers.id, target.id));
    await tx.delete(invites).where(and(eq(invites.memberId, target.id), isNull(invites.acceptedAt)));
  });
}

async function findMember(tx: Executor, spaceId: string, memberId: string) {
  const [target] = await tx
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.id, memberId), eq(spaceMembers.spaceId, spaceId), ne(spaceMembers.status, "removed")))
    .limit(1);
  if (!target) throw new DomainError(INVITE_MESSAGES.memberNotFound);
  return target;
}

/**
 * Rotina diária: convites vencidos e não aceitos saem, junto com a linha pendente da pessoa.
 */
export async function purgeExpiredInvites(db: Executor, now = new Date()): Promise<number> {
  const expired = await db
    .delete(invites)
    .where(and(isNull(invites.acceptedAt), lte(invites.expiresAt, now)))
    .returning({ memberId: invites.memberId });
  const memberIds = [...new Set(expired.map((row) => row.memberId))];
  for (const memberId of memberIds) {
    await db
      .delete(spaceMembers)
      .where(
        and(
          eq(spaceMembers.id, memberId),
          eq(spaceMembers.status, "invited"),
          sql`not exists (select 1 from ${invites} where ${invites.memberId} = ${memberId})`,
        ),
      );
  }
  return expired.length;
}
