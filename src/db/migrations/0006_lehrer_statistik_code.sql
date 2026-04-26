-- Statistik-Codes fuer Lehrer (NRW-Standard).
--
-- Hintergrund:
-- Untis liefert in der `Teachers`-Tabelle das Feld `StatisticCodes`. Die NRW-
-- Bezirksregierung erwartet in den Personalstatistiken eine Trennung nach
-- diesen Codes (Beamter vs. Angestellter, Vollzeit vs. Teilzeit).
--
-- Ablauf:
-- 1. Stammdatentabelle `statistik_codes` (verwaltbar via /einstellungen)
-- 2. Neue Spalte `lehrer.statistik_code` als FK auf `statistik_codes.code`
-- 3. Initial-Codes werden in einem separaten Seed (`seed-statistik-codes.ts`)
--    angelegt — sind nicht Teil dieser Migration, damit Schema und Daten
--    getrennt bleiben.
--
-- Die Lehrer-Spalte ist nullable — Bestand wird beim naechsten n8n-Sync
-- befuellt, manuelle Lehrer beim naechsten Bearbeiten in der UI.
CREATE TABLE "statistik_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(5) NOT NULL,
	"bezeichnung" varchar(150) NOT NULL,
	"gruppe" varchar(30) NOT NULL,
	"ist_teilzeit" boolean DEFAULT false NOT NULL,
	"sortierung" integer DEFAULT 0 NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"bemerkung" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statistik_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "idx_statistik_codes_gruppe" ON "statistik_codes" ("gruppe");
--> statement-breakpoint
CREATE INDEX "idx_statistik_codes_aktiv" ON "statistik_codes" ("aktiv") WHERE "aktiv" = true;
--> statement-breakpoint
ALTER TABLE "lehrer" ADD COLUMN "statistik_code" varchar(5);
--> statement-breakpoint
ALTER TABLE "lehrer" ADD CONSTRAINT "lehrer_statistik_code_fkey" FOREIGN KEY ("statistik_code") REFERENCES "statistik_codes"("code") ON UPDATE CASCADE ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX "idx_lehrer_statistik_code" ON "lehrer" ("statistik_code");
