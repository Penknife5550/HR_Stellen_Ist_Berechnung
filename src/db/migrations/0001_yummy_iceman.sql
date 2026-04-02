-- Stellenart-Typen: Neue Spalten fuer Drei-Typen-Modell (A/A_106/B/C)
ALTER TABLE "stellenart_typen" ADD COLUMN IF NOT EXISTS "kuerzel" varchar(15);--> statement-breakpoint
ALTER TABLE "stellenart_typen" ADD COLUMN IF NOT EXISTS "typ" varchar(10) DEFAULT 'A' NOT NULL;--> statement-breakpoint
ALTER TABLE "stellenart_typen" ADD COLUMN IF NOT EXISTS "anlage2a" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "stellenart_typen" ADD COLUMN IF NOT EXISTS "erhoeht_pauschale" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stellenart_typen" ADD COLUMN IF NOT EXISTS "parametrisierbar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stellenart_typen" ADD COLUMN IF NOT EXISTS "schulform_filter" jsonb;--> statement-breakpoint

-- Stellenanteile: EUR-Betrag und Wahlrecht fuer Typ B/C
ALTER TABLE "stellenanteile" ADD COLUMN IF NOT EXISTS "eur_betrag" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "stellenanteile" ADD COLUMN IF NOT EXISTS "wahlrecht" varchar(10);
