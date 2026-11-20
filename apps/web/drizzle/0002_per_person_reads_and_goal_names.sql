CREATE TABLE "notification_reads" (
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_reads_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_reads_user_idx" ON "notification_reads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_space_name_uq" ON "goals" USING btree ("space_id",lower("name")) WHERE "goals"."deleted_at" is null;--> statement-breakpoint
-- Leva o visto e o lido que já existiam para a tabela nova: o aviso de uma pessoa fica com ela; o do espaço todo
-- (user_id nulo) fica para cada membro ativo, para ninguém ver avisos antigos voltarem como novos.
INSERT INTO "notification_reads" ("notification_id", "user_id", "seen_at", "read_at")
SELECT "id", "user_id", coalesce("seen_at", "read_at"), "read_at"
FROM "notifications"
WHERE "user_id" IS NOT NULL AND ("seen_at" IS NOT NULL OR "read_at" IS NOT NULL);--> statement-breakpoint
INSERT INTO "notification_reads" ("notification_id", "user_id", "seen_at", "read_at")
SELECT n."id", m."user_id", coalesce(n."seen_at", n."read_at"), n."read_at"
FROM "notifications" n
INNER JOIN "space_members" m ON m."space_id" = n."space_id" AND m."status" = 'active' AND m."user_id" IS NOT NULL
WHERE n."user_id" IS NULL AND (n."seen_at" IS NOT NULL OR n."read_at" IS NOT NULL)
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "seen_at";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "read_at";