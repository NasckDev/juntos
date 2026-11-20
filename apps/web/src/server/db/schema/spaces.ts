import { sql } from "drizzle-orm";
import { check, index, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const ROLES = ["owner", "editor", "viewer"] as const;
/** `removed`: tirado do espaço pelo dono; a linha fica para o histórico da divisão (quem pagou), sem acesso. */
export const MEMBER_STATUSES = ["invited", "active", "removed"] as const;
export const SPLIT_MODES = ["equal", "income", "custom"] as const;

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("casa"),
    splitMode: text("split_mode", { enum: SPLIT_MODES }).notNull().default("equal"),
    /** Percentual da primeira pessoa no modo `custom` (0 a 100). */
    splitPct: smallint("split_pct").notNull().default(50),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("spaces_split_mode_check", sql`${t.splitMode} in ('equal', 'income', 'custom')`),
    check("spaces_split_pct_check", sql`${t.splitPct} between 0 and 100`),
    check("spaces_name_check", sql`char_length(${t.name}) between 2 and 30`),
  ],
);

export const spaceMembers = pgTable(
  "space_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    /** Nulo enquanto o convite não foi aceito. */
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    /** E-mail usado no convite, em minúsculas. */
    invitedEmail: text("invited_email"),
    role: text("role", { enum: ROLES }).notNull(),
    status: text("status", { enum: MEMBER_STATUSES }).notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("space_members_space_user_uq").on(t.spaceId, t.userId),
    uniqueIndex("space_members_space_email_uq").on(t.spaceId, t.invitedEmail),
    index("space_members_user_idx").on(t.userId),
    check("space_members_role_check", sql`${t.role} in ('owner', 'editor', 'viewer')`),
    check("space_members_status_check", sql`${t.status} in ('invited', 'active', 'removed')`),
    check(
      "space_members_identity_check",
      sql`(${t.status} in ('active', 'removed') and ${t.userId} is not null) or (${t.status} = 'invited' and ${t.invitedEmail} is not null)`,
    ),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    /** Membro pendente criado junto com o convite; remover o membro apaga o convite. */
    memberId: uuid("member_id")
      .notNull()
      .references(() => spaceMembers.id, { onDelete: "cascade" }),
    /** SHA-256 (hex) do token. O token em si só existe no link enviado. */
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    role: text("role", { enum: ROLES }).notNull(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: text("accepted_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invites_space_idx").on(t.spaceId),
    index("invites_expires_idx").on(t.expiresAt),
    check("invites_role_check", sql`${t.role} in ('editor', 'viewer')`),
  ],
);
