-- ========================================================================
-- v0.8 Periodenmodell — ALLE Perioden + Lehrer-Werte beider Schuljahre
--   + Pseudo-Periode fuer Schuljahre, die in Untis noch keine Perioden haben
--
-- Zwei Schuljahre (Haushaltsjahr-komplett):
--   Aug-Dez = neues Schuljahr, Jan-Jul = altes Schuljahr.
--
-- NEU v0.8 (03.09.2026):
--   1) Nur Hauptmandant SCHOOL_ID = 1 (FES GES/GYM/BK). Seit 2026/27 gibt es
--      eigene Untis-Mandanten fuer die Grundschulen (SCHOOL_ID 2/3/4) mit
--      kollidierenden TEACHER_IDs und eigenen Terms.
--   2) Schuljahr OHNE Eintraege in Terms (typisch: Schuljahresbeginn, Perioden
--      werden erst spaeter angelegt) -> synthetische Periode TERM_ID 999 ueber
--      das gesetzliche Schuljahr (01.08.-31.07., § 7 SchulG NRW). Vorher hat
--      der INNER JOIN auf Terms das komplette neue Schuljahr verworfen
--      (Aug-Dez leer in der App).
--   3) LEAD-Reihenfolge nach DateFrom statt TERM_ID (robust gegen nachtraeglich
--      eingefuegte Perioden mit hoeherer ID); Schutz gegen identische DateFrom.
--   4) SCHOOL_ID wird mit ausgegeben (Vorbereitung Grundschul-Sync; der
--      Code-Node ignoriert unbekannte Spalten).
--
-- Hinweise:
--   - Pseudo-DateTo 31.07. ist INKLUSIV (echte letzte Periode: Untis-DateTo - 1).
--   - Die App (sync-v2 / untis-terms/sync) loescht die Pseudo-Periode 999
--     automatisch, sobald echte Perioden desselben Schuljahres eintreffen,
--     und haengt Korrekturen/Nachtraege auf die erste echte Periode um.
--   - Pseudo-Periode nur fuer das neueste Schuljahr (Vorjahr hat Perioden).
--
-- Rechtsgrundlage: § 3 Abs. 1 FESchVO
-- ========================================================================

