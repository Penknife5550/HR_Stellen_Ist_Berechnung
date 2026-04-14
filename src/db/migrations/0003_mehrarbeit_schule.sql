CREATE TABLE "mehrarbeit_schule_bemerkung" (
	"id" serial PRIMARY KEY NOT NULL,
	"schule_id" integer NOT NULL,
	"haushaltsjahr_id" integer NOT NULL,
	"bemerkung" text DEFAULT '' NOT NULL,
	"geaendert_von" varchar(100),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mehrarbeit_schule_bemerkung_unique" UNIQUE("schule_id","haushaltsjahr_id")
);
--> statement-breakpoint
ALTER TABLE "mehrarbeit" DROP CONSTRAINT "mehrarbeit_unique";--> statement-breakpoint
ALTER TABLE "mehrarbeit" ALTER COLUMN "lehrer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mehrarbeit" ADD COLUMN "stellenanteil" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "mehrarbeit_schule_bemerkung" ADD CONSTRAINT "mehrarbeit_schule_bemerkung_schule_id_schulen_id_fk" FOREIGN KEY ("schule_id") REFERENCES "public"."schulen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mehrarbeit_schule_bemerkung" ADD CONSTRAINT "mehrarbeit_schule_bemerkung_haushaltsjahr_id_haushaltsjahre_id_fk" FOREIGN KEY ("haushaltsjahr_id") REFERENCES "public"."haushaltsjahre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mehrarbeit_lehrer_unique" ON "mehrarbeit" USING btree ("lehrer_id","haushaltsjahr_id","monat","schule_id") WHERE lehrer_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "mehrarbeit_schule_unique" ON "mehrarbeit" USING btree ("schule_id","haushaltsjahr_id","monat") WHERE lehrer_id IS NULL;