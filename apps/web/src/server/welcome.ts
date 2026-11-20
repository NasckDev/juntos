import { GUEST_NAME } from "./auth";
import type { SessionUser } from "./session";

/** Convidado que ainda tem o nome padrão: é quem vê a folha de boas-vindas ("Como podemos chamar você?"). */
export function needsWelcome(user: Pick<SessionUser, "isAnonymous" | "name">): boolean {
  return user.isAnonymous && user.name === GUEST_NAME;
}
