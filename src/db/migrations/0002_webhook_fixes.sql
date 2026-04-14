ALTER TABLE "notification_log" DROP CONSTRAINT "notification_log_target_id_notification_targets_id_fk";--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_target_id_notification_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."notification_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_webhook_configs_prefix" ON "webhook_configs" USING btree ("api_key_prefix");
