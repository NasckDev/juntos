import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { type PushSubscription, sendNotification, WebPushError } from "web-push";
import { safeReturnPath } from "../lib/return-path";
import type { Executor } from "./db";
import { pushSubscriptions } from "./db/schema";
import { env, isPushEnabled } from "./env";
import { isAllowedPushEndpoint, pushHostOf } from "./push-endpoints";

/** Conteúdo que o service worker (`public/sw.js`) mostra. */
export interface PushPayload {
  readonly title: string;
  readonly body: string;
  /** Caminho aberto ao tocar na notificação (sempre do próprio app). */
  readonly href?: string;
  /** Notificações com a mesma tag se substituem no aparelho. */
  readonly tag?: string;
}

export type PushResult =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly sent: number; readonly removed: number; readonly failed: number };

const PUSH_TTL_SECONDS = 24 * 60 * 60;
/** Tempo máximo sem resposta do serviço de push (opção `timeout` do web-push, em ms, no socket). */
export const PUSH_TIMEOUT_MS = 10_000;
/** Aparelhos por pessoa; ao passar disso, a inscrição mais antiga sai (ADR 0006). */
export const MAX_PUSH_SUBSCRIPTIONS = 10;
const GONE_STATUSES = new Set([404, 410]);
const FALLBACK_HREF = "/inicio";

/** Status e host, nunca o corpo da resposta (texto do serviço de push, que poderia forjar linhas no log). */
function logPushFailure(endpoint: string, error: unknown): void {
  const status = error instanceof WebPushError ? error.statusCode : null;
  const kind = error instanceof Error ? error.name : "desconhecido";
  console.error("Falha ao enviar notificação push:", { host: pushHostOf(endpoint), status, kind });
}

/**
 * Envia a notificação para todos os aparelhos inscritos da pessoa.
 * Inscrições que o serviço de push diz que não existem mais (410/404) são apagadas.
 */
export async function sendPush(db: Executor, userId: string, payload: PushPayload): Promise<PushResult> {
  if (!isPushEnabled() || !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { enabled: false };
  }
  const vapidDetails = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  const body = JSON.stringify({ ...payload, href: safeHref(payload.href) });

  const outcomes = await Promise.all(
    rows.map(async (row) => {
      // Inscrição antiga com endereço fora da lista (gravada antes da conferência) não recebe POST: sai.
      if (!isAllowedPushEndpoint(row.endpoint)) return { id: row.id, status: "gone" as const };
      const subscription: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await sendNotification(subscription, body, { vapidDetails, TTL: PUSH_TTL_SECONDS, timeout: PUSH_TIMEOUT_MS });
        return { id: row.id, status: "sent" as const };
      } catch (error: unknown) {
        if (error instanceof WebPushError && GONE_STATUSES.has(error.statusCode)) {
          return { id: row.id, status: "gone" as const };
        }
        logPushFailure(row.endpoint, error);
        return { id: row.id, status: "failed" as const };
      }
    }),
  );

  const sentIds = outcomes.filter((outcome) => outcome.status === "sent").map((outcome) => outcome.id);
  const goneIds = outcomes.filter((outcome) => outcome.status === "gone").map((outcome) => outcome.id);
  if (goneIds.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, goneIds));
  if (sentIds.length > 0) {
    await db.update(pushSubscriptions).set({ lastSuccessAt: new Date() }).where(inArray(pushSubscriptions.id, sentIds));
  }
  return {
    enabled: true,
    sent: sentIds.length,
    removed: goneIds.length,
    failed: outcomes.length - sentIds.length - goneIds.length,
  };
}

/**
 * Só caminhos internos ("/..."), com as mesmas regras do retorno do login (`safeReturnPath`): recusa `//`, `\`,
 * caracteres de controle e esquemas. Qualquer outra coisa vira a página inicial.
 */
export function safeHref(href: string | undefined): string {
  return safeReturnPath(href, FALLBACK_HREF);
}

export interface SubscriptionInput {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/**
 * Grava (ou move para esta pessoa) a inscrição do aparelho. Gravar de novo conta como a mais recente; passando de
 * `MAX_PUSH_SUBSCRIPTIONS`, as mais antigas da pessoa saem.
 */
export async function saveSubscription(
  db: Executor,
  userId: string,
  input: SubscriptionInput,
  userAgent: string | null,
  now: Date = new Date(),
): Promise<void> {
  const values = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent, createdAt: now };
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: input.endpoint, ...values })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
  const newest = db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.createdAt), desc(pushSubscriptions.id))
    .limit(MAX_PUSH_SUBSCRIPTIONS);
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), notInArray(pushSubscriptions.id, newest)));
}

export async function removeSubscription(db: Executor, userId: string, endpoint: string): Promise<boolean> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length > 0;
}
