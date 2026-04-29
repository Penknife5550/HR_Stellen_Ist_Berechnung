-- ============================================================
-- Untis-MSSQL: David Abrams — alle Perioden, die HJ 2025 abdecken
-- (Schuljahre 2024/25 + 2025/26)
-- ============================================================

-- 1) Alle Teacher-Zeilen fuer "Abrams" — sortiert nach Periode
SELECT
    t.TEACHER_ID,
    t.SCHOOLYEAR_ID,
    t.TERM_ID,
    tr.Name              AS Term_Name,
    tr.DateFrom,
    tr.DateTo,
    t.Longname,
    t.FirstName,
    t.PNumber            AS Personalnummer,
    t.OwnSchool          AS Stammschule,
    t.PlannedWeek        AS PlannedWeek_Raw,
    ISNULL(TRY_CAST(t.PlannedWeek AS DECIMAL(10,2)), 0) / 1000.0 AS Deputat_h_Woche,
    t.StatisticCodes,
    t.Deleted
FROM Teacher t
INNER JOIN Terms tr
    ON t.SCHOOLYEAR_ID = tr.SCHOOLYEAR_ID
   AND t.TERM_ID       = tr.TERM_ID
WHERE t.Longname LIKE '%Abrams%'
ORDER BY
    t.SCHOOLYEAR_ID,
    tr.DateFrom;

-- 2) Nur Perioden, die irgendwo in 2025 liegen
SELECT
    t.TEACHER_ID,
    t.SCHOOLYEAR_ID,
    t.TERM_ID,
    tr.Name              AS Term_Name,
    tr.DateFrom,
    tr.DateTo,
    CONCAT(t.Longname, ' ', t.FirstName) AS Vollname,
    ISNULL(TRY_CAST(t.PlannedWeek AS DECIMAL(10,2)), 0) / 1000.0 AS Deputat_h_Woche,
    t.Deleted
FROM Teacher t
INNER JOIN Terms tr
    ON t.SCHOOLYEAR_ID = tr.SCHOOLYEAR_ID
   AND t.TERM_ID       = tr.TERM_ID
WHERE t.Longname LIKE '%Abrams%'
  AND tr.Deleted = 0
  AND tr.DateFrom <= '2025-12-31'
  AND tr.DateTo   >= '2025-01-01'
ORDER BY tr.DateFrom;

-- 3) Erwartet:
--    Periode bis 25.04.2025  -> 25.5
--    Periode 26.04.-25.05.   -> 0.0
--    Periode ab 26.05.2025   -> 25.5
--
--    Wenn Untis statt 26.04./26.05. einen Montag erzwingt
--    (z.B. 28.04.2025 / 26.05.2025 ist ein Montag), kann das
--    DateFrom leicht abweichen — das ist fuer den Sync der
--    "Tatsaechliches Datum"-Korrekturpunkt.
