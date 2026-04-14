CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_id" integer,
	"event_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_attempt_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"http_status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(200),
	"event_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"headers" jsonb,
	"aktiv" boolean DEFAULT true NOT NULL,
	"beschreibung" text,
	"erstellt_von" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"endpoint_typ" varchar(30) DEFAULT 'sync' NOT NULL,
	"api_key_hash" varchar(200) NOT NULL,
	"api_key_prefix" varchar(12) NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"beschreibung" text,
	"last_used_at" timestamp with time zone,
	"erstellt_von" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_target_id_notification_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."notification_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notification_log_status" ON "notification_log" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_notification_log_target" ON "notification_log" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_notification_log_created" ON "notification_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_targets_aktiv" ON "notification_targets" USING btree ("aktiv");--> statement-breakpoint
CREATE INDEX "idx_webhook_configs_aktiv" ON "webhook_configs" USING btree ("aktiv");