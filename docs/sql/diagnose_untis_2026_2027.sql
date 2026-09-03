-- ============================================================================
-- DIAGNOSE: Schuljahreswechsel 2026/27 in Untis (read-only)
-- ============================================================================
-- Wo ausfuehren: n8n -> Microsoft SQL Node (Credential "Untis") -> Execute Query.
-- Alle Abfragen sind reine SELECTs. Bitte die Ergebnisse als JSON exportieren.
--
-- Hintergrund (03.09.2026): Der Sync #223 v0.7 verwirft alle Teacher-Zeilen
-- eines Schuljahres, fuer das Untis (noch) keine Perioden in `Terms` hat
-- (INNER JOIN). Diese Abfragen belegen den aktuellen Zustand und pruefen die
-- Annahmen der v0.8-Query (Spalte SCHOOL_ID, TERM_ID im periodenlosen Zustand).
-- ============================================================================

-- D1  Spalten-Existenz (Erwartung: SCHOOL_ID auf Teacher UND Terms; DateFrom/
--     DateTo/SCHOOLYEAR_ID als int)
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM   INFORMATION_SCHEMA.COLUMNS
WHERE  TABLE_NAME IN ('Teacher', 'Terms')
  AND  COLUMN_NAME IN ('SCHOOL_ID', 'SCHOOLYEAR_ID', 'TERM_ID', 'DateFrom', 'DateTo', 'Deleted')
ORDER  BY TABLE_NAME, COLUMN_NAME;

-- D2  Teacher-Zeilen je Schuljahr/Periode im Hauptmandant (Erwartung fuer
--     20262027: genau EINE TERM_ID — vermutlich 0 — mit ~99 Lehrern)
SELECT SCHOOL_ID, SCHOOLYEAR_ID, TERM_ID, Deleted, COUNT(*) AS zeilen
FROM   Teacher
WHERE  SCHOOLYEAR_ID >= 20252026
GROUP  BY SCHOOL_ID, SCHOOLYEAR_ID, TERM_ID, Deleted
ORDER  BY SCHOOL_ID, SCHOOLYEAR_ID, TERM_ID, Deleted;

-- D3  Terms je Schuljahr/Mandant (Erwartung heute: keine Zeile fuer 20262027;
--     sobald Untis Perioden anlegt, erscheinen sie hier)
SELECT SCHOOL_ID, SCHOOLYEAR_ID, TERM_ID, Name, DateFrom, DateTo, Deleted
FROM   Terms
WHERE  SCHOOLYEAR_ID >= 20252026
ORDER  BY SCHOOL_ID, SCHOOLYEAR_ID, DateFrom, TERM_ID;

-- D4  Schuljahres-Stammdaten (falls Tabelle SchoolYear existiert): tatsaechlicher
--     Untis-Schuljahresbeginn 2026/27 (entscheidet, ob August nach Anlage
--     echter Perioden abgedeckt bleibt — siehe docs/deployment/v0.8.1_schuljahreswechsel.md)
SELECT *
FROM   SchoolYear
WHERE  SCHOOLYEAR_ID >= 20252026
ORDER  BY SCHOOL_ID, SCHOOLYEAR_ID;

-- D1b Preflight: beide Werte muessen NOT NULL sein, sonst fehlt die Spalte
--     SCHOOL_ID und die v0.8-Query bricht mit "Invalid column name" ab.
SELECT COL_LENGTH('dbo.Terms',   'SCHOOL_ID') AS terms_school_id,
       COL_LENGTH('dbo.Teacher', 'SCHOOL_ID') AS teacher_school_id,
       COL_LENGTH('dbo.Terms',   'DateFrom')  AS terms_datefrom;

-- D2b NULL-Check TERM_ID im periodenlosen Zustand (Erwartung n_null = 0)
SELECT SCHOOL_ID, SCHOOLYEAR_ID, TERM_ID, COUNT(*) AS n,
       SUM(CASE WHEN TERM_ID IS NULL THEN 1 ELSE 0 END) AS n_null
FROM   Teacher
WHERE  Deleted = 0 AND SCHOOLYEAR_ID = 20262027
GROUP  BY SCHOOL_ID, SCHOOLYEAR_ID, TERM_ID;

-- D6  Identitaetsnachweis 2025/26 (VOR dem Umschalten): alte v0.7-Query und
--     neue v0.8-Query (docs/sql/untis_sync_v08_query.sql, ohne SCHOOL_ID/IsPseudo,
--     ohne ORDER BY) je als CTE laden und beidseitig EXCEPT fahren:
--       WITH Alt AS (<v0.7-SELECT>), Neu AS (<v0.8-SELECT>)
--       SELECT 'nur_alt' AS q, * FROM (SELECT * FROM Alt EXCEPT SELECT * FROM Neu) d
--       UNION ALL
--       SELECT 'nur_neu', * FROM (SELECT * FROM Neu WHERE SCHOOLYEAR_ID = 20252026
--                                 EXCEPT SELECT * FROM Alt) d2;
--     Erwartung: 0 Zeilen.

-- D5  Kontrolle nach Import von #223 v0.8: die neue Query muss fuer 20252026
--     weiterhin 22 Perioden x 89 Lehrer liefern und fuer 20262027 genau eine
--     Periode TERM_ID 999 ("Schuljahr ohne Perioden", 01.08.2026-31.07.2027).
--     -> Node-Output exportieren und nach SCHOOLYEAR_ID/TERM_ID gruppieren.
