-- ============================================================
-- Migration 0012: Forward-Fill-Puffer komplett entfernen
-- ============================================================
-- Migration 0011 hatte 60 Tage Puffer ueber das letzte gueltig_bis
-- hinaus eingebaut (Sommerferien-Bridge). Das hat sich als falsch
-- erwiesen: zwischen zwei Schuljahren sollte GAR NICHT extrapoliert
-- werden — der naechste SY-Sync bringt die Werte korrekt.
--
-- Folge: Daten im View enden exakt mit der letzten bekannten
-- gueltig_bis-Periode. Wenn der naechste SY synct ist, fuellt sich
-- der Bereich automatisch (LATERAL waehlt dann die neue Periode).
-- ============================================================

DROP VIEW IF EXISTS "v_deputat_aenderungen";
--> statement-breakpoint
DROP VIEW IF EXISTS "v_deputat_monat_tagesgenau";
--> statement-breakpoint
DROP VIEW IF EXISTS "v_deputat_pro_tag";
--> statement-breakpoint

CREATE VIEW "v_deputat_pro_tag" AS
WITH tage AS (
	SELECT generate_series(
		COALESCE((SELECT MIN(gueltig_von) FROM deputat_pro_periode), CURRENT_DATE),
		-- KEIN Puffer mehr: Daten enden exakt mit der letzten
		-- bekannten Untis-Periode.
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
	  -- KEIN Puffer: Periode wird nur fortgeschrieben solange wir
	  -- innerhalb der bekannten Periode sind.
	  AND t.tag <= dpp_effektiv.gueltig_bis
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
--> statement-breakpoint

CREATE VIEW "v_deputat_aenderungen" AS
WITH mit_folge AS (
	SELECT
		dpp.lehrer_id,
		dpp.untis_schoolyear_id AS sy_alt,
		dpp.untis_term_id       AS term_alt,
		dpp.gueltig_bis         AS gueltig_bis_alt,
		dpp.deputat_gesamt      AS gesamt_alt,
		dpp.deputat_ges         AS ges_alt,
		dpp.deputat_gym         AS gym_alt,
		dpp.deputat_bk          AS bk_alt,
		LEAD(dpp.untis_schoolyear_id)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS sy_neu,
		LEAD(dpp.untis_term_id)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS term_neu,
		LEAD(dpp.gueltig_von)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS wirksam_ab,
		LEAD(dpp.deputat_gesamt)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS gesamt_neu,
		LEAD(dpp.deputat_ges)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS ges_neu,
		LEAD(dpp.deputat_gym)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS gym_neu,
		LEAD(dpp.deputat_bk)
		  OVER (PARTITION BY dpp.lehrer_id ORDER BY dpp.gueltig_von)        AS bk_neu
	FROM deputat_pro_periode dpp
)
SELECT
	mf.lehrer_id,
	mf.sy_alt, mf.term_alt,
	mf.sy_neu, mf.term_neu,
	mf.wirksam_ab,
	mf.gueltig_bis_alt,
	k.id                                                 AS korrektur_id,
	k.tatsaechliches_datum,
	COALESCE(k.tatsaechliches_datum, mf.wirksam_ab)      AS effektiv_wirksam_ab,
	(k.tatsaechliches_datum IS NOT NULL)                 AS hat_korrektur,
	k.korrigiert_von,
	k.korrigiert_am,
	k.bemerkung,
	mf.gesamt_alt, mf.ges_alt, mf.gym_alt, mf.bk_alt,
	mf.gesamt_neu, mf.ges_neu, mf.gym_neu, mf.bk_neu,
	(mf.gesamt_neu - mf.gesamt_alt)                      AS delta_gesamt
FROM mit_folge mf
LEFT JOIN deputat_aenderung_korrekturen k
	ON k.lehrer_id = mf.lehrer_id
   AND k.sy_neu = mf.sy_neu
   AND k.term_id_neu = mf.term_neu
WHERE mf.term_neu IS NOT NULL;
