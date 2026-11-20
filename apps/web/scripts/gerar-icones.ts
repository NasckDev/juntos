/**
 * Gera os ícones PNG do app (PWA, Tela de Início do iPhone e notificações) a partir de `public/icons/icon.svg`,
 * renderizando no Chromium do Playwright (já instalado para os testes; nenhuma dependência nova).
 * Uso: npm run icones -w web. Rode de novo sempre que mudar o SVG e versione os PNGs.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const ICONS_DIR = path.resolve(import.meta.dirname, "../public/icons");

interface IconTarget {
  readonly file: string;
  readonly size: number;
  readonly svg: (source: string) => string;
}

/** Como está: cantos arredondados e fundo transparente (ícone "any"). */
const asIs = (source: string) => source;
/** Sem cantos arredondados, para o sistema aplicar a própria máscara (maskable e iPhone). */
const fullBleed = (source: string) => source.replace('rx="8"', 'rx="0"');
/** Só os anéis, em branco sobre transparente: o Android usa apenas a transparência no selo da notificação. */
const badge = (source: string) => source.replace(/<rect[^>]*\/>/, "").replace(/ opacity="\.72"/, "");

const TARGETS: readonly IconTarget[] = [
  { file: "icon-192.png", size: 192, svg: asIs },
  { file: "icon-512.png", size: 512, svg: asIs },
  { file: "maskable-192.png", size: 192, svg: fullBleed },
  { file: "maskable-512.png", size: 512, svg: fullBleed },
  { file: "apple-touch-icon.png", size: 180, svg: fullBleed },
  { file: "badge-96.png", size: 96, svg: badge },
];

async function main(): Promise<void> {
  const source = await readFile(path.join(ICONS_DIR, "icon.svg"), "utf8");
  const browser = await chromium.launch();
  try {
    for (const target of TARGETS) {
      const page = await browser.newPage({ viewport: { width: target.size, height: target.size } });
      const svg = target
        .svg(source)
        .replace(/width="\d+"/, `width="${target.size}"`)
        .replace(/height="\d+"/, `height="${target.size}"`);
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, ...sizeOf(target) } });
      await writeFile(path.join(ICONS_DIR, target.file), png);
      await page.close();
      process.stdout.write(`public/icons/${target.file} (${target.size}px)\n`);
    }
  } finally {
    await browser.close();
  }
}

function sizeOf(target: IconTarget): { width: number; height: number } {
  return { width: target.size, height: target.size };
}

main().catch((error: unknown) => {
  console.error("Falha ao gerar os ícones:", error);
  process.exitCode = 1;
});
