import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta do app, no celular (390 px) e no computador (1440 px), com axe.
 *
 * O servidor (`scripts/e2e-server.ts`) sobe um `next dev` próprio na porta 3012, com banco PGlite num diretório
 * temporário só dos testes (apagado a cada execução) e saída em `.next-e2e`, para rodar ao lado do servidor de
 * desenvolvimento sem disputar o banco nem a pasta do Next. Para rodar duas execuções ao mesmo tempo, mude
 * `E2E_PORT`, `E2E_PGLITE_DIR` e `E2E_NEXT_DIST_DIR`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3012);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npx tsx scripts/e2e-server.ts",
    cwd: import.meta.dirname,
    url: `${baseURL}/entrar`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      PORT: String(PORT),
      DATABASE_URL: "",
      PGLITE_DIR: process.env.E2E_PGLITE_DIR ?? path.join(tmpdir(), "juntos-e2e-pglite"),
      NEXT_DIST_DIR: process.env.E2E_NEXT_DIST_DIR ?? ".next-e2e",
      BETTER_AUTH_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
