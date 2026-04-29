-- ============================================================
-- Bergmann Benjamin (Personalnr. 600281) — HJ 2026
-- Aktueller Stand + Änderungshistorie, angereichert mit Untis-Terms.
--
-- Aufruf:
--   docker exec -i hr_stellen_ist_berechnung-db-1 \
--     psql -U stellenist -d stellenistberechnung \
--     -f /dev/stdin < docs/bergmann_check.sql
-- ============================================================

\set ECHO none
\pset border 2

-- Untis-Terms-Referenz (aus MSSQL Terms-Tabelle, eff_to = LEAD(DateFrom)-1)
-- Wird als TEMP-View bereitgestellt damit beide nachfolgenden SELECTs sie nutzen können.
DROP VIEW IF EXISTS bergmann_untis_terms;
CREATE TEMP VIEW bergmann_untis_terms AS
SELECT * FROM (VALUES
  (20252026,  1, 'Periode1',   DATE '2025-08-25', DATE '2025-09-14'),
  (20252026,  2, 'Periode2',   DATE '2025-09-15', DATE '2025-09-21'),
  (20252026,  3, 'Periode3',   DATE '2025-09-22', DATE '2025-10-05'),
  (20252026,  4, 'Periode4',   DATE '2025-10-06', DATE '2025-10-19'),
  (20252026,  5, 'Periode5',   DATE '2025-10-20', DATE '2025-11-02'),
  (20252026,  6, 'Periode6',   DATE '2025-11-03', DATE '2025-11-09'),
  (20252026,  7, 'Periode7',   DATE '2025-11-10', DATE '2025-11-16'),
  (20252026,  8, 'Periode8',   DATE '2025-11-17', DATE '2025-11-23'),
  (20252026,  9, 'Periode9',   DATE '2025-11-24', DATE '2026-01-04'),
  (20252026, 10, 'Periode10',  DATE '2026-01-05', DATE '2026-02-08'),
  (20252026, 11, 'Periode11',  DATE '2026-02-09', DATE '2026-03-01'),
  (20252026, 12, 'Periode12',  DATE '2026-03-02', DATE '2026-03-15'),
  (20252026, 13, 'Periode12b', DATE '2026-03-16', DATE '2026-04-12'),
  (20252026, 14, 'Periode13',  DATE '2026-04-13', DATE '2026-04-19'),
  (20252026, 15, 'Periode14',  DATE '2026-04-20', DATE '2026-04-26'),
  (20252026, 16, 'Periode14b', DATE '2026-04-27', DATE '2026-05-03'),
  (20252026, 17, 'Periode15',  DATE '2026-05-04', DATE '2026-05-24'),
  (20252026, 18, 'Periode16',  DATE '2026-05-25', DATE '2026-07-19')
) AS t(school_year_id, term_id, term_name, eff_date_from, eff_date_to);

-- ============================================================
-- 1) AKTUELLER STAND pro Monat in HJ 2026
-- ============================================================
\echo
\echo === 1) Aktueller Monatsstand (deputat_monatlich) ===
\echo
WITH bergmann AS (
  SELECT id AS lehrer_id FROM lehrer WHERE vollname = 'Bergmann Benjamin' AND stammschule_code = 'GYM'
),
monat_grenzen AS (
  SELECT
    dm.id,
    make_date(2026, dm.monat, 1)                                                    AS m_first,
    (make_date(2026, dm.monat, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date    AS m_last
  FROM deputat_monatlich dm
  JOIN haushaltsjahre hj ON hj.id = dm.haushaltsjahr_id AND hj.jahr = 2026
  WHERE dm.lehrer_id = (SELECT lehrer_id FROM bergmann)
)
SELECT
  to_char(make_date(2026, dm.monat, 1), 'Mon')      AS monat,
  dm.monat                                          AS m,
  dm.deputat_gesamt                                 AS dep_ges,
  dm.deputat_gym                                    AS dep_gym,
  dm.untis_term_id                                  AS term,
  ut.term_name                                      AS term_name,
  ut.eff_date_from                                  AS term_von,
  ut.eff_date_to                                    AS term_bis,
  -- Coverage-Tage des Terms im Monat
  GREATEST(0,
    LEAST(ut.eff_date_to, mg.m_last)
    - GREATEST(ut.eff_date_from, mg.m_first)
    + 1
  )                                                 AS tage_abgedeckt,
  EXTRACT(DAY FROM mg.m_last)::int                  AS tage_monat,
  to_char(dm.sync_datum, 'DD.MM.YYYY HH24:MI')      AS sync_datum
FROM deputat_monatlich dm
JOIN haushaltsjahre hj ON hj.id = dm.haushaltsjahr_id AND hj.jahr = 2026
JOIN monat_grenzen mg ON mg.id = dm.id
LEFT JOIN bergmann_untis_terms ut
  ON ut.term_id = dm.untis_term_id
 AND ut.school_year_id = dm.untis_schoolyear_id
WHERE dm.lehrer_id = (SELECT lehrer_id FROM bergmann)
ORDER BY dm.monat;

-- ============================================================
-- 2) ÄNDERUNGSHISTORIE in HJ 2026 (chronologisch neu→alt)
-- ============================================================
\echo
\echo === 2) Aenderungshistorie (deputat_aenderungen) ===
\echo
WITH bergmann AS (
  SELECT id AS lehrer_id FROM lehrer WHERE vollname = 'Bergmann Benjamin' AND stammschule_code = 'GYM'
)
SELECT
  to_char(da.geaendert_am, 'DD.MM HH24:MI')                       AS sync,
  to_char(da.tatsaechliches_datum, 'DD.MM.YYYY')                  AS tats_datum,
  da.datum_korrigiert_von                                         AS quelle,
  to_char(make_date(2026, da.monat, 1), 'Mon')                    AS monat,
  da.aenderungstyp                                                AS typ,
  da.ist_gehaltsrelevant                                          AS gehalt,
  da.deputat_gesamt_alt || ' → ' || da.deputat_gesamt_neu         AS gesamt,
  da.term_id_alt || ' → ' || da.term_id_neu                       AS term_id,
  ta.term_name || ' (' || ta.eff_date_from || '..' || ta.eff_date_to || ')' AS term_alt,
  tn.term_name || ' (' || tn.eff_date_from || '..' || tn.eff_date_to || ')' AS term_neu,
  -- Wieviele Tage des Monats deckt term_alt vs term_neu wirklich ab?
  GREATEST(0,
    LEAST(ta.eff_date_to, (make_date(2026, da.monat, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date)
    - GREATEST(ta.eff_date_from, make_date(2026, da.monat, 1))
    + 1
  )                                                               AS tage_alt,
  GREATEST(0,
    LEAST(tn.eff_date_to, (make_date(2026, da.monat, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date)
    - GREATEST(tn.eff_date_from, make_date(2026, da.monat, 1))
    + 1
  )                                                               AS tage_neu
FROM deputat_aenderungen da
JOIN haushaltsjahre hj ON hj.id = da.haushaltsjahr_id AND hj.jahr = 2026
LEFT JOIN bergmann_untis_terms ta ON ta.term_id = da.term_id_alt AND ta.school_year_id = 20252026
LEFT JOIN bergmann_untis_terms tn ON tn.term_id = da.term_id_neu AND tn.school_year_id = 20252026
WHERE da.lehrer_id = (SELECT lehrer_id FROM bergmann)
ORDER BY da.geaendert_am DESC, da.monat;
