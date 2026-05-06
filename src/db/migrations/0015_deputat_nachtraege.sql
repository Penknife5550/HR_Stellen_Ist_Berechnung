-- ============================================================
-- Migration 0015: Tabelle deputat_nachtraege
-- ============================================================
-- Hintergrund:
-- Die /nachtraege-Seite las bisher aus deputat_aenderungen (alte v1-Tabelle,
-- vom alten /api/deputate/sync gefuellt). Seit der Umstellung auf das
-- Periodenmodell (v0.7) schreibt nur noch sync-v2, und das fuellt die
-- alte Tabelle nicht mehr — die Nachtraege-Liste war daher leer, obwohl
-- die /deputate-Seite (liest aus v_deputat_aenderungen) die echten
-- gehaltsrelevanten Wertwechsel anzeigte.
--
-- Loesung:
-- Quelle der Wahrheit fuer Vertragsnachtraege ist v_deputat_aenderungen
-- mit ABS(delta_gesamt) > 0,001. Die View ist read-only — daher diese
-- Zusatztabelle fuer den Status (offen / erstellt / versendet) plus
-- Audit (wer, wann erstellt).
--
-- Schluessel: (lehrer_id, sy_alt, term_alt, sy_neu, term_neu) — derselbe
-- Tupel, der eine Zeile in v_deputat_aenderungen identifiziert. Pro
-- Wertwechsel max. ein Status-Eintrag.
-- ============================================================

CREATE TABLE "deputat_nachtraege" (
	"id" serial PRIMARY KEY NOT NULL,
	"lehrer_id" integer NOT NULL,
	"sy_alt" integer NOT NULL,
	"term_alt" integer NOT NULL,
	"sy_neu" integer NOT NULL,
	"term_neu" integer NOT NULL,
	-- NULL = offen, "erstellt" = Word-Dokument wurde generiert,
	-- "versendet" = HR hat den Nachtrag verschickt.
	"status" varchar(20),
	"erstellt_am" timestamp with time zone,
	"erstellt_von" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deputat_nachtraege_unique"
		UNIQUE ("lehrer_id", "sy_alt", "term_alt", "sy_neu", "term_neu"),
	CONSTRAINT "deputat_nachtraege_lehrer_fk"
		FOREIGN KEY ("lehrer_id") REFERENCES "lehrer"("id") ON DELETE CASCADE,
	CONSTRAINT "deputat_nachtraege_status_check"
		CHECK ("status" IS NULL OR "status" IN ('erstellt', 'versendet'))
);
--> statement-breakpoint

CREATE INDEX "idx_deputat_nachtraege_lehrer" ON "deputat_nachtraege" ("lehrer_id", "status");
