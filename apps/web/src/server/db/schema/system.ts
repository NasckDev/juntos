import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { spaces } from "./spaces";

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_space_at_idx").on(t.spaceId, t.at)],
);

/** Entidades com `deleted_at` que o "Desfazer" sabe restaurar. */
export const RESTORABLE_ENTITIES = ["transactions", "recurrences", "goals", "settlements", "spaces"] as const;
export type RestorableEntity = (typeof RESTORABLE_ENTITIES)[number];

/**
 * Categoria personalizada excluída, com o que foi movido para a categoria de reserva, para o "Desfazer" devolver
 * tudo como estava (a categoria volta com o mesmo id, então os vínculos se refazem só trocando o `category_id`).
 */
export interface DeletedCategorySnapshot {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly hue: number;
  readonly kind: "in" | "out" | "save";
  /** Todos os lançamentos (inclusive os excluídos) e contas fixas que estavam na categoria. */
  readonly transactionIds: readonly string[];
  readonly recurrenceIds: readonly string[];
  /** Limite mensal que a categoria tinha, ou `null`. */
  readonly budgetCents: number | null;
}

/** Limite de uma categoria antes de uma sugestão automática (`null` = não tinha limite). */
export interface PreviousBudget {
  readonly categoryId: string;
  readonly limitCents: number | null;
}

export type UndoAction =
  | { readonly type: "restore"; readonly entity: RestorableEntity; readonly ids: readonly string[] }
  | {
      readonly type: "revert-import";
      readonly batchId: string;
      /** Lançamentos que o modo "substituir" tirou e que voltam ao desfazer. */
      readonly restoreIds?: readonly string[];
      /** Espaço criado pela importação (destino "espaço novo"), excluído ao desfazer. */
      readonly createdSpaceId?: string;
    }
  | { readonly type: "restore-category"; readonly category: DeletedCategorySnapshot }
  | { readonly type: "restore-budgets"; readonly previous: readonly PreviousBudget[] };

/**
 * Token de "Desfazer" (10 minutos). O id é o próprio token, aleatório, e só vale para quem o criou.
 */
export const undoTokens = pgTable(
  "undo_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    action: jsonb("action").$type<UndoAction>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("undo_tokens_expires_idx").on(t.expiresAt),
    check("undo_tokens_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

/**
 * Contador de tentativas por janela fixa (`src/server/rate-limit.ts`). A chave junta a regra e quem tenta
 * (ex.: `importar:<userId>`); o upsert atômico conta ou reinicia a janela numa instrução só.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStart)],
);
