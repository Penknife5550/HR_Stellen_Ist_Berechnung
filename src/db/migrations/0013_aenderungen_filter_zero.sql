-- ============================================================
-- Migration 0013: v_deputat_aenderungen filtert Null-Wechsel
-- ============================================================
-- Bisher hat die View fuer JEDEN Periodenuebergang eine Zeile geliefert,
-- auch wenn alle vier Werte (gesamt, ges, gym, bk) unveraendert geblieben
-- sind. Folge in der UI: Lehrer mit gleichbleibendem Deputat zeigte 17
-- "Wechsel" mit Delta 0,00 und Badge "VERT." — irritierend und sachlich
-- falsch (kein echter Wechsel).
--
-- Fix: WHERE-Klausel ergaenzen — mindestens einer der vier Werte muss
-- sich um mehr als 0,001 unterscheiden, sonst keine Zeile.
-- ============================================================

DROP VIEW IF EXISTS "v_deputat_aenderungen";
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
WHERE mf.term_neu IS NOT NULL
  -- Nur ECHTE Wertwechsel: mindestens einer der vier Werte muss
  -- sich um > 0,001 unterscheiden. Ohne diesen Filter erscheinen
  -- gleichbleibende Periodenuebergaenge als Pseudo-"Wechsel".
  AND (
    ABS(mf.gesamt_neu - mf.gesamt_alt) > 0.001
    OR ABS(mf.ges_neu - mf.ges_alt) > 0.001
    OR ABS(mf.gym_neu - mf.gym_alt) > 0.001
    OR ABS(mf.bk_neu - mf.bk_alt) > 0.001
  );
