import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./auth";

/** Usuário da sessão atual, no formato que as telas e o servidor usam. */
export interface SessionUser {
  readonly id: string;
  readonly name: string;
  /** Nulo no convidado (o Better Auth guarda um e-mail de marcação que não deve aparecer). */
  readonly email: string | null;
  readonly isAnonymous: boolean;
  readonly avatar: string | null;
  readonly image: string | null;
  readonly deletionRequestedAt: Date | null;
}

/** Lê a sessão do cookie (uma vez por requisição). Retorna `null` sem sessão válida. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  // `headers()` primeiro: no `next build` é ele que marca a rota como dinâmica, antes de o Better Auth ser criado
  // (sem os segredos de execução, que o build não tem).
  const requestHeaders = await headers();
  const result = await getAuth().api.getSession({ headers: requestHeaders });
  if (!result) return null;
  const { user } = result;
  const isAnonymous = user.isAnonymous === true;
  return {
    id: user.id,
    name: user.name,
    email: isAnonymous ? null : user.email,
    isAnonymous,
    avatar: user.avatar ?? null,
    image: user.image ?? null,
    deletionRequestedAt: user.deletionRequestedAt ?? null,
  };
});
