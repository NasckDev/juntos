import { safeEqual } from "./crypto";

/**
 * Confere `Authorization: Bearer <CRON_SECRET>` em tempo constante.
 * Sem `CRON_SECRET` configurado, nada passa (a rotina fica desligada, nunca aberta).
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;
  return safeEqual(authorization.slice(prefix.length), secret);
}
