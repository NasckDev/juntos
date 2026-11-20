import type { Role } from "@juntos/core";
import { AccessError } from "./access-error";
import { getDb } from "./db";
import { assertMember, type Membership } from "./membership";
import { getSession, type SessionUser } from "./session";

export { AccessError, accessErrorResponse } from "./access-error";
export { assertMember, type Membership, roleAtLeast } from "./membership";
export { getSession, type SessionUser } from "./session";

/** Usuário logado (convidado ou Google); sem sessão, `UNAUTHENTICATED`. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AccessError("UNAUTHENTICATED");
  return user;
}

/** Usuário logado e membro do espaço com pelo menos `minRole`. Toda consulta de domínio passa por aqui. */
export async function requireMember(
  spaceId: string,
  minRole: Role,
): Promise<{ readonly user: SessionUser; readonly membership: Membership }> {
  const user = await requireUser();
  const membership = await assertMember(getDb(), user.id, spaceId, minRole);
  return { user, membership };
}