WITH RelevanteSJ AS (
    SELECT DISTINCT SCHOOLYEAR_ID
    FROM Teacher
    WHERE Deleted = 0
      AND SCHOOL_ID = 1
      AND SCHOOLYEAR_ID IN (
          (SELECT MAX(SCHOOLYEAR_ID) FROM Teacher WHERE Deleted = 0 AND SCHOOL_ID = 1),
          (SELECT MAX(SCHOOLYEAR_ID) - 10001 FROM Teacher WHERE Deleted = 0 AND SCHOOL_ID = 1)
      )
),
EchtePerioden AS (
    SELECT
        tr.SCHOOLYEAR_ID,
        tr.TERM_ID,
        tr.DateFrom,
        tr.DateTo,
        tr.Name AS Term_Name,
        LEAD(tr.DateFrom) OVER (
            PARTITION BY tr.SCHOOLYEAR_ID
            ORDER BY tr.DateFrom, tr.TERM_ID
        ) AS NextDateFrom,
        0 AS IsPseudo
    FROM Terms tr
    INNER JOIN RelevanteSJ rsj ON tr.SCHOOLYEAR_ID = rsj.SCHOOLYEAR_ID
    WHERE tr.Deleted = 0
      AND tr.SCHOOL_ID = 1
),
PseudoPerioden AS (
    SELECT
        rsj.SCHOOLYEAR_ID,
        999                                            AS TERM_ID,
        (rsj.SCHOOLYEAR_ID / 10000) * 10000 + 801      AS DateFrom,   -- JJJJ0801
        (rsj.SCHOOLYEAR_ID % 10000) * 10000 + 731      AS DateTo,     -- JJJJ0731
        'Schuljahr ohne Perioden'                      AS Term_Name,
        CAST(NULL AS INT)                              AS NextDateFrom,
        1                                              AS IsPseudo
    FROM RelevanteSJ rsj
    -- Nur fuer das NEUESTE Schuljahr: das Vorjahr hat immer Perioden; ein
    -- transienter Terms-Ausfall darf historische Monate nicht ueberschreiben.
    WHERE rsj.SCHOOLYEAR_ID = (SELECT MAX(SCHOOLYEAR_ID) FROM RelevanteSJ)
    -- Pseudo-Periode, wenn KEIN Lehrer des Schuljahres auf eine echte Periode
    -- matcht: deckt "Terms leer" UND den Uebergangszustand "Terms angelegt,
    -- Teacher.TERM_ID (noch) nicht passend" ab.
      AND NOT EXISTS (
        SELECT 1
        FROM EchtePerioden ep
        INNER JOIN Teacher tx
            ON tx.SCHOOLYEAR_ID = ep.SCHOOLYEAR_ID
           AND tx.TERM_ID = ep.TERM_ID
           AND tx.SCHOOL_ID = 1
           AND tx.Deleted = 0
        WHERE ep.SCHOOLYEAR_ID = rsj.SCHOOLYEAR_ID
    )
),
AllePerioden AS (
    SELECT SCHOOLYEAR_ID, TERM_ID, DateFrom, DateTo, Term_Name, NextDateFrom, IsPseudo FROM EchtePerioden
    UNION ALL
    SELECT SCHOOLYEAR_ID, TERM_ID, DateFrom, DateTo, Term_Name, NextDateFrom, IsPseudo FROM PseudoPerioden
),
LehrerZeilen AS (
    -- (a) Schuljahre MIT Perioden: 1 Zeile je Lehrer x Untis-Periode
    SELECT
        t.SCHOOL_ID, t.TEACHER_ID, t.SCHOOLYEAR_ID, ap.TERM_ID AS TERM_ID_EFF,
        t.Name, t.PNumber, t.StatisticCodes, t.OwnSchool, t.Longname, t.FirstName,
        t.PlannedWeek, t.PlannedPerDept
    FROM Teacher t
    INNER JOIN AllePerioden ap
        ON ap.SCHOOLYEAR_ID = t.SCHOOLYEAR_ID
       AND ap.IsPseudo = 0
       AND ap.TERM_ID = t.TERM_ID
    WHERE t.Deleted = 0
      AND t.SCHOOL_ID = 1
      -- Ein Schuljahr landet nie in beiden Zweigen
      AND NOT EXISTS (SELECT 1 FROM PseudoPerioden pp WHERE pp.SCHOOLYEAR_ID = t.SCHOOLYEAR_ID)
    UNION ALL
    -- (b) Schuljahre OHNE Perioden: 1 Zeile je Lehrer (hoechste vorhandene
    --     TERM_ID, i.d.R. genau eine; NULL-sicher via ROW_NUMBER), zugeordnet
    --     zur Pseudo-Periode 999
    SELECT
        x.SCHOOL_ID, x.TEACHER_ID, x.SCHOOLYEAR_ID, ap.TERM_ID AS TERM_ID_EFF,
        x.Name, x.PNumber, x.StatisticCodes, x.OwnSchool, x.Longname, x.FirstName,
        x.PlannedWeek, x.PlannedPerDept
    FROM (
        SELECT t.*,
               ROW_NUMBER() OVER (
                   PARTITION BY t.SCHOOL_ID, t.SCHOOLYEAR_ID, t.TEACHER_ID
                   ORDER BY t.TERM_ID DESC
               ) AS rn
        FROM Teacher t
        WHERE t.Deleted = 0
          AND t.SCHOOL_ID = 1
    ) x
    INNER JOIN AllePerioden ap
        ON ap.SCHOOLYEAR_ID = x.SCHOOLYEAR_ID
       AND ap.IsPseudo = 1
    WHERE x.rn = 1
)
SELECT
    t.SCHOOL_ID,
    t.TEACHER_ID,
    t.SCHOOLYEAR_ID,
    t.TERM_ID_EFF AS TERM_ID,
    t.Name,
    t.PNumber AS Personalnummer,
    t.StatisticCodes AS Statistik_Code,
    t.OwnSchool AS Stammschule,
    CONCAT(t.Longname, ' ', t.FirstName) AS Vollname,
    ISNULL(TRY_CAST(t.PlannedWeek AS DECIMAL(10,2)), 0) / 1000.0 AS Deputat,
    CONCAT(
        RIGHT('0000' + CAST(t.SCHOOLYEAR_ID / 10000 AS VARCHAR), 4),
        '/',
        RIGHT('0000' + CAST(t.SCHOOLYEAR_ID % 10000 AS VARCHAR), 4)
    ) AS Schuljahr_Text,
    mn.Term_Name,
    -- DateFrom: Periodenstart
    CONVERT(VARCHAR(10), DATEFROMPARTS(
        mn.DateFrom / 10000,
        (mn.DateFrom / 100) % 100,
        mn.DateFrom % 100
    ), 104) AS DateFrom_Formatted,
    -- DateTo: Pseudo-Periode = 31.07. (inklusiv); echte Periode = Tag vor
    -- naechster Periode (oder Untis-DateTo - 1 bei der letzten Periode)
    CASE
        WHEN mn.IsPseudo = 1 THEN
            CONVERT(VARCHAR(10), DATEFROMPARTS(
                mn.DateTo / 10000, (mn.DateTo / 100) % 100, mn.DateTo % 100
            ), 104)
        ELSE
            CONVERT(VARCHAR(10), DATEADD(DAY, -1,
                CASE
                    WHEN mn.NextDateFrom IS NOT NULL AND mn.NextDateFrom > mn.DateFrom THEN
                        DATEFROMPARTS(mn.NextDateFrom / 10000, (mn.NextDateFrom / 100) % 100, mn.NextDateFrom % 100)
                    -- Zwei Perioden mit identischem DateFrom: 1-Tages-Periode statt
                    -- date_to < date_from (wuerde den gesamten Terms-Sync abbrechen)
                    WHEN mn.NextDateFrom IS NOT NULL THEN
                        DATEADD(DAY, 1, DATEFROMPARTS(mn.DateFrom / 10000, (mn.DateFrom / 100) % 100, mn.DateFrom % 100))
                    ELSE
                        DATEFROMPARTS(mn.DateTo / 10000, (mn.DateTo / 100) % 100, mn.DateTo % 100)
                END
            ), 104)
    END AS DateTo_Formatted,
    -- b-Periode-Erkennung anhand des Term-Namens (z.B. "Periode12b")
    CASE WHEN mn.IsPseudo = 0 AND mn.Term_Name LIKE '%b' THEN 1 ELSE 0 END AS IsBPeriode,
    mn.IsPseudo,
    -- Deputat GES (Department 1)
    CASE
        WHEN CHARINDEX('1~', t.PlannedPerDept) > 0 THEN
            ISNULL(
                TRY_CAST(
                    LEFT(
                        SUBSTRING(t.PlannedPerDept, CHARINDEX('1~', t.PlannedPerDept) + 2, 20),
                        CASE
                            WHEN PATINDEX('%[^0-9]%', SUBSTRING(t.PlannedPerDept, CHARINDEX('1~', t.PlannedPerDept) + 2, 20)) > 0
                            THEN PATINDEX('%[^0-9]%', SUBSTRING(t.PlannedPerDept, CHARINDEX('1~', t.PlannedPerDept) + 2, 20)) - 1
                            ELSE LEN(SUBSTRING(t.PlannedPerDept, CHARINDEX('1~', t.PlannedPerDept) + 2, 20))
                        END
                    ) AS DECIMAL(10,2)
                ), 0
            ) / 1000.0
        ELSE 0
    END AS Deputat_GES,
    -- Deputat GYM (Department 2)
    CASE
        WHEN CHARINDEX('2~', t.PlannedPerDept) > 0 THEN
            ISNULL(
                TRY_CAST(
                    LEFT(
                        SUBSTRING(t.PlannedPerDept, CHARINDEX('2~', t.PlannedPerDept) + 2, 20),
                        CASE
                            WHEN PATINDEX('%[^0-9]%', SUBSTRING(t.PlannedPerDept, CHARINDEX('2~', t.PlannedPerDept) + 2, 20)) > 0
                            THEN PATINDEX('%[^0-9]%', SUBSTRING(t.PlannedPerDept, CHARINDEX('2~', t.PlannedPerDept) + 2, 20)) - 1
                            ELSE LEN(SUBSTRING(t.PlannedPerDept, CHARINDEX('2~', t.PlannedPerDept) + 2, 20))
                        END
                    ) AS DECIMAL(10,2)
                ), 0
            ) / 1000.0
        ELSE 0
    END AS Deputat_GYM,
    -- Deputat BK (Department 3)
    CASE
        WHEN CHARINDEX('3~', t.PlannedPerDept) > 0 THEN
            ISNULL(
                TRY_CAST(
                    LEFT(
                        SUBSTRING(t.PlannedPerDept, CHARINDEX('3~', t.PlannedPerDept) + 2, 20),
                        CASE
                            WHEN PATINDEX('%[^0-9]%', SUBSTRING(t.PlannedPerDept, CHARINDEX('3~', t.PlannedPerDept) + 2, 20)) > 0
                            THEN PATINDEX('%[^0-9]%', SUBSTRING(t.PlannedPerDept, CHARINDEX('3~', t.PlannedPerDept) + 2, 20)) - 1
                            ELSE LEN(SUBSTRING(t.PlannedPerDept, CHARINDEX('3~', t.PlannedPerDept) + 2, 20))
                        END
                    ) AS DECIMAL(10,2)
                ), 0
            ) / 1000.0
        ELSE 0
    END AS Deputat_BK
FROM LehrerZeilen t
INNER JOIN AllePerioden mn
    ON mn.SCHOOLYEAR_ID = t.SCHOOLYEAR_ID
   AND mn.TERM_ID = t.TERM_ID_EFF
WHERE
    t.Longname IS NOT NULL
    AND t.Longname != ''
ORDER BY
    mn.SCHOOLYEAR_ID,
    mn.DateFrom,
    mn.TERM_ID,
    t.Longname,
    t.FirstName;
