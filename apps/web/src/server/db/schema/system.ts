import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

export type UndoAction =
  | { readonly type: "restore"; readonly entity: RestorableEntity; readonly ids: readonly string[] }
  | { readonly type: "revert-import"; readonly batchId: string };

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
