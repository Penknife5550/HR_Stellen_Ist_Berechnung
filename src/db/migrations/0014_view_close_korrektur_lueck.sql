-- ============================================================
-- Migration 0014: Lueckenfreie taggenaue View bei Stichtag-Korrektur
-- ============================================================
-- Bisheriger Zustand (nach 0012): Wenn ein Sachbearbeiter den
-- Wirksamkeitsstichtag NACH HINTEN ueber den Untis-Montag verschiebt
-- (Beispiel: Untis-Mo = 19.05.2025, Korrektur = Mi 21.05.2025), liegt
-- in v_deputat_pro_tag eine LUECKE: Tag 19. und 20.05.2025 finden weder
-- in der alten noch in der neuen Periode einen Match
--   (alte Periode endet bei Untis-gueltig_bis = 18.05.2025,
--    neue Periode beginnt bei effektiv_von = 21.05.2025).
--
-- Folge: AVG in v_deputat_monat_tagesgenau ignoriert die Luecke,
-- der "Pauschal"-Wert ist zu niedrig — und Segment-basierte
-- Detail-Anzeige (lib/berechnungen/deputatEffektiv.ts) divergiert
-- vom DB-Pauschal-Wert.
--
-- Beispiel (10 -> 0 ab 21.05.2025):
--   Bisher (Luecke 2 Tage): AVG = (18*10 + 11*0) / 29 = 6.207
--   Korrekt:                 AVG = (20*10 + 11*0) / 31 = 6.452
--
-- Fix: Die alte Periode wird bis zum Tag VOR dem korrigierten Stichtag
-- der Folge-Periode verlaengert. Konservativ — nur wenn der Folger eine
-- Korrektur hat UND sein Korrektur-Datum nach gueltig_bis liegt
-- (= "nach hinten" verschoben). Echte Untis-Pausen (z.B. Beurlaubung)
-- werden NICHT geschlossen.
--
-- "Vorziehen" der Korrektur (Stichtag VOR Untis-Montag) bleibt unveraendert:
-- die Ueberlappung wird wie bisher per ORDER BY effektiv_von DESC im
-- LATERAL-Pick aufgeloest (T_neu gewinnt fuer die ueberlappenden Tage).
-- ============================================================

DROP VIEW IF EXISTS "v_deputat_monat_tagesgenau";
--> statement-breakpoint
DROP VIEW IF EXISTS "v_deputat_pro_tag";
--> statement-breakpoint

CREATE VIEW "v_deputat_pro_tag" AS
WITH tage AS (
	SELECT generate_series(
		COALESCE((SELECT MIN(gueltig_von) FROM deputat_pro_periode), CURRENT_DATE),
		COALESCE((SELECT MAX(gueltig_bis) FROM deputat_pro_periode), CURRENT_DATE),
		INTERVAL '1 day'
	)::date AS tag
),
lehrer_aktiv AS (
	SELECT DISTINCT lehrer_id FROM deputat_pro_periode
),
dpp_effektiv AS (
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
		-- Folge-Korrektur, deren Stichtag NACH gueltig_bis liegt, verlaengert
		-- die aktuelle Periode bis zum Tag vor der Korrektur. Sonst entstuende
		-- bei "nach hinten" verschobenen Stichtagen eine Luecke (siehe Header).
		-- Vorgezogene Korrekturen (Stichtag <= gueltig_bis) lassen effektiv_bis
		-- unveraendert; die resultierende Ueberlappung wird im LATERAL-Pick
		-- via ORDER BY effektiv_von DESC korrekt aufgeloest.
		CASE
			WHEN LEAD(k.tatsaechliches_datum) OVER w IS NOT NULL
			 AND LEAD(k.tatsaechliches_datum) OVER w > dpp.gueltig_bis
			THEN (LEAD(k.tatsaechliches_datum) OVER w - INTERVAL '1 day')::date
			ELSE dpp.gueltig_bis
		END                                                AS effektiv_bis,
		(k.tatsaechliches_datum IS NOT NULL)              AS hat_korrektur,
		k.tatsaechliches_datum                             AS korrektur_datum
	FROM deputat_pro_periode dpp
	LEFT JOIN deputat_aenderung_korrekturen k
		ON k.lehrer_id = dpp.lehrer_id
	   AND k.sy_neu = dpp.untis_schoolyear_id
	   AND k.term_id_neu = dpp.untis_term_id
	WINDOW w AS (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)
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
	letzte.effektiv_bis,
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
	  -- Periode wird auf der "Endseite" so weit wie noetig verlaengert,
	  -- damit eine Stichtag-Korrektur nach hinten keine Luecke laesst.
	  AND t.tag <= dpp_effektiv.effektiv_bis
	ORDER BY dpp_effektiv.effektiv_von DESC, dpp_effektiv.gueltig_von DESC
	LIMIT 1
) letzte;
--> statement-breakpoint

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
