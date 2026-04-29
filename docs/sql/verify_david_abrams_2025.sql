-- ============================================================
-- Diagnose: David Abrams — HJ 2025
-- Erwartet:
--   bis 25.04.2025: 25.5 h/Woche
--   26.04.2025 - 25.05.2025: 0 h/Woche
--   ab 26.05.2025: 25.5 h/Woche
-- ============================================================

-- 1) Stammdaten: welche David-Abrams-Einträge gibt es?
SELECT
  l.id,
  l.untis_teacher_id,
  l.personalnummer,
  l.vollname,
  l.vorname,
  l.nachname,
  l.stammschule_code,
  l.statistik_code,
  l.quelle,
  l.aktiv
FROM lehrer l
WHERE l.vollname ILIKE '%abrams%'
   OR (l.vorname ILIKE '%david%' AND l.nachname ILIKE '%abrams%');

-- 2) Haushaltsjahr 2025 — ID merken
SELECT id, jahr, gesperrt FROM haushaltsjahre WHERE jahr = 2025;

-- 3) Monatliche Deputate 2025 — was steht aktuell drin?
SELECT
  dm.monat,
  dm.deputat_gesamt,
  dm.deputat_ges,
  dm.deputat_gym,
  dm.deputat_bk,
  dm.quelle,
  dm.untis_schoolyear_id,
  dm.untis_term_id,
  dm.untis_term_date_from,
  dm.untis_term_date_to,
  dm.sync_datum
FROM deputat_monatlich dm
JOIN lehrer l ON l.id = dm.lehrer_id
JOIN haushaltsjahre hj ON hj.id = dm.haushaltsjahr_id
WHERE l.vollname ILIKE '%abrams%'
  AND hj.jahr = 2025
ORDER BY dm.monat;

-- 4) Änderungs-Historie 2025 — wann wurde was umgestellt?
SELECT
  da.monat,
  da.deputat_gesamt_alt,
  da.deputat_gesamt_neu,
  da.aenderungstyp,
  da.ist_gehaltsrelevant,
  da.term_id_alt,
  da.term_id_neu,
  da.geaendert_am,
  da.tatsaechliches_datum,
  da.nachtrag_status
FROM deputat_aenderungen da
JOIN lehrer l ON l.id = da.lehrer_id
JOIN haushaltsjahre hj ON hj.id = da.haushaltsjahr_id
WHERE l.vollname ILIKE '%abrams%'
  AND hj.jahr = 2025
ORDER BY da.monat, da.geaendert_am;

-- 5) Soll-Werte taggenau gerechnet (zur Gegenkontrolle):
--    April 2025 (30 Tage): 25/30 * 25.5 + 5/30 * 0   = 21.250
--    Mai   2025 (31 Tage): 25/31 *  0   + 6/31 * 25.5 =  4.935
--    Jan-Mär, Jun-Dez: 25.5
SELECT
  m.monat,
  CASE m.monat
    WHEN 4 THEN ROUND(25.0/30.0 * 25.5 + 5.0/30.0 * 0.0, 3)
    WHEN 5 THEN ROUND(25.0/31.0 * 0.0  + 6.0/31.0 * 25.5, 3)
    ELSE 25.500
  END AS erwartet_deputat_gesamt
FROM (SELECT generate_series(1,12) AS monat) m
ORDER BY m.monat;
