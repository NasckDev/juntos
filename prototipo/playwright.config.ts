import { defineConfig, devices } from "@playwright/test";

// Testes de fumaça do protótipo, no celular (390 px) primeiro e no computador.
// O servidor local aplica a mesma CSP da Vercel (prototipo/servidor.mjs).
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4791",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "computador", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "node servidor.mjs",
    url: "http://localhost:4791",
    reuseExistingServer: false,
  },
});
