-- ============================================================
-- Backfill der Aenderungshistorie fuer HJ 2025 + HJ 2026
-- ============================================================
-- Rekonstruiert deputat_aenderungen-Eintraege aus den vorhandenen
-- deputat_monatlich-Daten, indem aufeinanderfolgende Monate
-- pro Lehrer verglichen werden.
--
-- WICHTIG:
--   - Nur ausfuehren GEGEN POSTGRES (Stellenist-DB), NICHT MSSQL
--   - Idempotent: Pro (lehrer, hj, monat) wird nur eingefuegt,
--     wenn NICHT bereits ein Eintrag existiert
--   - Schritt 1 (Preview) liest nur — gefahrlos
--   - Schritt 2 (Insert) schreibt — in Transaktion mit Zaehler
-- ============================================================


-- ===========================================================
-- SCHRITT 1: PREVIEW — was wuerde eingefuegt werden?
-- ===========================================================
WITH monthly AS (
  SELECT
    dm.lehrer_id,
    dm.haushaltsjahr_id,
    hj.jahr,
    dm.monat,
    dm.deputat_gesamt,
    dm.deputat_ges,
    dm.deputat_gym,
    dm.deputat_bk,
    dm.untis_term_id,
    dm.untis_term_date_from,
    LAG(dm.deputat_gesamt)   OVER w AS prev_gesamt,
    LAG(dm.deputat_ges)      OVER w AS prev_ges,
    LAG(dm.deputat_gym)      OVER w AS prev_gym,
    LAG(dm.deputat_bk)       OVER w AS prev_bk,
    LAG(dm.untis_term_id)    OVER w AS prev_term_id,
    LAG(hj.jahr)             OVER w AS prev_jahr,
    LAG(dm.monat)            OVER w AS prev_monat
  FROM deputat_monatlich dm
  JOIN haushaltsjahre hj ON hj.id = dm.haushaltsjahr_id
  WINDOW w AS (PARTITION BY dm.lehrer_id ORDER BY hj.jahr, dm.monat)
),
changes AS (
  SELECT
    m.*,
    -- Direkt aufeinanderfolgender Monat?
    CASE
      WHEN m.jahr = m.prev_jahr     AND m.monat = m.prev_monat + 1 THEN TRUE
      WHEN m.jahr = m.prev_jahr + 1 AND m.monat = 1 AND m.prev_monat = 12 THEN TRUE
      ELSE FALSE
    END AS ist_folgemonat,
    ABS(COALESCE(m.deputat_gesamt,0) - COALESCE(m.prev_gesamt,0)) > 0.001 AS gesamt_geaendert,
    (
      ABS(COALESCE(m.deputat_ges,0) - COALESCE(m.prev_ges,0)) > 0.001 OR
      ABS(COALESCE(m.deputat_gym,0) - COALESCE(m.prev_gym,0)) > 0.001 OR
      ABS(COALESCE(m.deputat_bk,0)  - COALESCE(m.prev_bk,0))  > 0.001
    ) AS verteilung_geaendert
  FROM monthly m
  WHERE m.jahr IN (2025, 2026)
    AND m.prev_gesamt IS NOT NULL
)
SELECT
  l.vollname,
  c.jahr,
  c.monat,
  c.prev_gesamt AS gesamt_alt,
  c.deputat_gesamt AS gesamt_neu,
  c.prev_ges AS ges_alt, c.deputat_ges AS ges_neu,
  c.prev_gym AS gym_alt, c.deputat_gym AS gym_neu,
  c.prev_bk  AS bk_alt,  c.deputat_bk  AS bk_neu,
  c.prev_term_id AS term_alt,
  c.untis_term_id AS term_neu,
  c.untis_term_date_from AS untis_datum,
  GREATEST(c.untis_term_date_from, make_date(c.jahr, c.monat, 1)) AS tatsaechliches_datum,
  c.gesamt_geaendert,
  c.verteilung_geaendert,
  CASE WHEN c.gesamt_geaendert THEN 'deputat_aenderung' ELSE 'verteilung_aenderung' END AS aenderungstyp,
  -- Schon vorhanden?
  EXISTS (
    SELECT 1 FROM deputat_aenderungen da
    WHERE da.lehrer_id = c.lehrer_id
      AND da.haushaltsjahr_id = c.haushaltsjahr_id
      AND da.monat = c.monat
  ) AS bereits_vorhanden
FROM changes c
JOIN lehrer l ON l.id = c.lehrer_id
WHERE c.ist_folgemonat
  AND (c.gesamt_geaendert OR c.verteilung_geaendert)
ORDER BY l.vollname, c.jahr, c.monat;


-- ===========================================================
-- SCHRITT 2: INSERT — Historie schreiben (in Transaktion)
-- ===========================================================
-- Vor dem Ausfuehren: Preview oben anschauen!
-- Bei Bedarf: BEGIN; ... ROLLBACK; um zu testen.
-- ===========================================================

