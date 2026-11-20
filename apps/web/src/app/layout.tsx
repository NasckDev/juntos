import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "Juntos", template: "%s · Juntos" },
  description:
    "Finanças da casa, sozinho ou a dois: contas fixas que se lançam sozinhas, divisão justa, orçamento e metas.",
  applicationName: "Juntos",
  // O manifesto (`app/manifest.ts`) entra sozinho; o iPhone ainda lê o ícone e o título destas tags.
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Juntos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0f" },
  ],
};

/*
 * Aplica as preferências antes da primeira pintura (sem piscar o tema errado).
 * Lê localStorage["juntos:prefs"] = { theme, accent, font, hide } e aceita só valores conhecidos.
 * theme "auto" (ou o antigo "system", ou ausente) segue o aparelho: não escreve data-theme.
 * Quem salva as preferências no servidor (user_preferences) espelha nesse item.
 */
const PREFS_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("juntos:prefs")||"{}"),d=document.documentElement;
var A=["indigo","violeta","azul","petroleo","esmeralda","oliva","laranja","rosa","vinho","cafe","grafite"],F=["menor","normal","grande","maior"];
if(p.theme==="light"||p.theme==="dark")d.setAttribute("data-theme",p.theme);
if(A.indexOf(p.accent)>-1)d.setAttribute("data-accent",p.accent);
if(F.indexOf(p.font)>-1)d.setAttribute("data-font",p.font);
if(p.hide===true)d.setAttribute("data-hide","true");}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script fixo do próprio app (sem dado do usuário), com o nonce da CSP */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
        <Toaster
          position="bottom-center"
          mobileOffset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
          toastOptions={{
            classNames: {
              toast: "!rounded-field !border-0 !bg-ink !text-surface !shadow-pop !font-sans !text-md",
              actionButton: "!bg-transparent !font-bold !text-surface !underline !underline-offset-4",
              description: "!text-surface/80",
            },
          }}
        />
      </body>
    </html>
  );
}
