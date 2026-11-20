import { defineConfig } from "drizzle-kit";

// Só gera as migrações a partir do schema; quem aplica é `npm run db:migrate` (src/server/db/migrate.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
