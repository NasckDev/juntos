import type { ImportItem } from "@juntos/core";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { spaceMembers, spaces } from "./spaces";

/**
 * Dinheiro sempre em centavos inteiros (`bigint`, ADR 0002). O tipo (`kind`) dá o sinal; o valor é sempre positivo.
 * Mês de competência guardado como `date` no dia 1 + `day smallint` (dia do vencimento dentro do mês).
 */

export const KINDS = ["in", "out", "save"] as const;

const cents = (name: string) => bigint(name, { mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
const actor = (name: string) => text(name).references(() => user.id, { onDelete: "set null" });

/** Categorias. `space_id` nulo = categoria padrão do sistema, global (decisão 8). */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    /** Identificador estável das categorias padrão (ex.: "moradia"); nulo nas personalizadas. */
    key: text("key"),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    hue: smallint("hue").notNull(),
    kind: text("kind", { enum: KINDS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("categories_default_key_uq").on(t.key).where(sql`${t.spaceId} is null`),
    uniqueIndex("categories_space_kind_name_uq").on(t.spaceId, t.kind, sql`lower(${t.name})`),
    check("categories_kind_check", sql`${t.kind} in ('in', 'out', 'save')`),
    check("categories_hue_check", sql`${t.hue} between 0 and 360`),
    check("categories_default_check", sql`(${t.spaceId} is null) = (${t.key} is not null)`),
  ],
);

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    source: text("source", { enum: ["monthly-sheet", "detailed-export"] }).notNull(),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsImported: integer("rows_imported").notNull().default(0),
    mode: text("mode", { enum: ["add", "replace"] }).notNull(),
    status: text("status", { enum: ["review", "done", "undone"] })
      .notNull()
      .default("review"),
    /** Linhas lidas da planilha, já normalizadas pelo core (categoria = id no banco). Revisadas antes de gravar. */
    items: jsonb("items").$type<ImportItem[]>().notNull().default([]),
    createdBy: actor("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("import_batches_space_idx").on(t.spaceId),
    check("import_batches_source_check", sql`${t.source} in ('monthly-sheet', 'detailed-export')`),
    check("import_batches_mode_check", sql`${t.mode} in ('add', 'replace')`),
    check("import_batches_status_check", sql`${t.status} in ('review', 'done', 'undone')`),
  ],
);

/** Contas fixas (recorrências). */
export const recurrences = pgTable(
  "recurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: KINDS }).notNull(),
    description: text("description").notNull(),
    amountCents: cents("amount_cents").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    frequency: text("frequency", { enum: ["monthly", "yearly"] }).notNull(),
    day: smallint("day").notNull(),
    startCompetence: date("start_competence").notNull(),
    /** Nulo = sem fim. */
    installmentsTotal: smallint("installments_total"),
    paymentMethod: text("payment_method").notNull().default(""),
    paidBy: uuid("paid_by").references(() => spaceMembers.id, { onDelete: "set null" }),
    personal: boolean("personal").notNull().default(false),
    paused: boolean("paused").notNull().default(false),
    createdBy: actor("created_by"),
    updatedBy: actor("updated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("recurrences_space_idx").on(t.spaceId).where(sql`${t.deletedAt} is null`),
    check("recurrences_amount_check", sql`${t.amountCents} > 0`),
    check("recurrences_kind_check", sql`${t.kind} in ('in', 'out', 'save')`),
    check("recurrences_frequency_check", sql`${t.frequency} in ('monthly', 'yearly')`),
    check("recurrences_day_check", sql`${t.day} between 1 and 31`),
    check("recurrences_start_check", sql`extract(day from ${t.startCompetence}) = 1`),
    check("recurrences_installments_check", sql`${t.installmentsTotal} is null or ${t.installmentsTotal} > 0`),
  ],
);

/** Lançamentos. */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: KINDS }).notNull(),
    description: text("description").notNull(),
    amountCents: cents("amount_cents").notNull(),
    /** Mês de competência: sempre o dia 1. */
    competence: date("competence").notNull(),
    /** Dia do vencimento (ou do recebimento) dentro do mês. */
    day: smallint("day").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    paid: boolean("paid").notNull().default(false),
    paidAt: date("paid_at"),
    paymentMethod: text("payment_method").notNull().default(""),
    paidBy: uuid("paid_by").references(() => spaceMembers.id, { onDelete: "set null" }),
    /** Gasto pessoal: fica fora da divisão. */
    personal: boolean("personal").notNull().default(false),
    note: text("note").notNull().default(""),
    recurrenceId: uuid("recurrence_id").references(() => recurrences.id, { onDelete: "set null" }),
    installmentNumber: smallint("installment_number"),
    installmentsTotal: smallint("installments_total"),
    yearly: boolean("yearly").notNull().default(false),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, { onDelete: "set null" }),
    createdBy: actor("created_by"),
    updatedBy: actor("updated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("transactions_space_competence_idx").on(t.spaceId, t.competence).where(sql`${t.deletedAt} is null`),
    /** Inclui os excluídos de propósito: a conta fixa apagada num mês não volta no próximo job. */
    uniqueIndex("transactions_recurrence_competence_uq").on(t.recurrenceId, t.competence),
    index("transactions_import_batch_idx").on(t.importBatchId),
    check("transactions_amount_check", sql`${t.amountCents} > 0`),
    check("transactions_kind_check", sql`${t.kind} in ('in', 'out', 'save')`),
    check("transactions_day_check", sql`${t.day} between 1 and 31`),
    check("transactions_competence_check", sql`extract(day from ${t.competence}) = 1`),
    check(
      "transactions_installment_check",
      sql`${t.installmentNumber} is null or (${t.installmentNumber} > 0 and ${t.installmentsTotal} >= ${t.installmentNumber})`,
    ),
  ],
);

