CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"avatar" text,
	"deletion_requested_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"space_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"monthly_limit_cents" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_space_id_category_id_pk" PRIMARY KEY("space_id","category_id"),
	CONSTRAINT "budgets_limit_check" CHECK ("budgets"."monthly_limit_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid,
	"key" text,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"hue" smallint NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_kind_check" CHECK ("categories"."kind" in ('in', 'out', 'save')),
	CONSTRAINT "categories_hue_check" CHECK ("categories"."hue" between 0 and 360),
	CONSTRAINT "categories_default_check" CHECK (("categories"."space_id" is null) = ("categories"."key" is not null))
);
--> statement-breakpoint
CREATE TABLE "goal_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_deposits_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "goal_deposits_amount_check" CHECK ("goal_deposits"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'meta' NOT NULL,
	"target_cents" bigint NOT NULL,
	"monthly_cents" bigint DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "goals_target_check" CHECK ("goals"."target_cents" > 0),
	CONSTRAINT "goals_monthly_check" CHECK ("goals"."monthly_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"source" text NOT NULL,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_imported" integer DEFAULT 0 NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'review' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_source_check" CHECK ("import_batches"."source" in ('monthly-sheet', 'detailed-export')),
	CONSTRAINT "import_batches_mode_check" CHECK ("import_batches"."mode" in ('add', 'replace')),
	CONSTRAINT "import_batches_status_check" CHECK ("import_batches"."status" in ('review', 'done', 'undone'))
);
--> statement-breakpoint
CREATE TABLE "recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"category_id" uuid NOT NULL,
	"frequency" text NOT NULL,
	"day" smallint NOT NULL,
	"start_competence" date NOT NULL,
	"installments_total" smallint,
	"payment_method" text DEFAULT '' NOT NULL,
	"paid_by" uuid,
	"personal" boolean DEFAULT false NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "recurrences_amount_check" CHECK ("recurrences"."amount_cents" > 0),
	CONSTRAINT "recurrences_kind_check" CHECK ("recurrences"."kind" in ('in', 'out', 'save')),
	CONSTRAINT "recurrences_frequency_check" CHECK ("recurrences"."frequency" in ('monthly', 'yearly')),
	CONSTRAINT "recurrences_day_check" CHECK ("recurrences"."day" between 1 and 31),
	CONSTRAINT "recurrences_start_check" CHECK (extract(day from "recurrences"."start_competence") = 1),
	CONSTRAINT "recurrences_installments_check" CHECK ("recurrences"."installments_total" is null or "recurrences"."installments_total" > 0)
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"from_member" uuid NOT NULL,
	"to_member" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "settlements_amount_check" CHECK ("settlements"."amount_cents" > 0),
	CONSTRAINT "settlements_period_check" CHECK ("settlements"."period_end" >= "settlements"."period_start"),
	CONSTRAINT "settlements_members_check" CHECK ("settlements"."from_member" <> "settlements"."to_member")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"competence" date NOT NULL,
	"day" smallint NOT NULL,
	"category_id" uuid NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" date,
	"payment_method" text DEFAULT '' NOT NULL,
	"paid_by" uuid,
	"personal" boolean DEFAULT false NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recurrence_id" uuid,
	"installment_number" smallint,
	"installments_total" smallint,
	"yearly" boolean DEFAULT false NOT NULL,
	"import_batch_id" uuid,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_cents" > 0),
	CONSTRAINT "transactions_kind_check" CHECK ("transactions"."kind" in ('in', 'out', 'save')),
	CONSTRAINT "transactions_day_check" CHECK ("transactions"."day" between 1 and 31),
	CONSTRAINT "transactions_competence_check" CHECK (extract(day from "transactions"."competence") = 1),
	CONSTRAINT "transactions_installment_check" CHECK ("transactions"."installment_number" is null or ("transactions"."installment_number" > 0 and "transactions"."installments_total" >= "transactions"."installment_number"))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"competence" date,
	"seen_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" in ('late', 'due', 'budget', 'goal', 'invite', 'auto'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"theme" text DEFAULT 'auto' NOT NULL,
	"accent" text DEFAULT 'indigo' NOT NULL,
	"font_size" text DEFAULT 'normal' NOT NULL,
	"hide_values" boolean DEFAULT false NOT NULL,
	"notify" jsonb DEFAULT '{"late":true,"due":true,"budget":true,"goal":true,"auto":true,"people":true}'::jsonb NOT NULL,
	"whatsapp_e164" text,
	"updated_at" timestamp with time zone,
	CONSTRAINT "user_preferences_theme_check" CHECK ("user_preferences"."theme" in ('auto', 'light', 'dark')),
	CONSTRAINT "user_preferences_accent_check" CHECK ("user_preferences"."accent" in ('indigo', 'violeta', 'azul', 'petroleo', 'esmeralda', 'oliva', 'laranja', 'rosa', 'vinho', 'cafe', 'grafite')),
	CONSTRAINT "user_preferences_font_check" CHECK ("user_preferences"."font_size" in ('menor', 'normal', 'grande', 'maior'))
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"invited_by" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invites_role_check" CHECK ("invites"."role" in ('editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "space_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" text,
	"invited_email" text,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_members_role_check" CHECK ("space_members"."role" in ('owner', 'editor', 'viewer')),
	CONSTRAINT "space_members_status_check" CHECK ("space_members"."status" in ('invited', 'active', 'removed')),
	CONSTRAINT "space_members_identity_check" CHECK (("space_members"."status" in ('active', 'removed') and "space_members"."user_id" is not null) or ("space_members"."status" = 'invited' and "space_members"."invited_email" is not null))
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'casa' NOT NULL,
	"split_mode" text DEFAULT 'equal' NOT NULL,
	"split_pct" smallint DEFAULT 50 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "spaces_split_mode_check" CHECK ("spaces"."split_mode" in ('equal', 'income', 'custom')),
	CONSTRAINT "spaces_split_pct_check" CHECK ("spaces"."split_pct" between 0 and 100),
	CONSTRAINT "spaces_name_check" CHECK (char_length("spaces"."name") between 2 and 30)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"space_id" uuid NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"diff" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "undo_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"space_id" uuid NOT NULL,
	"action" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "undo_tokens_expiry_check" CHECK ("undo_tokens"."expires_at" > "undo_tokens"."created_at")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_deposits" ADD CONSTRAINT "goal_deposits_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_deposits" ADD CONSTRAINT "goal_deposits_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_deposits" ADD CONSTRAINT "goal_deposits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_paid_by_space_members_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."space_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_member_space_members_id_fk" FOREIGN KEY ("from_member") REFERENCES "public"."space_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_member_space_members_id_fk" FOREIGN KEY ("to_member") REFERENCES "public"."space_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paid_by_space_members_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."space_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_id_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_member_id_space_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."space_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "undo_tokens" ADD CONSTRAINT "undo_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "undo_tokens" ADD CONSTRAINT "undo_tokens_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_default_key_uq" ON "categories" USING btree ("key") WHERE "categories"."space_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_space_kind_name_uq" ON "categories" USING btree ("space_id","kind",lower("name"));--> statement-breakpoint
CREATE INDEX "goal_deposits_goal_idx" ON "goal_deposits" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goals_space_idx" ON "goals" USING btree ("space_id") WHERE "goals"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "import_batches_space_idx" ON "import_batches" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "recurrences_space_idx" ON "recurrences" USING btree ("space_id") WHERE "recurrences"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "settlements_space_period_idx" ON "settlements" USING btree ("space_id","period_start") WHERE "settlements"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transactions_space_competence_idx" ON "transactions" USING btree ("space_id","competence") WHERE "transactions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_recurrence_competence_uq" ON "transactions" USING btree ("recurrence_id","competence");--> statement-breakpoint
CREATE INDEX "transactions_import_batch_idx" ON "transactions" USING btree ("import_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_space_dedupe_uq" ON "notifications" USING btree ("space_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invites_space_idx" ON "invites" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "invites_expires_idx" ON "invites" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "space_members_space_user_uq" ON "space_members" USING btree ("space_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_members_space_email_uq" ON "space_members" USING btree ("space_id","invited_email");--> statement-breakpoint
CREATE INDEX "space_members_user_idx" ON "space_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_space_at_idx" ON "audit_log" USING btree ("space_id","at");--> statement-breakpoint
CREATE INDEX "undo_tokens_expires_idx" ON "undo_tokens" USING btree ("expires_at");