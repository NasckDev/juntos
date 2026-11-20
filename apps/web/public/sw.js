/* Service worker do Juntos: recebe as notificações push e abre o app no lugar certo ao tocar. */

const FALLBACK_URL = "/inicio";

function readPayload(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { title: "Juntos", body: event.data.text() };
  }
}

/** Só caminhos do próprio app ("/..."); qualquer outra coisa abre a página inicial. */
function safePath(href) {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") ? href : FALLBACK_URL;
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
