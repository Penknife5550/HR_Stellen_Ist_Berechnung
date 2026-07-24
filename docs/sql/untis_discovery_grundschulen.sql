-- ============================================================================
-- UNTIS-DISKOVERY: Grundschulen in den Deputat-Sync aufnehmen
-- ============================================================================
-- Ziel: Bevor Code gebaut wird, muss belegt sein, WIE die neuen Schulen in
--       Untis abgebildet sind. Davon haengt ab, ob eine Schema-Migration
--       reicht (Departments) oder ob das gesamte Lehrer-/Perioden-Mapping
--       mandantenfaehig werden muss (eigene SCHOOL_IDs).
--
-- STAND 2026-07-22: Der Auftraggeber hat "eigene Untis-Mandanten" bestaetigt.
--       Q1/Q5/Q6/Q10 dienen damit nicht mehr der Entscheidung, sondern der
--       Bestimmung des AUSMASSES (wie viele Mandanten, kollidieren TEACHER_IDs,
--       kollidieren TERM_IDs, wie viele Personen arbeiten mandantenuebergreifend).
--       Diese Zahlen bestimmen den Migrationsaufwand und die Merge-Strategie.
--
-- Wo ausfuehren: n8n -> Microsoft SQL Node -> "Execute Query" gegen die
--                Untis-MSSQL-DB (gleiche Credential wie Workflow #223 v0.7).
--                ALLE Abfragen sind read-only (reines SELECT).
--
-- Bitte Ergebnisse von Q1-Q10 als JSON/CSV zurueckgeben. Q0 nur, falls eine
-- der Abfragen wegen unbekanntem Tabellennamen fehlschlaegt.
--
-- HINWEIS zu (SELECT MAX(SCHOOLYEAR_ID) ...): Diese Unterabfragen laufen
-- absichtlich OHNE SCHOOL_ID-Filter. Untis kodiert im SCHOOLYEAR_ID das
-- Schuljahr selbst (2025/2026 -> 20252026), der Wert sollte daher in allen
-- Mandanten identisch sein. Q1 zeigt, ob das zutrifft. Falls nicht, muessen
-- die betroffenen Abfragen je Mandant einzeln gefahren werden.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Q0  Schema-Sonde (nur bei Fehler "Invalid object name" noetig)
-- ----------------------------------------------------------------------------
SELECT TABLE_NAME
FROM   INFORMATION_SCHEMA.TABLES
WHERE  TABLE_TYPE = 'BASE TABLE'
  AND (TABLE_NAME LIKE '%epart%'      -- Department / Departments
    OR TABLE_NAME LIKE '%chool%'      -- School / Schoolyear
    OR TABLE_NAME LIKE 'Teacher%'
    OR TABLE_NAME LIKE 'Term%')
ORDER  BY TABLE_NAME;

-- Spalten der Teacher-Tabelle (welche Mandanten-/Abteilungs-Spalten gibt es?)
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM   INFORMATION_SCHEMA.COLUMNS
WHERE  TABLE_NAME = 'Teacher'
ORDER  BY ORDINAL_POSITION;


-- ----------------------------------------------------------------------------
-- Q1  ENTSCHEIDUNGSFRAGE: Ein Mandant mit Abteilungen ODER mehrere Mandanten?
--     Liefert diese Abfrage nur EINE SCHOOL_ID  -> Grundschulen sind
--     Abteilungen (Departments) im selben Mandanten  => kleiner Umbau.
--     Liefert sie MEHRERE SCHOOL_IDs               => echter Multi-Mandant
--                                                     => TEACHER_ID kann
--                                                        kollidieren, Terms
--                                                        sind je Mandant.
-- ----------------------------------------------------------------------------
SELECT   t.SCHOOL_ID,
         t.SCHOOLYEAR_ID,
         COUNT(DISTINCT t.TEACHER_ID) AS anzahl_lehrer,
         COUNT(DISTINCT t.TERM_ID)    AS anzahl_perioden,
         MIN(t.OwnSchool)             AS beispiel_ownschool
FROM     Teacher t
WHERE    t.Deleted = 0
GROUP BY t.SCHOOL_ID, t.SCHOOLYEAR_ID
ORDER BY t.SCHOOL_ID, t.SCHOOLYEAR_ID;


-- ----------------------------------------------------------------------------
-- Q2  Abteilungen (Departments) = Quelle der Deputat-Aufteilung
--     Die App parst heute PlannedPerDept auf die Department-IDs 1/2/3 und
--     nennt sie GES/GYM/BK. Hier steht, welche IDs es wirklich gibt.
--     Falls "Department" nicht existiert: aus Q0 den echten Namen einsetzen.
-- ----------------------------------------------------------------------------
SELECT   d.SCHOOL_ID,
         d.SCHOOLYEAR_ID,
         d.DEPARTMENT_ID,
         d.Name,
         d.Longname,
         d.Deleted
FROM     Department d
ORDER BY d.SCHOOL_ID, d.SCHOOLYEAR_ID DESC, d.DEPARTMENT_ID;


-- ----------------------------------------------------------------------------
-- Q3  Stammschul-Kuerzel (Teacher.OwnSchool) je Mandant/Schuljahr
--     Diese Strings muessen 1:1 in schulen.untis_code stehen, sonst wirft
--     sync-v2 den Lehrer weg (route.ts:113-117).
--     Heute vorhanden in der App: GES, GYM, BK.
--     Erwartet neu: die Kuerzel der drei Grundschulen (GSS/GSM/GSH?).
-- ----------------------------------------------------------------------------
SELECT   t.SCHOOL_ID,
         t.SCHOOLYEAR_ID,
         t.OwnSchool,
         COUNT(*)                     AS anzahl_zeilen,
         COUNT(DISTINCT t.TEACHER_ID) AS anzahl_lehrer
FROM     Teacher t
WHERE    t.Deleted = 0
GROUP BY t.SCHOOL_ID, t.SCHOOLYEAR_ID, t.OwnSchool
ORDER BY t.SCHOOL_ID, t.SCHOOLYEAR_ID DESC, t.OwnSchool;


-- ----------------------------------------------------------------------------
-- Q4  Rohformat von PlannedPerDept (KRITISCH)
--     Die aktuelle Parse-Logik im n8n-SQL nutzt CHARINDEX('1~'/'2~'/'3~').
--     Das ist nicht feldgrenzen-verankert und bricht spaetestens bei
--     zweistelligen Department-IDs. Hier sehen wir das echte Trennzeichen
--     und ob Grundschul-Departments ueberhaupt in dem Feld auftauchen.
-- ----------------------------------------------------------------------------
SELECT TOP 100
         t.SCHOOL_ID,
         t.SCHOOLYEAR_ID,
         t.TERM_ID,
         t.OwnSchool,
         t.Longname,
         t.FirstName,
         t.PlannedWeek,
         t.PlannedPerDept
FROM     Teacher t
WHERE    t.Deleted = 0
  AND    t.SCHOOLYEAR_ID = (SELECT MAX(SCHOOLYEAR_ID) FROM Teacher WHERE Deleted = 0)
  AND    ISNULL(t.PlannedPerDept, '') <> ''
ORDER BY t.OwnSchool, t.Longname;

-- Nur die Grundschul-Lehrkraefte (OwnSchool-Filter nach Q3 anpassen!)
SELECT TOP 100
         t.SCHOOL_ID, t.SCHOOLYEAR_ID, t.TERM_ID, t.OwnSchool,
         t.Longname, t.FirstName, t.PNumber, t.StatisticCodes,
         t.PlannedWeek, t.PlannedPerDept
FROM     Teacher t
WHERE    t.Deleted = 0
  AND    t.OwnSchool NOT IN ('GES', 'GYM', 'BK')
ORDER BY t.SCHOOLYEAR_ID DESC, t.OwnSchool, t.Longname;


-- ----------------------------------------------------------------------------
-- Q5  Perioden (Terms) je Mandant — passt der Term-Master noch?
--     untis_terms hat heute PK (school_year_id, term_id) OHNE SCHOOL_ID.
--     Falls Q1 mehrere SCHOOL_IDs liefert UND hier dieselbe TERM_ID bei
--     verschiedenen SCHOOL_IDs mit ABWEICHENDEN Datumsgrenzen auftaucht,
--     muss der PK um school_id erweitert werden.
-- ----------------------------------------------------------------------------
SELECT   tr.SCHOOL_ID,
         tr.SCHOOLYEAR_ID,
         tr.TERM_ID,
         tr.Name,
         tr.DateFrom,
         tr.DateTo,
         tr.Deleted
FROM     Terms tr
WHERE    tr.Deleted = 0
ORDER BY tr.SCHOOL_ID, tr.SCHOOLYEAR_ID DESC, tr.TERM_ID;

-- Kollisionsprobe: gleiche (SCHOOLYEAR_ID, TERM_ID), aber unterschiedliche
-- Datumsgrenzen -> darf 0 Zeilen liefern, sonst PK-Erweiterung noetig.
SELECT   tr.SCHOOLYEAR_ID, tr.TERM_ID,
         COUNT(DISTINCT tr.SCHOOL_ID)                       AS mandanten,
         COUNT(DISTINCT CAST(tr.DateFrom AS varchar(20)))   AS versch_datefrom
FROM     Terms tr
WHERE    tr.Deleted = 0
GROUP BY tr.SCHOOLYEAR_ID, tr.TERM_ID
HAVING   COUNT(DISTINCT CAST(tr.DateFrom AS varchar(20))) > 1;


-- ----------------------------------------------------------------------------
-- Q6  TEACHER_ID-Kollision zwischen Mandanten
--     lehrer.untis_teacher_id ist UNIQUE (schema.ts:303). Taucht dieselbe
--     TEACHER_ID bei zwei SCHOOL_IDs mit verschiedenen Personen auf, wuerde
--     der Sync Datensaetze ueberschreiben. Muss 0 Zeilen liefern.
-- ----------------------------------------------------------------------------
SELECT   t.TEACHER_ID,
         COUNT(DISTINCT t.SCHOOL_ID)                             AS mandanten,
         COUNT(DISTINCT CONCAT(t.Longname, '|', t.FirstName))    AS versch_personen,
         MIN(CONCAT(t.SCHOOL_ID, ': ', t.Longname, ' ', t.FirstName)) AS beispiel_a,
         MAX(CONCAT(t.SCHOOL_ID, ': ', t.Longname, ' ', t.FirstName)) AS beispiel_b
FROM     Teacher t
WHERE    t.Deleted = 0
GROUP BY t.TEACHER_ID
HAVING   COUNT(DISTINCT t.SCHOOL_ID) > 1
ORDER BY t.TEACHER_ID;


-- ----------------------------------------------------------------------------
-- Q7  Statistik-Codes der neuen Lehrkraefte
--     normalizeStatistikCode (statistikCode.ts:88) verwirft still alles, was
--     nicht in statistik_codes steht. Bekannt: L, LT, P, PT (Beamte),
--     U, UT, B, BT (Angestellte). Alles andere muss angelegt werden, sonst
--     landen die Grundschul-Lehrkraefte im Nachweis unter "Ohne Code".
-- ----------------------------------------------------------------------------
SELECT   t.OwnSchool,
         t.StatisticCodes,
         COUNT(DISTINCT t.TEACHER_ID) AS anzahl_lehrer
FROM     Teacher t
WHERE    t.Deleted = 0
  AND    t.SCHOOLYEAR_ID = (SELECT MAX(SCHOOLYEAR_ID) FROM Teacher WHERE Deleted = 0)
GROUP BY t.OwnSchool, t.StatisticCodes
ORDER BY t.OwnSchool, t.StatisticCodes;


-- ----------------------------------------------------------------------------
-- Q8  Personalnummern-Abgleich (Dublettenrisiko)
--     Die drei Grundschulen wurden bisher MANUELL gepflegt (lehrer.quelle =
--     'manuell', ohne untis_teacher_id). Beim ersten Sync legt sync-v2 diese
--     Personen NEU an -> jede Lehrkraft doppelt. Die Personalnummer ist der
--     einzige Schluessel fuer den Merge.
-- ----------------------------------------------------------------------------
SELECT   t.OwnSchool,
         t.TEACHER_ID,
         t.PNumber                                  AS personalnummer,
         CONCAT(t.Longname, ' ', t.FirstName)       AS vollname,
         t.Name                                     AS kuerzel,
         t.StatisticCodes,
         MAX(t.PlannedWeek)                         AS planned_week_max
FROM     Teacher t
WHERE    t.Deleted = 0
  AND    t.OwnSchool NOT IN ('GES', 'GYM', 'BK')
  AND    t.SCHOOLYEAR_ID = (SELECT MAX(SCHOOLYEAR_ID) FROM Teacher WHERE Deleted = 0)
GROUP BY t.OwnSchool, t.TEACHER_ID, t.PNumber, t.Longname, t.FirstName,
         t.Name, t.StatisticCodes
ORDER BY t.OwnSchool, t.Longname;


-- ----------------------------------------------------------------------------
-- Q10 MANDANTENUEBERGREIFENDE PERSONEN (kritisch fuer das Datenmodell)
--     Dieselbe Person kann in zwei Mandanten als zwei Teacher-Datensaetze mit
--     verschiedenen TEACHER_IDs stehen (z.B. 10 WS am GYM + 14 WS an der GSM).
--     Die einzige Klammer ist die Personalnummer. Diese Liste ist die
--     Arbeitsgrundlage fuer das Merge-Skript und beantwortet zugleich:
--       - Wie viele solcher Faelle gibt es ueberhaupt?
--       - Ist PNumber immer gefuellt und ueberall gleich geschrieben?
-- ----------------------------------------------------------------------------
SELECT   LTRIM(RTRIM(t.PNumber))                     AS personalnummer,
         COUNT(DISTINCT t.SCHOOL_ID)                 AS anzahl_mandanten,
         COUNT(DISTINCT t.TEACHER_ID)                AS anzahl_teacher_ids,
         STRING_AGG(DISTINCT CONCAT(t.SCHOOL_ID, ':', t.OwnSchool, ':', t.TEACHER_ID), ' | ')
                                                     AS vorkommen,
         MIN(CONCAT(t.Longname, ' ', t.FirstName))   AS name_a,
         MAX(CONCAT(t.Longname, ' ', t.FirstName))   AS name_b
FROM     Teacher t
WHERE    t.Deleted = 0
  AND    ISNULL(LTRIM(RTRIM(t.PNumber)), '') <> ''
GROUP BY LTRIM(RTRIM(t.PNumber))
HAVING   COUNT(DISTINCT t.SCHOOL_ID) > 1
ORDER BY personalnummer;

-- Gegenprobe: Lehrkraefte OHNE Personalnummer — fuer die kann nicht
-- automatisch gemerged werden, sie brauchen eine manuelle Zuordnung.
SELECT   t.SCHOOL_ID, t.OwnSchool, t.TEACHER_ID,
         CONCAT(t.Longname, ' ', t.FirstName) AS vollname
FROM     Teacher t
WHERE    t.Deleted = 0
  AND    ISNULL(LTRIM(RTRIM(t.PNumber)), '') = ''
  AND    t.SCHOOLYEAR_ID = (SELECT MAX(SCHOOLYEAR_ID) FROM Teacher WHERE Deleted = 0)
ORDER BY t.SCHOOL_ID, t.Longname;


-- ----------------------------------------------------------------------------
-- Q9  DIAGNOSE Froese Simon (Drilldown-Meldung)
--     Beantwortet, ob Untis fuer diese Person tatsaechlich Anteile in zwei
--     Abteilungen fuehrt, oder ob es reine Anzeige ist.
-- ----------------------------------------------------------------------------
SELECT   t.SCHOOL_ID, t.SCHOOLYEAR_ID, t.TERM_ID,
         t.OwnSchool, t.Longname, t.FirstName, t.PNumber,
         t.StatisticCodes, t.PlannedWeek, t.PlannedPerDept
FROM     Teacher t
WHERE    t.Deleted = 0
  AND   (t.Longname LIKE 'Fr%se%' OR t.Longname LIKE 'Froes%')
ORDER BY t.SCHOOLYEAR_ID, t.TERM_ID;
