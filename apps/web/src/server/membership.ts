import type { Role } from "@juntos/core";
import { and, eq, isNull } from "drizzle-orm";
import { AccessError } from "./access-error";
import type { Executor } from "./db";
import { spaceMembers, spaces } from "./db/schema";

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

/** `owner` > `editor` > `viewer`. */
export function roleAtLeast(role: Role, minRole: Role): boolean {
  return RANK[role] >= RANK[minRole];
}

export interface Membership {
  readonly memberId: string;
  readonly spaceId: string;
  readonly spaceName: string;
  readonly role: Role;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * Confere que `userId` é membro ativo do espaço com pelo menos `minRole`.
 * Espaço inexistente, excluído ou de que a pessoa não participa dão o mesmo erro (`NOT_FOUND`),
 * para não revelar que o espaço existe. Membro com papel insuficiente recebe `FORBIDDEN`.
 *
 * `includeDeleted` só serve ao "Desfazer" da exclusão do espaço.
 */
export async function assertMember(
  db: Executor,
  userId: string,
  spaceId: string,
  minRole: Role,
  options: { readonly includeDeleted?: boolean } = {},
): Promise<Membership> {
  if (!isUuid(spaceId)) throw new AccessError("NOT_FOUND");
  const [row] = await db
    .select({
      memberId: spaceMembers.id,
      spaceId: spaces.id,
      spaceName: spaces.name,
      role: spaceMembers.role,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.status, "active"),
        options.includeDeleted ? undefined : isNull(spaces.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new AccessError("NOT_FOUND");
  if (!roleAtLeast(row.role, minRole)) throw new AccessError("FORBIDDEN");
  return row;
}
