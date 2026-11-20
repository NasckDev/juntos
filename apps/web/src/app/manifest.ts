import type { MetadataRoute } from "next";

/** Cor de destaque padrão (índigo, `--brand` claro de `globals.css`) e fundo do tema claro. */
const BRAND_COLOR = "#5048e5";
const BACKGROUND_COLOR = "#f6f7f9";

/**
 * Manifesto do app instalável (PWA). Instalado na Tela de Início, o iPhone/iPad passa a aceitar notificações
 * push (o Safari só oferece Web Push para sites adicionados à Tela de Início).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/inicio",
    name: "Juntos",
    short_name: "Juntos",
    description:
      "Finanças da casa, sozinho ou a dois: contas fixas que se lançam sozinhas, divisão justa, orçamento e metas.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BACKGROUND_COLOR,
    theme_color: BRAND_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
