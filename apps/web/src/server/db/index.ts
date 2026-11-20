import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { env } from "../env";
import * as schema from "./schema";

/**
 * Fábrica de conexão.
 *
 * - Com `DATABASE_URL`: Neon pelo driver `neon-serverless` (Pool sobre WebSocket). Escolhido no lugar do
 *   `neon-http` porque o HTTP só faz lotes não interativos, e o app precisa de transações de verdade
 *   (vincular convidado ao Google, aceitar convite, desfazer, importar planilha). O Node 22+ já traz
 *   `WebSocket` global, então não é preciso o pacote `ws`.
 * - Sem `DATABASE_URL`: PGlite (Postgres em WebAssembly), em `.data/pglite` no desenvolvimento ou em memória
 *   quando `NODE_ENV=test`.
 *
 * A conexão é criada na primeira chamada (nunca na importação), para o `next build` não abrir banco.
 */

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema>;
export type Transaction = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Aceita a conexão ou uma transação aberta. */
export type Executor = Database | Transaction;

export type DatabaseDriver = "neon" | "pglite-file" | "pglite-memory";

interface Connection {
  readonly db: Database;
  readonly driver: DatabaseDriver;
  readonly close: () => Promise<void>;
}

export const PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");

function connect(): Connection {
  if (env.DATABASE_URL) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    return { db: drizzleNeon({ client: pool, schema }), driver: "neon", close: () => pool.end() };
  }
  if (env.NODE_ENV === "test") {
    const client = new PGlite();
    return { db: drizzlePglite({ client, schema }), driver: "pglite-memory", close: () => client.close() };
  }
  mkdirSync(PGLITE_DIR, { recursive: true });
  const client = new PGlite(PGLITE_DIR);
  return { db: drizzlePglite({ client, schema }), driver: "pglite-file", close: () => client.close() };
}

// Guardado no globalThis para o recarregamento do `next dev` não abrir o mesmo diretório do PGlite duas vezes.
const holder = globalThis as typeof globalThis & { __juntosDb?: Connection | undefined };

function connection(): Connection {
  if (!holder.__juntosDb) holder.__juntosDb = connect();
  return holder.__juntosDb;
}

export function getDb(): Database {
  return connection().db;
}

export function getDatabaseDriver(): DatabaseDriver {
  return connection().driver;
}

/** Fecha a conexão (scripts e testes). */
export async function closeDb(): Promise<void> {
  const current = holder.__juntosDb;
  if (!current) return;
  holder.__juntosDb = undefined;
  await current.close();
}

export { schema };
