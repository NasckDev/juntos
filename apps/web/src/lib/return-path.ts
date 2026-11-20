/** Para onde ir depois de entrar quando nenhum destino válido foi pedido. */
export const DEFAULT_RETURN_PATH = "/inicio";

const PLACEHOLDER_ORIGIN = "http://juntos.invalid";
const MAX_LENGTH = 2048;
// Caracteres de controle e barra invertida: alguns navegadores tratam "\" como "/", e "/\evil.com" vira outro site.
// biome-ignore lint/suspicious/noControlCharactersInRegex: o objetivo é justamente recusar caracteres de controle
const FORBIDDEN_CHARS = /[\u0000-\u001f\u007f\\]/;

/**
 * Destino de retorno (`?voltar=`) só quando é um caminho interno do app. Qualquer outra coisa (URL completa,
 * `//outro.site`, `/\outro.site`, `javascript:`) cai no `fallback`, para ninguém usar a tela de entrada como
 * redirecionador aberto. Também evita voltar para a própria tela de entrada.
 */
export function safeReturnPath(value: unknown, fallback: string = DEFAULT_RETURN_PATH): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || FORBIDDEN_CHARS.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (url.pathname === "/entrar" || url.pathname.startsWith("/entrar/")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `?voltar=` pode vir como lista quando repetido; vale só o primeiro valor. */
export function firstParam(value: string | readonly string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : (value as string | undefined);
}
