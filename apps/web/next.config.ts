import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança de todas as respostas. A CSP das páginas (com nonce) vem do `src/proxy.ts`;
 * aqui fica a CSP fechada das rotas de API, que nunca são exibidas num iframe nem carregam scripts.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
      "browsing-topics=()",
    ].join(", "),
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // O Next 16 trava dois `next dev` na mesma pasta de saída; os testes ponta a ponta usam a própria
  // (`NEXT_DIST_DIR=.next-e2e`, ver playwright.config.ts) para rodar ao lado do servidor de desenvolvimento.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No servidor dos testes, o selo de desenvolvimento do Next ficaria por cima da barra inferior nos prints.
  ...(process.env.NEXT_DIST_DIR ? { devIndicators: false as const } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  // PGlite (desenvolvimento e testes) carrega arquivos WebAssembly do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ["@electric-sql/pglite"],
  transpilePackages: ["@juntos/core"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        // O service worker nunca pode ficar preso em cache, senão uma correção demora a chegar.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
