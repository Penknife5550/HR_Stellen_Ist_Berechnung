-- Speicherung der Lehrerdeputate pro Untis-Periode (statt pro Monat).
--
-- Hintergrund:
-- Untis liefert Deputatswerte tagesgenau auf Periodenebene (Tabelle Teacher mit
-- TERM_ID). Die App hat bisher pro Monat einen einzigen Wert gespeichert und
-- bei Periodenkonflikten via Coverage-Tie-Breaker nur den dominanten Wert
-- behalten — alle anderen Periodenwerte gingen verloren. Damit war eine
-- tagesgenaue Berechnung unmoeglich.
--
-- Mit diesem Modell:
--  - untis_terms          = Master-Periodendaten (1:1 Spiegel der Untis-Terms)
--  - deputat_pro_periode  = pro (Lehrer × Periode) ein Wert
--  - v_deputat_pro_tag    = pro Tag der gueltige Wert (mit Fortschreiben in Luecken)
--  - v_deputat_monat_tagesgenau = Monatsmittel ueber die Kalendertage
--
-- Leitprinzip: Untis ist die Quelle der Wahrheit. Die App spiegelt 1:1 und
-- bereitet auf — keine Coverage-Logik mehr, kein Datenverlust.
--
-- Migration ist additiv: deputat_monatlich und deputat_aenderungen bleiben
-- unveraendert. Die Umstellung der Berechnungen erfolgt in Phase 2.

-- ============================================================
-- 1. untis_terms — Master-Periodendaten
-- ============================================================
CREATE TABLE "untis_terms" (
	"school_year_id" integer NOT NULL,
	"term_id" integer NOT NULL,
	"term_name" varchar(50),
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"is_b_period" boolean DEFAULT false NOT NULL,
	"sync_datum" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "untis_terms_pkey" PRIMARY KEY ("school_year_id", "term_id"),
	CONSTRAINT "untis_terms_dates_check" CHECK ("date_from" <= "date_to")
);
--> statement-breakpoint
CREATE INDEX "idx_untis_terms_zeitraum" ON "untis_terms" ("date_from", "date_to");
--> statement-breakpoint

