import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Proxy (o antigo middleware, renomeado no Next 16):
 * 1. Gera um nonce por requisição e manda a CSP com ele (o Next aplica o nonce nos próprios scripts).
 * 2. Manda para `/entrar` quem abre uma rota do app sem cookie de sessão.
 *
 * O cookie aqui é só um atalho otimista: toda Server Action e Route Handler confere a sessão de verdade
 * no servidor (`requireUser`/`requireMember`).
 */

/** Rotas do grupo autenticado `(app)` (especificação 5.8). */
const APP_ROUTES = [
  "/inicio",
  "/lancamentos",
  "/planejamento",
  "/divisao",
  "/relatorios",
  "/notificacoes",
  "/dados",
  "/ajustes",
] as const;

/** Mesmo prefixo de cookie configurado em `src/server/auth.ts`. */
const COOKIE_PREFIX = "juntos";

/** O portfólio do autor exibe o app num iframe; nenhum outro site pode. */
const FRAME_ANCESTORS = "https://nasck-myportifolio.vercel.app";

export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    `frame-ancestors ${FRAME_ANCESTORS}`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isAppRoute(pathname) && !getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX })) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?${new URLSearchParams({ voltar: `${pathname}${search}` }).toString()}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Páginas; ficam de fora a API, os arquivos estáticos, o service worker e as pré-buscas do <Link>.
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sw.js|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
