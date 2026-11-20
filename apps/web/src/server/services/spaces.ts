import type { Role } from "@juntos/core";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database, Executor } from "../db";
import {
  budgets,
  categories,
  goals,
  importBatches,
  recurrences,
  settlements,
  spaceMembers,
  spaces,
  transactions,
} from "../db/schema";
import { assertMember } from "../membership";
import { DomainError } from "../result";
import { createUndoToken, type UndoTokenInfo } from "../undo";
import { MESSAGES } from "../validators/common";

export const DEFAULT_SPACE_NAME = "Casa";

export interface SpaceSummary {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly role: Role;
  readonly memberId: string;
}

/** Espaços em que a pessoa é membro ativo, na ordem em que entrou. */
export async function listUserSpaces(db: Executor, userId: string): Promise<SpaceSummary[]> {
  return db
    .select({
      id: spaces.id,
      name: spaces.name,
      icon: spaces.icon,
      role: spaceMembers.role,
      memberId: spaceMembers.id,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(and(eq(spaceMembers.userId, userId), eq(spaceMembers.status, "active"), isNull(spaces.deletedAt)))
    .orderBy(asc(spaceMembers.joinedAt), asc(spaces.createdAt));
}

/** Nome repetido entre os espaços da pessoa (sem diferenciar maiúsculas). */
export async function isSpaceNameTaken(
  db: Executor,
  userId: string,
  name: string,
  exceptSpaceId?: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: spaces.id })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.status, "active"),
        isNull(spaces.deletedAt),
        sql`lower(trim(${spaces.name})) = lower(${name.trim()})`,
        exceptSpaceId ? ne(spaces.id, exceptSpaceId) : undefined,
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Cria um espaço vazio com a pessoa como dona. Não confere nome repetido (quem chama confere). */
export async function insertOwnedSpace(db: Executor, userId: string, name: string): Promise<SpaceSummary> {
  const now = new Date();
  const [space] = await db.insert(spaces).values({ name, createdBy: userId }).returning();
  if (!space) throw new Error("Falha ao criar o espaço.");
  const [member] = await db
    .insert(spaceMembers)
    .values({ spaceId: space.id, userId, role: "owner", status: "active", joinedAt: now })
    .returning({ id: spaceMembers.id });
  if (!member) throw new Error("Falha ao criar o membro dono.");
  return { id: space.id, name: space.name, icon: space.icon, role: "owner", memberId: member.id };
}

export async function createSpace(db: Database, userId: string, name: string): Promise<SpaceSummary> {
  return db.transaction(async (tx) => {
    if (await isSpaceNameTaken(tx, userId, name)) throw new DomainError(MESSAGES.spaceNameTaken, "name");
    return insertOwnedSpace(tx, userId, name.trim());
  });
}

export async function renameSpace(db: Database, userId: string, spaceId: string, name: string): Promise<void> {
  await assertMember(db, userId, spaceId, "owner");
  if (await isSpaceNameTaken(db, userId, name, spaceId)) throw new DomainError(MESSAGES.spaceNameTakenOther, "name");
  await db.update(spaces).set({ name: name.trim() }).where(eq(spaces.id, spaceId));
}

export interface DeleteSpaceResult {
  readonly undo: UndoTokenInfo;
  /** Espaço que fica ativo depois de excluir. */
  readonly nextSpaceId: string;
}

/** Exclusão (só dono), com "Desfazer" por 10 minutos. A pessoa precisa ficar com pelo menos um espaço. */
export async function deleteSpace(db: Database, userId: string, spaceId: string): Promise<DeleteSpaceResult> {
  await assertMember(db, userId, spaceId, "owner");
  const remaining = (await listUserSpaces(db, userId)).filter((space) => space.id !== spaceId);
  const next = remaining[0];
  if (!next) throw new DomainError("Você precisa ter pelo menos um espaço. Crie outro antes de excluir este.");
  return db.transaction(async (tx) => {
    await tx.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, spaceId));
    const undo = await createUndoToken(tx, {
      userId,
      spaceId,
      action: { type: "restore", entity: "spaces", ids: [spaceId] },
    });
    return { undo, nextSpaceId: next.id };
  });
}

/** Espaço sem nenhum dado lançado e só com uma pessoa (usado ao juntar convidado e conta Google). */
export async function isPristineSpace(db: Executor, spaceId: string): Promise<boolean> {
  const [row] = await db
    .select({
      used: sql<boolean>`(
        exists (select 1 from ${transactions} where ${transactions.spaceId} = ${spaceId})
        or exists (select 1 from ${recurrences} where ${recurrences.spaceId} = ${spaceId})
        or exists (select 1 from ${goals} where ${goals.spaceId} = ${spaceId})
        or exists (select 1 from ${budgets} where ${budgets.spaceId} = ${spaceId})
        or exists (select 1 from ${settlements} where ${settlements.spaceId} = ${spaceId})
        or exists (select 1 from ${categories} where ${categories.spaceId} = ${spaceId})
        or exists (select 1 from ${importBatches} where ${importBatches.spaceId} = ${spaceId})
        or (select count(*) from ${spaceMembers} where ${spaceMembers.spaceId} = ${spaceId}) > 1
      )`,
    })
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  return row !== undefined && !row.used;
}
