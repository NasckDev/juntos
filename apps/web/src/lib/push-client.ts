import type { SavePushSubscriptionInput } from "@/server/validators/push";

/** Caminho do service worker (`public/sw.js`). */
export const SERVICE_WORKER_URL = "/sw.js";

/** O navegador tem service worker, Push API e Notification? */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  );
}

/** Chave pública VAPID (base64url) no formato que `pushManager.subscribe` pede. */
export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Inscrição no formato que a Server Action aceita; `null` se o navegador devolveu uma inscrição incompleta. */
export function toSubscriptionInput(subscription: PushSubscription): SavePushSubscriptionInput | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, expirationTime: json.expirationTime ?? null, keys: { p256dh, auth } };
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  return navigator.serviceWorker.ready;
}

export interface DevicePushState {
  readonly permission: NotificationPermission;
  readonly subscription: PushSubscription | null;
}

/** Permissão atual e a inscrição deste aparelho (se já existir). Não pede nada à pessoa. */
export async function readDevicePushState(): Promise<DevicePushState> {
  const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
  const subscription = (await existing?.pushManager.getSubscription()) ?? null;
  return { permission: Notification.permission, subscription };
}

export type SubscribeOutcome =
  | { readonly status: "subscribed"; readonly subscription: PushSubscription }
  | { readonly status: "denied" }
  | { readonly status: "dismissed" }
  | { readonly status: "error" };

/** Pede permissão (chame num clique), registra o service worker e cria a inscrição. */
export async function subscribeThisDevice(vapidPublicKey: string): Promise<SubscribeOutcome> {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return { status: "denied" };
  if (permission !== "granted") return { status: "dismissed" };
  try {
    const reg = await registration();
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    return { status: "subscribed", subscription };
  } catch {
    return { status: "error" };
  }
}

/** Cancela a inscrição deste aparelho e devolve o endpoint que existia (para o servidor apagar). */
export async function unsubscribeThisDevice(): Promise<string | null> {
  const { subscription } = await readDevicePushState();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
