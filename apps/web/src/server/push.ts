import { and, eq, inArray } from "drizzle-orm";
import { type PushSubscription, sendNotification, WebPushError } from "web-push";
import type { Executor } from "./db";
import { pushSubscriptions } from "./db/schema";
import { env, isPushEnabled } from "./env";

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
const GONE_STATUSES = new Set([404, 410]);

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
      const subscription: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await sendNotification(subscription, body, { vapidDetails, TTL: PUSH_TTL_SECONDS });
        return { id: row.id, status: "sent" as const };
      } catch (error: unknown) {
        if (error instanceof WebPushError && GONE_STATUSES.has(error.statusCode)) {
          return { id: row.id, status: "gone" as const };
        }
        console.error("Falha ao enviar notificação push:", error);
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

/** Só caminhos internos ("/..."); qualquer outra coisa vira a página inicial. */
function safeHref(href: string | undefined): string {
  if (href?.startsWith("/") && !href.startsWith("//")) return href;
  return "/inicio";
}

export interface SubscriptionInput {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/** Grava (ou move para esta pessoa) a inscrição do aparelho. */
export async function saveSubscription(
  db: Executor,
  userId: string,
  input: SubscriptionInput,
  userAgent: string | null,
): Promise<void> {
  const values = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent };
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: input.endpoint, ...values })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
}

export async function removeSubscription(db: Executor, userId: string, endpoint: string): Promise<boolean> {
  const rows = await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)))
    .returning({ id: pushSubscriptions.id });
  return rows.length > 0;
}
