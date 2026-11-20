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
