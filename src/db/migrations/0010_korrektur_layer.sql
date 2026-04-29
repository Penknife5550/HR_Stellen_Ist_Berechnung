-- Korrektur-Layer fuer Sachbearbeiter-Korrekturen des Wirksamkeitsdatums.
--
-- Hintergrund:
-- Untis erlaubt aus technischen Gruenden Periodenwechsel nur zum Montag.
-- Der tatsaechliche Stichtag der Aenderung im Personalbestand kann aber an
-- jedem Wochentag sein (z.B. Mi 04.02. statt Mo 09.02.). Fuer die korrekte
-- Refinanzierung nach § 3 Abs. 1 FESchVO und die Gehaltsabrechnung muss
-- das echte Datum tagesgenau erfasst werden.
--
-- Leitprinzip: Untis (deputat_pro_periode) bleibt 1:1 die Quelle der Wahrheit.
-- Die menschliche Korrektur lebt in einer EIGENEN Tabelle, die beim naechsten
-- Untis-Sync nicht angetastet wird.
--
-- Pro Term-zu-Term-Wechsel max. eine Korrektur (Unique auf lehrer + sy_neu + term_neu).

-- ============================================================
-- 1. Korrektur-Tabelle
-- ============================================================
CREATE TABLE "deputat_aenderung_korrekturen" (
	"id" serial PRIMARY KEY NOT NULL,
	"lehrer_id" integer NOT NULL,
	-- "alt"-Periode (Periode VOR dem Wechsel)
	"sy_alt" integer NOT NULL,
	"term_id_alt" integer NOT NULL,
	-- "neu"-Periode (an deren effektivem Wirksamkeitsdatum die Korrektur dranhaengt)
	"sy_neu" integer NOT NULL,
	"term_id_neu" integer NOT NULL,
	-- Echter Stichtag der Aenderung (kann an jedem Wochentag liegen)
	"tatsaechliches_datum" date NOT NULL,
	-- Audit
	"korrigiert_von" varchar(100),
	"korrigiert_am" timestamp with time zone DEFAULT now() NOT NULL,
	"bemerkung" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deputat_aenderung_korrekturen_unique"
		UNIQUE ("lehrer_id", "sy_neu", "term_id_neu"),
	CONSTRAINT "deputat_aenderung_korrekturen_lehrer_fk"
		FOREIGN KEY ("lehrer_id") REFERENCES "lehrer"("id") ON DELETE CASCADE,
	CONSTRAINT "deputat_aenderung_korrekturen_term_alt_fk"
		FOREIGN KEY ("sy_alt", "term_id_alt") REFERENCES "untis_terms"("school_year_id", "term_id"),
	CONSTRAINT "deputat_aenderung_korrekturen_term_neu_fk"
		FOREIGN KEY ("sy_neu", "term_id_neu") REFERENCES "untis_terms"("school_year_id", "term_id")
);
--> statement-breakpoint
CREATE INDEX "idx_dak_lehrer" ON "deputat_aenderung_korrekturen" ("lehrer_id");
--> statement-breakpoint

