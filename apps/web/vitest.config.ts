import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // Cada arquivo de teste do servidor abre o próprio PGlite (WebAssembly, ~100 MB); poucos em paralelo
    // evitam faltar memória em máquinas mais modestas e no CI.
    maxWorkers: 2,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    projects: [
      {
        extends: true,
        test: {
          name: "servidor",
          environment: "node",
          include: ["src/server/**/*.test.ts", "src/app/**/*.test.ts", "src/*.test.ts"],
          // Nunca usa banco de verdade: sem DATABASE_URL, a fábrica abre um PGlite em memória (NODE_ENV=test).
          env: {
            NODE_ENV: "test",
            DATABASE_URL: "",
            CRON_SECRET: "segredo-de-teste-do-cron-123456",
            BETTER_AUTH_URL: "http://localhost:3010",
          },
        },
      },
      {
        extends: true,
        test: {
          name: "componentes",
          environment: "jsdom",
          include: ["src/components/**/*.test.{ts,tsx}", "src/lib/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/components/test-setup.ts"],
        },
      },
    ],
  },
});
