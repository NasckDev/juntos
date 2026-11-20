import path from "node:path";
import { pathToFileURL } from "node:url";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { closeDb, type Database, getDatabaseDriver, getDb } from "./index";
import { seedDefaultCategories } from "./seed";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Aplica as migrações geradas pelo drizzle-kit (pasta `apps/web/drizzle`) e semeia as categorias padrão.
 * Funciona no Neon e no PGlite. Rode com `npm run db:migrate -w web` (com o `next dev` parado, no PGlite).
 */
export async function runMigrations(db: Database = getDb(), migrationsFolder = MIGRATIONS_FOLDER): Promise<void> {
  const config = { migrationsFolder };
  // Os dois migradores recebem tipos de banco diferentes; a conexão real é a que a fábrica escolheu.
  if (getDatabaseDriver() === "neon") {
    await migrateNeon(db as Parameters<typeof migrateNeon>[0], config);
  } else {
    await migratePglite(db as Parameters<typeof migratePglite>[0], config);
  }
  await seedDefaultCategories(db);
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const driver = getDatabaseDriver();
  runMigrations()
    .then(() => {
      process.stdout.write(`Migrações aplicadas (${driver}).\n`);
      return closeDb();
    })
    .catch(async (error: unknown) => {
      console.error("Falha ao aplicar as migrações:", error);
      await closeDb();
      process.exitCode = 1;
    });
}
