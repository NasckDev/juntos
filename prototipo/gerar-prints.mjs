// Gera os prints do README e do portfólio em docs/prints/ (WebP), com os dados fictícios de exemplo.
// Uso: npm run prints  (sobe o servidor local sozinho)
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const PORTA = 4792;
const BASE = `http://localhost:${PORTA}`;

const TELAS = {
  computador: [
    ["entrada", null],
    ["inicio", "geral"],
    ["lancamentos", "lancamentos"],
    ["orcamento", "planejar"],
    ["divisao", "divisao"],
    ["relatorios", "relatorios"],
    ["exportar", "dados"],
  ],
  celular: [
    ["inicio", "geral"],
    ["lancamentos", "lancamentos"],
    ["divisao", "divisao"],
  ],
};

const servidor = spawn(process.execPath, ["prototipo/servidor.mjs"], {
  cwd: raiz,
  env: { ...process.env, PORT: String(PORTA) },
});
await new Promise((ok) => servidor.stdout.once("data", ok));

const navegador = await chromium.launch();
try {
  for (const [aparelho, telas] of Object.entries(TELAS)) {
    const celular = aparelho === "celular";
    const contexto = await navegador.newContext({
      viewport: celular ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: celular ? 2 : 1,
      isMobile: celular,
      hasTouch: celular,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      reducedMotion: "reduce",
    });
    const page = await contexto.newPage();
    await page.goto(BASE);
    for (const [nome, rota] of telas) {
      if (rota) {
        if (!(await page.locator("#view").count())) {
          await page.getByRole("button", { name: "Continuar com Google" }).click();
          await page.getByRole("button", { name: "Começar" }).click();
        }
        await page.goto(`${BASE}/#${rota}`);
      }
      await page.waitForTimeout(400);
      const png = await page.screenshot({ type: "png" });
      // Converte para WebP no próprio Chromium (sem dependência extra).
      const webp = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
        canvas.getContext("2d").drawImage(img, 0, 0);
        return canvas.toDataURL("image/webp", 0.86).split(",")[1];
      }, png.toString("base64"));
      const arquivo = `docs/prints/juntos-${nome}-${aparelho}.webp`;
      await writeFile(new URL(arquivo, `file:///${raiz.replaceAll("\\", "/")}`), Buffer.from(webp, "base64"));
      console.log(`ok ${arquivo}`);
    }
    await contexto.close();
  }
} finally {
  await navegador.close();
  servidor.kill();
}
