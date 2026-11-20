/* Service worker do Juntos: recebe as notificações push e abre o app no lugar certo ao tocar. */

const FALLBACK_URL = "/inicio";
const MAX_PATH_LENGTH = 2048;
/** Ícone do app nas notificações (gerado de `public/icons/icon.svg`). */
const NOTIFICATION_ICON = "/icons/icon-192.png";
const NOTIFICATION_BADGE = "/icons/badge-96.png";
// Caracteres de controle e barra invertida: alguns navegadores tratam "\" como "/", e "/\evil.com" vira outro site.
// biome-ignore lint/suspicious/noControlCharactersInRegex: o objetivo é justamente recusar caracteres de controle
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f\\]/;

function readPayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { title: "Juntos", body: event.data.text() };
  }
}

/**
 * Só caminhos do próprio app ("/..."); qualquer outra coisa abre a página inicial. Mesmas regras de
 * `src/lib/return-path.ts` (o service worker não importa módulos do app): recusa "//", "\", caracteres de
 * controle, esquemas ("javascript:") e o que, resolvido, sair da origem.
 */
function safePath(href) {
  if (typeof href !== "string" || href.length === 0 || href.length > MAX_PATH_LENGTH) return FALLBACK_URL;
  if (!href.startsWith("/") || href.startsWith("//") || FORBIDDEN_CHARS.test(href)) return FALLBACK_URL;
  let url;
  try {
    url = new URL(href, self.location.origin);
  } catch {
    return FALLBACK_URL;
  }
  if (url.origin !== self.location.origin) return FALLBACK_URL;
  return `${url.pathname}${url.search}${url.hash}`;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  if (!payload) return;
  const title = typeof payload.title === "string" && payload.title ? payload.title : "Juntos";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    lang: "pt-BR",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    data: { href: safePath(payload.href) },
  };
  if (typeof payload.tag === "string" && payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data?.href), self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