/** Limite mensal por categoria. */
export const budgets = pgTable(
  "budgets",
  {
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    monthlyLimitCents: cents("monthly_limit_cents").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.spaceId, t.categoryId] }),
    check("budgets_limit_check", sql`${t.monthlyLimitCents} > 0`),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("meta"),
    targetCents: cents("target_cents").notNull(),
    monthlyCents: cents("monthly_cents").notNull().default(0),
    createdBy: actor("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("goals_space_idx").on(t.spaceId).where(sql`${t.deletedAt} is null`),
    // O serviço já confere o nome com mensagem amigável; o índice garante a regra mesmo com dois pedidos ao mesmo tempo.
    uniqueIndex("goals_space_name_uq").on(t.spaceId, sql`lower(${t.name})`).where(sql`${t.deletedAt} is null`),
    check("goals_target_check", sql`${t.targetCents} > 0`),
    check("goals_monthly_check", sql`${t.monthlyCents} >= 0`),
  ],
);

/** Depósito numa meta. Vira um lançamento "Guardado"; a ligação permite desfazer os dois juntos. */
export const goalDeposits = pgTable(
  "goal_deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    transactionId: uuid("transaction_id")
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: "cascade" }),
    amountCents: cents("amount_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("goal_deposits_goal_idx").on(t.goalId), check("goal_deposits_amount_check", sql`${t.amountCents} > 0`)],
);

/** Acerto entre pessoas; vale para o período inteiro (decisão 6). */
export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    fromMember: uuid("from_member")
      .notNull()
      .references(() => spaceMembers.id, { onDelete: "cascade" }),
    toMember: uuid("to_member")
      .notNull()
      .references(() => spaceMembers.id, { onDelete: "cascade" }),
    amountCents: cents("amount_cents").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: actor("created_by"),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("settlements_space_period_idx").on(t.spaceId, t.periodStart).where(sql`${t.deletedAt} is null`),
    check("settlements_amount_check", sql`${t.amountCents} > 0`),
    check("settlements_period_check", sql`${t.periodEnd} >= ${t.periodStart}`),
    check("settlements_members_check", sql`${t.fromMember} <> ${t.toMember}`),
  ],
);
