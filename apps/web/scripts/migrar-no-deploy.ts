/**
 * Migrações no deploy da Vercel (`vercel.json` → `buildCommand`), antes do `next build`.
 *
 * - Com `DATABASE_URL` (Neon): aplica as migrações pendentes e semeia as categorias padrão. Se falhar, o deploy para
 *   antes de publicar um código que espera um banco que ainda não existe.
 * - Sem `DATABASE_URL` em produção (`VERCEL_ENV=production`): para o deploy com a explicação (o app não sobe sem banco).
 * - Sem `DATABASE_URL` fora da produção (preview sem banco, build local): pula as migrações e avisa. O build continua,
 *   porque o `next build` não abre banco.
 *
 * O módulo de migração só é carregado depois dessas conferências: ele lê o env do servidor, que em produção exige os
 * segredos de execução.
 */

export {};

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const vercelEnv = process.env.VERCEL_ENV ?? "local";

if (!hasDatabase) {
  if (vercelEnv === "production") {
    console.error(
      "DATABASE_URL não está definida na produção. Crie o banco Neon na aba Storage do projeto na Vercel " +
        "(ele cria a variável) e faça o deploy de novo. Passo a passo: docs/07-publicacao.md.",
    );
    process.exit(1);
  }
  process.stdout.write(`Sem DATABASE_URL (${vercelEnv}): migrações puladas.\n`);
} else {
  const { runMigrations } = await import("../src/server/db/migrate");
  const { closeDb } = await import("../src/server/db");
  try {
    await runMigrations();
    process.stdout.write(`Migrações aplicadas no banco do ambiente ${vercelEnv}.\n`);
  } catch (error: unknown) {
    console.error("Falha ao aplicar as migrações:", error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
