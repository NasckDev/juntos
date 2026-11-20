import { sql } from "drizzle-orm";
import { boolean, check, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { spaces } from "./spaces";

/** `import`: "N lançamentos importados" (sempre aparece; não depende das preferências de aviso). */
export const NOTIFICATION_TYPES = ["late", "due", "budget", "goal", "invite", "auto", "import"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const THEMES = ["auto", "light", "dark"] as const;
export const ACCENTS = [
  "indigo",
  "violeta",
  "azul",
  "petroleo",
  "esmeralda",
  "oliva",
  "laranja",
  "rosa",
  "vinho",
  "cafe",
  "grafite",
] as const;
export const FONT_SIZES = ["menor", "normal", "grande", "maior"] as const;

/** Tipos de aviso que a pessoa liga ou desliga em Ajustes > Avisos (mesmas chaves do protótipo). */
export interface NotifyPreferences {
  late: boolean;
  due: boolean;
  budget: boolean;
  goal: boolean;
  auto: boolean;
  people: boolean;
}

export const DEFAULT_NOTIFY: NotifyPreferences = {
  late: true,
  due: true,
  budget: true,
  goal: true,
  auto: true,
  people: true,
};

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    /** Destinatário; nulo = todos os membros do espaço. */
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    competence: date("competence"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_space_dedupe_uq").on(t.spaceId, t.dedupeKey),
    index("notifications_user_idx").on(t.userId, t.createdAt),
    check("notifications_type_check", sql`${t.type} in ('late', 'due', 'budget', 'goal', 'invite', 'auto', 'import')`),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    theme: text("theme", { enum: THEMES }).notNull().default("auto"),
    accent: text("accent", { enum: ACCENTS }).notNull().default("indigo"),
    fontSize: text("font_size", { enum: FONT_SIZES }).notNull().default("normal"),
    hideValues: boolean("hide_values").notNull().default(false),
    notify: jsonb("notify").$type<NotifyPreferences>().notNull().default(DEFAULT_NOTIFY),
    /** Só depois de verificado (WhatsApp fica atrás de flag desligada, decisão 3). */
    whatsappE164: text("whatsapp_e164"),
    /** Nulo enquanto a pessoa nunca mudou nada (usado para levar as preferências do convidado ao vincular o Google). */
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    check("user_preferences_theme_check", sql`${t.theme} in ('auto', 'light', 'dark')`),
    check(
      "user_preferences_accent_check",
      sql`${t.accent} in ('indigo', 'violeta', 'azul', 'petroleo', 'esmeralda', 'oliva', 'laranja', 'rosa', 'vinho', 'cafe', 'grafite')`,
    ),
    check("user_preferences_font_check", sql`${t.fontSize} in ('menor', 'normal', 'grande', 'maior')`),
  ],
);
