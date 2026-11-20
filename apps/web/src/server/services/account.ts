import { and, eq, inArray, isNull } from "drizzle-orm";
import type { AvatarKey } from "@/components/ui/avatar-art";
import type { Executor } from "../db";
import {
  budgets,
  categories,
  goalDeposits,
  goals,
  importBatches,
  recurrences,
  settlements,
  spaceMembers,
  spaces,
  transactions,
  user,
} from "../db/schema";
import { getPreferences, type Preferences } from "./preferences";

/** Carência da exclusão de conta (decisão 9). */
export const DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export interface ProfilePatch {
  readonly name?: string | undefined;
  readonly avatar?: AvatarKey | null | undefined;
}

export async function updateProfile(db: Executor, userId: string, patch: ProfilePatch): Promise<void> {
  const values: { name?: string; avatar?: string | null } = {};
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.avatar !== undefined) values.avatar = patch.avatar;
  await db.update(user).set(values).where(eq(user.id, userId));
}

export interface DeletionSchedule {
  readonly requestedAt: Date;
  /** A partir desta data a rotina diária apaga a conta. */
  readonly deleteAfter: Date;
}

export async function requestAccountDeletion(
  db: Executor,
  userId: string,
  now = new Date(),
): Promise<DeletionSchedule> {
  await db.update(user).set({ deletionRequestedAt: now }).where(eq(user.id, userId));
  return { requestedAt: now, deleteAfter: new Date(now.getTime() + DELETION_GRACE_MS) };
}

export async function cancelAccountDeletion(db: Executor, userId: string): Promise<void> {
  await db.update(user).set({ deletionRequestedAt: null }).where(eq(user.id, userId));
}

export interface UserDataExport {
  readonly format: "juntos-export";
  readonly version: 1;
  readonly exportedAt: string;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string | null;
    readonly isGuest: boolean;
    readonly avatar: string | null;
    readonly createdAt: string;
  };
  readonly preferences: Preferences;
  readonly spaces: readonly SpaceExport[];
}

export interface SpaceExport {
  readonly space: typeof spaces.$inferSelect;
  readonly role: string;
  readonly members: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: string;
    readonly status: string;
  }[];
  readonly categories: readonly (typeof categories.$inferSelect)[];
  readonly recurrences: readonly (typeof recurrences.$inferSelect)[];
  readonly transactions: readonly (typeof transactions.$inferSelect)[];
  readonly budgets: readonly (typeof budgets.$inferSelect)[];
  readonly goals: readonly (typeof goals.$inferSelect)[];
  readonly goalDeposits: readonly (typeof goalDeposits.$inferSelect)[];
  readonly settlements: readonly (typeof settlements.$inferSelect)[];
  readonly importBatches: readonly (typeof importBatches.$inferSelect)[];
}

/**
 * "Baixar meus dados" (LGPD): tudo o que a pessoa pode ver, de todos os espaços em que participa.
 * Itens excluídos (na lixeira do "Desfazer") ficam de fora. Valores seguem em centavos.
 */
export async function exportUserData(db: Executor, userId: string, now = new Date()): Promise<UserDataExport> {
  const [profile] = await db.select().from(user).where(eq(user.id, userId));
  if (!profile) throw new Error("Usuário não encontrado para exportar.");
  const memberships = await db
    .select({ space: spaces, role: spaceMembers.role })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(and(eq(spaceMembers.userId, userId), eq(spaceMembers.status, "active"), isNull(spaces.deletedAt)));

  const exported: SpaceExport[] = [];
  for (const { space, role } of memberships) {
    const id = space.id;
    const members = await db
      .select({
        id: spaceMembers.id,
        name: user.name,
        invitedEmail: spaceMembers.invitedEmail,
        role: spaceMembers.role,
        status: spaceMembers.status,
      })
      .from(spaceMembers)
      .leftJoin(user, eq(user.id, spaceMembers.userId))
      .where(eq(spaceMembers.spaceId, id));
    const spaceGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.spaceId, id), isNull(goals.deletedAt)));
    const goalIds = spaceGoals.map((goal) => goal.id);
    exported.push({
      space,
      role,
      members: members.map((member) => ({
        id: member.id,
        name: member.name ?? member.invitedEmail ?? "",
        role: member.role,
        status: member.status,
      })),
      categories: await db.select().from(categories).where(eq(categories.spaceId, id)),
      recurrences: await db
        .select()
        .from(recurrences)
        .where(and(eq(recurrences.spaceId, id), isNull(recurrences.deletedAt))),
      transactions: await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.spaceId, id), isNull(transactions.deletedAt))),
      budgets: await db.select().from(budgets).where(eq(budgets.spaceId, id)),
      goals: spaceGoals,
      goalDeposits:
        goalIds.length > 0 ? await db.select().from(goalDeposits).where(inArray(goalDeposits.goalId, goalIds)) : [],
      settlements: await db
        .select()
        .from(settlements)
        .where(and(eq(settlements.spaceId, id), isNull(settlements.deletedAt))),
      importBatches: await db.select().from(importBatches).where(eq(importBatches.spaceId, id)),
    });
  }

  return {
    format: "juntos-export",
    version: 1,
    exportedAt: now.toISOString(),
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.isAnonymous ? null : profile.email,
      isGuest: profile.isAnonymous,
      avatar: profile.avatar,
      createdAt: profile.createdAt.toISOString(),
    },
    preferences: await getPreferences(db, userId),
    spaces: exported,
  };
}
