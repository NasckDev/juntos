/*
 * Endereços aceitos para inscrições de Web Push (ADR 0006). O servidor faz POST no `endpoint` que o navegador
 * mandou; sem lista fechada, qualquer pessoa logada faria o servidor chamar um endereço interno (SSRF cego).
 * Só os serviços de push dos navegadores, por HTTPS na porta padrão.
 */

/** Hosts exatos: Chrome/Edge Android/Opera/Samsung (FCM e o antigo GCM), Firefox e Safari. */
const EXACT_HOSTS: ReadonlySet<string> = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

/** Sufixos: Apple (`*.push.apple.com`) e Windows/Edge (`*.notify.windows.com`, ex.: `wns2-par02p.notify.windows.com`). */
const HOST_SUFFIXES: readonly string[] = [".push.apple.com", ".notify.windows.com"];

/** Rótulo de domínio comum (letras, números e hífen, sem começar nem terminar com hífen). */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function hasValidLabels(host: string): boolean {
  return host.split(".").every((label) => LABEL.test(label));
}

/** Host de push conhecido. IP literal, `localhost` e qualquer outro domínio ficam de fora. */
export function isAllowedPushHost(host: string): boolean {
  if (!hasValidLabels(host)) return false;
  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/** O endpoint pode receber o POST do servidor? HTTPS, porta padrão, sem usuário/senha e host da lista. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return false;
  return isAllowedPushHost(url.hostname);
}

/** Só o host, para log (o caminho do endpoint identifica o aparelho). */
export function pushHostOf(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "endereço inválido";
  }
}