-- ============================================================
-- 2. View v_deputat_pro_tag — neu mit effektiv_von
-- ============================================================
-- Periodenwerte werden bei der Tag-Zuordnung anhand des EFFEKTIVEN Wirksamkeits-
-- datums sortiert: das ist normalerweise gueltig_von (= Untis-Montag), kann aber
-- per Korrektur auf den realen Stichtag verschoben werden. Wenn eine Korrektur
-- den Termstart vorzieht, gilt die neue Periode entsprechend frueher; verschiebt
-- sie ihn nach hinten, gilt die alte Periode laenger.
DROP VIEW IF EXISTS "v_deputat_monat_tagesgenau";
--> statement-breakpoint
DROP VIEW IF EXISTS "v_deputat_pro_tag";
--> statement-breakpoint
CREATE VIEW "v_deputat_pro_tag" AS
WITH tage AS (
	SELECT generate_series(
		COALESCE((SELECT MIN(gueltig_von) FROM deputat_pro_periode), CURRENT_DATE),
		GREATEST(
			COALESCE((SELECT MAX(gueltig_bis) FROM deputat_pro_periode), CURRENT_DATE),
			COALESCE((SELECT MAX(make_date(jahr, 12, 31)) FROM haushaltsjahre), CURRENT_DATE)
		),
		INTERVAL '1 day'
	)::date AS tag
),
lehrer_aktiv AS (
	SELECT DISTINCT lehrer_id FROM deputat_pro_periode
),
dpp_effektiv AS (
	-- Periodenwerte mit ggf. korrigiertem Wirksamkeitsdatum.
	-- Eine Korrektur ist immer an die NEUE Periode geheftet (sy_neu/term_id_neu).
	SELECT
		dpp.lehrer_id,
		dpp.untis_schoolyear_id,
		dpp.untis_term_id,
		dpp.gueltig_von,
		dpp.gueltig_bis,
		dpp.deputat_gesamt,
		dpp.deputat_ges,
		dpp.deputat_gym,
		dpp.deputat_bk,
		COALESCE(k.tatsaechliches_datum, dpp.gueltig_von) AS effektiv_von,
		(k.tatsaechliches_datum IS NOT NULL)              AS hat_korrektur,
		k.tatsaechliches_datum                             AS korrektur_datum
	FROM deputat_pro_periode dpp
	LEFT JOIN deputat_aenderung_korrekturen k
		ON k.lehrer_id = dpp.lehrer_id
	   AND k.sy_neu = dpp.untis_schoolyear_id
	   AND k.term_id_neu = dpp.untis_term_id
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
	letzte.gueltig_von                                   AS untis_gueltig_von,
	letzte.gueltig_bis                                   AS untis_gueltig_bis,
	letzte.effektiv_von,
	letzte.hat_korrektur,
	letzte.korrektur_datum,
	(t.tag BETWEEN letzte.gueltig_von AND letzte.gueltig_bis) AS in_periode_untis
FROM tage t
CROSS JOIN lehrer_aktiv la
CROSS JOIN LATERAL (
	SELECT *
	FROM dpp_effektiv
	WHERE dpp_effektiv.lehrer_id = la.lehrer_id
	  AND dpp_effektiv.effektiv_von <= t.tag
	ORDER BY dpp_effektiv.effektiv_von DESC
	LIMIT 1
) letzte;
--> statement-breakpoint

-- ============================================================
-- 3. View v_deputat_monat_tagesgenau — unveraendert in Logik, neu in Quelle
-- ============================================================
CREATE VIEW "v_deputat_monat_tagesgenau" AS
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
	mode() WITHIN GROUP (ORDER BY vdt.untis_schoolyear_id) AS dominante_schoolyear_id,
	BOOL_OR(vdt.hat_korrektur)         AS enthaelt_korrektur
FROM v_deputat_pro_tag vdt
JOIN haushaltsjahre hj
  ON hj.jahr = EXTRACT(YEAR FROM vdt.tag)::int
GROUP BY vdt.lehrer_id, hj.id, EXTRACT(YEAR FROM vdt.tag), EXTRACT(MONTH FROM vdt.tag);
--> statement-breakpoint

-- ============================================================
-- 4. View v_deputat_aenderungen — neu mit Korrektur-Join
-- ============================================================
DROP VIEW IF EXISTS "v_deputat_aenderungen";
--> statement-breakpoint
CREATE VIEW "v_deputat_aenderungen" AS
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
	mf.lehrer_id,
	mf.sy_alt, mf.term_alt, mf.gueltig_von_alt, mf.gueltig_bis_alt,
	mf.sy_neu, mf.term_neu,
	mf.gueltig_von_neu                                  AS wirksam_ab,
	-- Korrigiertes Wirksamkeitsdatum (NULL falls keine Korrektur erfasst)
	k.tatsaechliches_datum                              AS tatsaechliches_datum,
	-- Effektives Wirksamkeitsdatum (das, was die tagesgenaue Berechnung verwendet)
	COALESCE(k.tatsaechliches_datum, mf.gueltig_von_neu) AS effektiv_wirksam_ab,
	(k.tatsaechliches_datum IS NOT NULL)                AS hat_korrektur,
	k.korrigiert_von, k.korrigiert_am, k.bemerkung,
	k.id                                                 AS korrektur_id,
	mf.gesamt_alt, mf.gesamt_neu,
	(mf.gesamt_neu - mf.gesamt_alt)                     AS delta_gesamt,
	mf.ges_alt, mf.ges_neu,
	mf.gym_alt, mf.gym_neu,
	mf.bk_alt, mf.bk_neu
FROM mit_folge mf
LEFT JOIN deputat_aenderung_korrekturen k
	ON  k.lehrer_id = mf.lehrer_id
	AND k.sy_alt = mf.sy_alt
	AND k.term_id_alt = mf.term_alt
	AND k.sy_neu = mf.sy_neu
	AND k.term_id_neu = mf.term_neu
WHERE mf.term_neu IS NOT NULL
  AND (
		mf.gesamt_alt <> mf.gesamt_neu
	OR  mf.ges_alt    <> mf.ges_neu
	OR  mf.gym_alt    <> mf.gym_neu
	OR  mf.bk_alt     <> mf.bk_neu
  );
--> statement-breakpoint

-- ============================================================
-- 5. Backfill aus alter deputat_aenderungen.tatsaechliches_datum
-- ============================================================
-- Fuer jeden Eintrag in deputat_aenderungen mit gesetztem tatsaechlichem Datum
-- wird ein Eintrag in deputat_aenderung_korrekturen angelegt — sofern eine
-- passende neue Periode in deputat_pro_periode existiert (wir brauchen das
-- school_year_id der neuen Periode, das die alte Tabelle nicht kannte).
--
-- Match: lehrer_id + term_id_neu + Periode-Monat == aenderungs-Monat.
-- Bei doppeldeutigen Treffern (extrem unwahrscheinlich) gewinnt der erste.
INSERT INTO deputat_aenderung_korrekturen (
	lehrer_id, sy_alt, term_id_alt, sy_neu, term_id_neu,
	tatsaechliches_datum, korrigiert_von, korrigiert_am, bemerkung
)
SELECT DISTINCT ON (da.lehrer_id, dpp_neu.untis_schoolyear_id, dpp_neu.untis_term_id)
	da.lehrer_id,
	dpp_alt.untis_schoolyear_id,
	da.term_id_alt,
	dpp_neu.untis_schoolyear_id,
	da.term_id_neu,
	da.tatsaechliches_datum,
	COALESCE(da.datum_korrigiert_von, 'backfill-0010'),
	COALESCE(da.datum_korrigiert_am, da.geaendert_am, now()),
	'Backfill aus deputat_aenderungen #' || da.id
FROM deputat_aenderungen da
JOIN deputat_pro_periode dpp_neu
	ON  dpp_neu.lehrer_id = da.lehrer_id
	AND dpp_neu.untis_term_id = da.term_id_neu
	AND EXTRACT(YEAR FROM dpp_neu.gueltig_von) = (
		SELECT hj.jahr FROM haushaltsjahre hj WHERE hj.id = da.haushaltsjahr_id
	)
JOIN deputat_pro_periode dpp_alt
	ON  dpp_alt.lehrer_id = da.lehrer_id
	AND dpp_alt.untis_term_id = da.term_id_alt
	AND dpp_alt.gueltig_bis < dpp_neu.gueltig_von
WHERE da.tatsaechliches_datum IS NOT NULL
  AND da.term_id_alt IS NOT NULL
  AND da.term_id_neu IS NOT NULL
ORDER BY da.lehrer_id, dpp_neu.untis_schoolyear_id, dpp_neu.untis_term_id, da.geaendert_am DESC
ON CONFLICT (lehrer_id, sy_neu, term_id_neu) DO NOTHING;
