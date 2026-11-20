/**
 * Servidor dos testes ponta a ponta (`playwright.config.ts`).
 *
 * 1. Apaga e recria o banco PGlite no diretório próprio dos testes (`PGLITE_DIR`): o PGlite em arquivo não aceita
 *    dois processos, então os testes nunca usam o `.data/pglite` do desenvolvimento.
 * 2. Aplica as migrações e as categorias padrão.
 * 3. Sobe o `next dev` na porta pedida (`PORT`), com a saída em `NEXT_DIST_DIR` (o Next 16 trava dois `next dev`
 *    na mesma pasta de saída).
 */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { createRequire } from "node:module";

const dir = process.env.PGLITE_DIR;
const port = process.env.PORT ?? "3012";
if (!dir) throw new Error("Defina PGLITE_DIR com o diretório do banco dos testes ponta a ponta.");
if (process.env.DATABASE_URL) throw new Error("Os testes ponta a ponta usam PGlite: deixe DATABASE_URL vazio.");

rmSync(dir, { recursive: true, force: true });
const { runMigrations } = await import("../src/server/db/migrate");
const { closeDb } = await import("../src/server/db");
await runMigrations();
await closeDb();
process.stdout.write(`Banco dos testes pronto em ${dir}.\n`);

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "--port", port], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