-- ============================================================
-- 2. deputat_pro_periode — Lehrer-Werte pro Periode
-- ============================================================
CREATE TABLE "deputat_pro_periode" (
	"id" serial PRIMARY KEY NOT NULL,
	"lehrer_id" integer NOT NULL,
	"untis_schoolyear_id" integer NOT NULL,
	"untis_term_id" integer NOT NULL,
	"gueltig_von" date NOT NULL,
	"gueltig_bis" date NOT NULL,
	"deputat_gesamt" numeric(8, 3) NOT NULL,
	"deputat_ges" numeric(8, 3) DEFAULT '0' NOT NULL,
	"deputat_gym" numeric(8, 3) DEFAULT '0' NOT NULL,
	"deputat_bk" numeric(8, 3) DEFAULT '0' NOT NULL,
	"stammschule_code" varchar(10),
	"quelle" varchar(20) DEFAULT 'untis' NOT NULL,
	"sync_datum" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deputat_pro_periode_unique" UNIQUE ("lehrer_id", "untis_schoolyear_id", "untis_term_id"),
	CONSTRAINT "deputat_pro_periode_dates_check" CHECK ("gueltig_von" <= "gueltig_bis"),
	CONSTRAINT "deputat_pro_periode_lehrer_fk"
		FOREIGN KEY ("lehrer_id") REFERENCES "lehrer"("id") ON DELETE CASCADE,
	CONSTRAINT "deputat_pro_periode_term_fk"
		FOREIGN KEY ("untis_schoolyear_id", "untis_term_id")
		REFERENCES "untis_terms"("school_year_id", "term_id")
		ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX "idx_dpp_lehrer" ON "deputat_pro_periode" ("lehrer_id");
--> statement-breakpoint
CREATE INDEX "idx_dpp_zeitraum" ON "deputat_pro_periode" ("gueltig_von", "gueltig_bis");
--> statement-breakpoint
CREATE INDEX "idx_dpp_term" ON "deputat_pro_periode" ("untis_schoolyear_id", "untis_term_id");
--> statement-breakpoint

-- ============================================================
-- 3. View v_deputat_pro_tag — pro Tag der gueltige Wert
-- ============================================================
-- Liefert fuer jeden Tag im erfassten Zeitraum (+ 90 Tage Puffer fuer Ferien)
-- den aktuell gueltigen Deputat-Wert pro Lehrer. In Luecken (z.B. Sommerferien
-- zwischen Schuljahren) wird der letzte bekannte Wert fortgeschrieben.
CREATE OR REPLACE VIEW "v_deputat_pro_tag" AS
WITH tage AS (
	SELECT generate_series(
		COALESCE((SELECT MIN(gueltig_von) FROM deputat_pro_periode), CURRENT_DATE),
		COALESCE((SELECT MAX(gueltig_bis) FROM deputat_pro_periode) + INTERVAL '90 days', CURRENT_DATE),
		INTERVAL '1 day'
	)::date AS tag
),
lehrer_aktiv AS (
	SELECT DISTINCT lehrer_id FROM deputat_pro_periode
)
SELECT
	t.tag,
	la.lehrer_id,
	letzte.deputat_gesamt,
	letzte.deputat_ges,
	letzte.deputat_gym,
	letzte.deputat_bk,
	letzte.untis_schoolyear_id,
	letzte.untis_term_id,
	(t.tag BETWEEN letzte.gueltig_von AND letzte.gueltig_bis) AS in_periode
FROM tage t
CROSS JOIN lehrer_aktiv la
CROSS JOIN LATERAL (
	SELECT dpp.gueltig_von, dpp.gueltig_bis,
	       dpp.deputat_gesamt, dpp.deputat_ges, dpp.deputat_gym, dpp.deputat_bk,
	       dpp.untis_schoolyear_id, dpp.untis_term_id
	FROM deputat_pro_periode dpp
	WHERE dpp.lehrer_id = la.lehrer_id
	  AND dpp.gueltig_von <= t.tag
	ORDER BY dpp.gueltig_von DESC
	LIMIT 1
) letzte;
--> statement-breakpoint

-- ============================================================
-- 4. View v_deputat_monat_tagesgenau — Monatsmittel ueber Kalendertage
-- ============================================================
-- Aggregiert v_deputat_pro_tag pro (Lehrer, Haushaltsjahr, Monat) zu einem
-- Mittelwert ueber alle Kalendertage. Nenner ist immer die volle Monatslaenge
-- (28/29/30/31), unabhaengig davon ob Schulbetrieb war — Lehrer behalten ihr
-- Deputat auch in Ferien.
CREATE OR REPLACE VIEW "v_deputat_monat_tagesgenau" AS
SELECT
	vdt.lehrer_id,
	hj.id                              AS haushaltsjahr_id,
	EXTRACT(YEAR  FROM vdt.tag)::int   AS jahr,
	EXTRACT(MONTH FROM vdt.tag)::int   AS monat,
	ROUND(AVG(vdt.deputat_gesamt)::numeric, 4) AS deputat_gesamt_tagesgenau,
	ROUND(AVG(vdt.deputat_ges)::numeric, 4)    AS deputat_ges_tagesgenau,
	ROUND(AVG(vdt.deputat_gym)::numeric, 4)    AS deputat_gym_tagesgenau,
	ROUND(AVG(vdt.deputat_bk)::numeric, 4)     AS deputat_bk_tagesgenau,
	COUNT(*)                           AS tage_im_monat,
	mode() WITHIN GROUP (ORDER BY vdt.untis_term_id) AS dominante_term_id,
	mode() WITHIN GROUP (ORDER BY vdt.untis_schoolyear_id) AS dominante_schoolyear_id
FROM v_deputat_pro_tag vdt
JOIN haushaltsjahre hj
  ON hj.jahr = EXTRACT(YEAR FROM vdt.tag)::int
GROUP BY vdt.lehrer_id, hj.id, EXTRACT(YEAR FROM vdt.tag), EXTRACT(MONTH FROM vdt.tag);
--> statement-breakpoint

-- ============================================================
-- 5. View v_deputat_aenderungen — echte Wertwechsel zwischen Perioden
-- ============================================================
-- Vergleicht jeden Periodenwert eines Lehrers mit dem Wert der zeitlich
-- direkt folgenden Periode (LEAD ueber gueltig_von). Zeigt nur Zeilen, in
-- denen der Wert sich tatsaechlich aendert. Funktioniert auch ueber
-- Schuljahresgrenzen hinweg.
CREATE OR REPLACE VIEW "v_deputat_aenderungen" AS
WITH mit_folge AS (
	SELECT
		dpp.lehrer_id,
		dpp.untis_schoolyear_id    AS sy_alt,
		dpp.untis_term_id          AS term_alt,
		dpp.gueltig_von            AS gueltig_von_alt,
		dpp.gueltig_bis            AS gueltig_bis_alt,
		dpp.deputat_gesamt         AS gesamt_alt,
		dpp.deputat_ges            AS ges_alt,
		dpp.deputat_gym            AS gym_alt,
		dpp.deputat_bk             AS bk_alt,
		LEAD(dpp.untis_schoolyear_id) OVER w  AS sy_neu,
		LEAD(dpp.untis_term_id) OVER w        AS term_neu,
		LEAD(dpp.gueltig_von) OVER w          AS gueltig_von_neu,
		LEAD(dpp.deputat_gesamt) OVER w       AS gesamt_neu,
		LEAD(dpp.deputat_ges) OVER w          AS ges_neu,
		LEAD(dpp.deputat_gym) OVER w          AS gym_neu,
		LEAD(dpp.deputat_bk) OVER w           AS bk_neu
	FROM deputat_pro_periode dpp
	WINDOW w AS (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)
)
SELECT
	lehrer_id,
	sy_alt, term_alt, gueltig_von_alt, gueltig_bis_alt,
	sy_neu, term_neu, gueltig_von_neu                   AS wirksam_ab,
	gesamt_alt, gesamt_neu,
	(gesamt_neu - gesamt_alt)                           AS delta_gesamt,
	ges_alt, ges_neu,
	gym_alt, gym_neu,
	bk_alt, bk_neu
FROM mit_folge
WHERE term_neu IS NOT NULL
  AND (
		gesamt_alt <> gesamt_neu
	OR  ges_alt    <> ges_neu
	OR  gym_alt    <> gym_neu
	OR  bk_alt     <> bk_neu
  );
