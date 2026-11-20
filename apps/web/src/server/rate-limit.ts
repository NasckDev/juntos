import { lt, sql } from "drizzle-orm";
import { sha256Hex } from "./crypto";
import type { Executor } from "./db";
import { rateLimits } from "./db/schema";
import { DomainError } from "./result";

/*
 * Limite de tentativas nas rotas e ações sensíveis (ADR 0006), guardado no banco para valer entre instâncias da
 * Vercel. Janela fixa: a primeira tentativa abre a janela; quando ela passa, a contagem recomeça. O upsert é uma
 * instrução só (`insert … on conflict do update … returning`), então duas requisições ao mesmo tempo nunca leem a
 * mesma contagem.
 */

export const RATE_LIMIT_MESSAGE = "Muitas tentativas. Tente de novo em alguns minutos.";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface RateRule {
  /** Prefixo estável da chave no banco. */
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
}

/** Regras por pessoa (`user.id`). */
export const RATE_RULES = {
  importUpload: { name: "importar", limit: 10, windowMs: HOUR_MS },
  importConfirm: { name: "importar-confirmar", limit: 20, windowMs: HOUR_MS },
  exportDownload: { name: "exportar", limit: 30, windowMs: HOUR_MS },
  inviteCreate: { name: "convite", limit: 20, windowMs: DAY_MS },
  inviteRecipient: { name: "convite-destinatario", limit: 5, windowMs: DAY_MS },
  spaceCreate: { name: "espaco", limit: 10, windowMs: DAY_MS },
  pushSubscribe: { name: "push-inscricao", limit: 20, windowMs: DAY_MS },
  pushTest: { name: "push-teste", limit: 5, windowMs: HOUR_MS },
} as const satisfies Record<string, RateRule>;

/** Estourou o limite. Vira 429 nos Route Handlers e `{ ok: false }` com a mensagem amigável nas ações. */
export class RateLimitError extends DomainError {
  constructor() {
    super(RATE_LIMIT_MESSAGE);
  }
}

/** Chave do contador. Partes com dado pessoal (ex.: e-mail convidado) entram só como hash. */
export function rateKey(rule: RateRule, ...parts: readonly string[]): string {
  return [rule.name, ...parts].join(":");
}

/** Hash curto para usar dado pessoal numa chave sem guardar o dado. */
export function hashedPart(value: string): string {
  return sha256Hex(value.trim().toLowerCase()).slice(0, 32);
}

/** Conta uma tentativa e devolve quantas já houve na janela atual (incluindo esta). */
export async function hitRateLimit(db: Executor, rule: RateRule, key: string, now = new Date()): Promise<number> {
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - rule.windowMs).toISOString();
  const expired = sql`${rateLimits.windowStart} <= ${cutoffIso}::timestamptz`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then ${nowIso}::timestamptz else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  if (!row) throw new Error("Falha ao registrar a tentativa.");
  return row.count;
}

/** Conta a tentativa e lança `RateLimitError` se passou do limite da regra. */
export async function enforceRateLimit(
  db: Executor,
  rule: RateRule,
  key: string,
  now: Date = new Date(),
): Promise<void> {
  const count = await hitRateLimit(db, rule, key, now);
  if (count > rule.limit) throw new RateLimitError();
}

/** Atalho para a regra por pessoa. */
export function enforceUserRateLimit(db: Executor, rule: RateRule, userId: string, now?: Date): Promise<void> {
  return enforceRateLimit(db, rule, rateKey(rule, userId), now);
}

/** Rotina diária: contadores com janela aberta há mais de 2 dias já não valem nada (a maior janela é 1 dia). */
export async function purgeStaleRateLimits(db: Executor, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * DAY_MS);
  const rows = await db.delete(rateLimits).where(lt(rateLimits.windowStart, cutoff)).returning({ key: rateLimits.key });
  return rows.length;
}