BEGIN;

WITH monthly AS (
  SELECT
    dm.lehrer_id,
    dm.haushaltsjahr_id,
    hj.jahr,
    dm.monat,
    dm.deputat_gesamt,
    dm.deputat_ges,
    dm.deputat_gym,
    dm.deputat_bk,
    dm.untis_term_id,
    dm.untis_term_date_from,
    LAG(dm.deputat_gesamt)   OVER w AS prev_gesamt,
    LAG(dm.deputat_ges)      OVER w AS prev_ges,
    LAG(dm.deputat_gym)      OVER w AS prev_gym,
    LAG(dm.deputat_bk)       OVER w AS prev_bk,
    LAG(dm.untis_term_id)    OVER w AS prev_term_id,
    LAG(hj.jahr)             OVER w AS prev_jahr,
    LAG(dm.monat)            OVER w AS prev_monat
  FROM deputat_monatlich dm
  JOIN haushaltsjahre hj ON hj.id = dm.haushaltsjahr_id
  WINDOW w AS (PARTITION BY dm.lehrer_id ORDER BY hj.jahr, dm.monat)
),
changes AS (
  SELECT
    m.*,
    CASE
      WHEN m.jahr = m.prev_jahr     AND m.monat = m.prev_monat + 1 THEN TRUE
      WHEN m.jahr = m.prev_jahr + 1 AND m.monat = 1 AND m.prev_monat = 12 THEN TRUE
      ELSE FALSE
    END AS ist_folgemonat,
    ABS(COALESCE(m.deputat_gesamt,0) - COALESCE(m.prev_gesamt,0)) > 0.001 AS gesamt_geaendert,
    (
      ABS(COALESCE(m.deputat_ges,0) - COALESCE(m.prev_ges,0)) > 0.001 OR
      ABS(COALESCE(m.deputat_gym,0) - COALESCE(m.prev_gym,0)) > 0.001 OR
      ABS(COALESCE(m.deputat_bk,0)  - COALESCE(m.prev_bk,0))  > 0.001
    ) AS verteilung_geaendert
  FROM monthly m
  WHERE m.jahr IN (2025, 2026)
    AND m.prev_gesamt IS NOT NULL
)
INSERT INTO deputat_aenderungen (
  lehrer_id, haushaltsjahr_id, monat,
  deputat_gesamt_alt, deputat_ges_alt, deputat_gym_alt, deputat_bk_alt,
  deputat_gesamt_neu, deputat_ges_neu, deputat_gym_neu, deputat_bk_neu,
  aenderungstyp, ist_gehaltsrelevant,
  term_id_alt, term_id_neu,
  geaendert_am,
  tatsaechliches_datum,
  datum_korrigiert_von, datum_korrigiert_am
)
SELECT
  c.lehrer_id, c.haushaltsjahr_id, c.monat,
  c.prev_gesamt::text::numeric, c.prev_ges, c.prev_gym, c.prev_bk,
  c.deputat_gesamt, c.deputat_ges, c.deputat_gym, c.deputat_bk,
  CASE WHEN c.gesamt_geaendert THEN 'deputat_aenderung' ELSE 'verteilung_aenderung' END,
  c.gesamt_geaendert,
  c.prev_term_id, c.untis_term_id,
  NOW(),
  GREATEST(c.untis_term_date_from, make_date(c.jahr, c.monat, 1)),
  'backfill-history-2025-2026',
  NOW()
FROM changes c
WHERE c.ist_folgemonat
  AND (c.gesamt_geaendert OR c.verteilung_geaendert)
  AND NOT EXISTS (
    SELECT 1 FROM deputat_aenderungen da
    WHERE da.lehrer_id = c.lehrer_id
      AND da.haushaltsjahr_id = c.haushaltsjahr_id
      AND da.monat = c.monat
  );

-- Anzahl eingefuegter Zeilen pruefen:
SELECT
  COUNT(*) AS eingefuegt_total,
  COUNT(*) FILTER (WHERE ist_gehaltsrelevant) AS gehaltsrelevant,
  COUNT(*) FILTER (WHERE NOT ist_gehaltsrelevant) AS nur_verteilung
FROM deputat_aenderungen
WHERE datum_korrigiert_von = 'backfill-history-2025-2026'
  AND datum_korrigiert_am > NOW() - INTERVAL '5 minutes';

-- Wenn alles passt:
COMMIT;

-- Falls etwas nicht stimmt:
-- ROLLBACK;


-- ===========================================================
-- ROLLBACK-OPTION: alle Backfill-Eintraege wieder loeschen
-- ===========================================================
-- BEGIN;
-- DELETE FROM deputat_aenderungen
-- WHERE datum_korrigiert_von = 'backfill-history-2025-2026';
-- COMMIT;
