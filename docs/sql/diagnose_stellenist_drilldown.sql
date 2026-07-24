-- ============================================================================
-- DIAGNOSE: Stellenist-Drilldown zeigt bei "Froese Simon" unter GYM und BK
--           dieselben Werte
-- ============================================================================
-- Ziel dieser Abfragen ist NICHT, den Bug zu finden (der ist im Code belegt:
-- StellenistClient.tsx:355 rendert die Karte mit key={zr.zeitraum} ohne
-- schuleId, StellenistDrilldown.tsx:71 blockt den Refetch per requested-Guard
-- -> beim Schul-Tab-Wechsel bleibt der geladene Datensatz der VORHERIGEN
-- Schule stehen). Die Abfragen belegen, ob ZUSAETZLICH ein Datenproblem aus
-- dem Untis-Parsing vorliegt.
--
-- Wo ausfuehren: n8n -> Postgres Node gegen die App-DB (stellenistberechnung),
--                oder direkt: docker compose exec db psql -U stellenist -d stellenistberechnung
-- Alle Abfragen sind read-only.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- D1  Was liefert die View wirklich? (entscheidende Abfrage)
--
--     Genau EINE der Spalten gym/bk > 0        -> reiner Anzeige-Bug (Code)
--     Beide > 0 und UNTERSCHIEDLICH            -> fachlich korrekt (§3 FESchVO),
--                                                 nur die Anzeige ist stale
--     Beide > 0 und GLEICH                     -> zusaetzlich Datenproblem
-- ----------------------------------------------------------------------------
SELECT v.monat,
       v.deputat_gesamt_tagesgenau,
       v.deputat_ges_tagesgenau,
       v.deputat_gym_tagesgenau,
       v.deputat_bk_tagesgenau,
       v.tage_im_monat,
       v.enthaelt_korrektur
FROM   v_deputat_monat_tagesgenau v
JOIN   lehrer l          ON l.id = v.lehrer_id
JOIN   haushaltsjahre hj ON hj.id = v.haushaltsjahr_id
WHERE  hj.jahr = 2026
  AND (l.vollname ILIKE '%fr%se%simon%' OR l.vollname ILIKE '%froes%simon%')
ORDER  BY v.monat;


-- ----------------------------------------------------------------------------
-- D2  Rohdaten je Periode (die "5 Zeilen")
-- ----------------------------------------------------------------------------
SELECT dpp.untis_schoolyear_id,
       dpp.untis_term_id,
       dpp.gueltig_von,
       dpp.gueltig_bis,
       dpp.deputat_gesamt,
       dpp.deputat_ges,
       dpp.deputat_gym,
       dpp.deputat_bk,
       dpp.stammschule_code AS periode_stammschule,
       l.stammschule_code   AS master_stammschule,
       dpp.sync_datum
FROM   deputat_pro_periode dpp
JOIN   lehrer l ON l.id = dpp.lehrer_id
WHERE (l.vollname ILIKE '%fr%se%simon%' OR l.vollname ILIKE '%froes%simon%')
ORDER  BY dpp.gueltig_von;


-- ----------------------------------------------------------------------------
-- D3  Doppelt angelegte Person ausschliessen
--     (manuell gepflegter + per Untis angelegter Datensatz derselben Person)
-- ----------------------------------------------------------------------------
SELECT id, vollname, untis_teacher_id, personalnummer,
       stammschule_code, statistik_code, quelle, aktiv
FROM   lehrer
WHERE  vollname ILIKE '%fr%se%' OR vollname ILIKE '%froes%'
ORDER  BY vollname;


-- ----------------------------------------------------------------------------
-- D4  Nachbau BEIDER Drilldown-WHERE-Klauseln in einem Ergebnis (Aug-Dez 2026)
--     Zeigt schwarz auf weiss, welche Lehrkraft in welchem Drilldown
--     serverseitig ueberhaupt vorkommt.
-- ----------------------------------------------------------------------------
SELECT 'GYM' AS drilldown, l.vollname, l.stammschule_code, v.monat,
       v.deputat_gym_tagesgenau AS wochenstunden
FROM   v_deputat_monat_tagesgenau v
JOIN   lehrer l          ON l.id = v.lehrer_id
JOIN   haushaltsjahre hj ON hj.id = v.haushaltsjahr_id
WHERE  hj.jahr = 2026 AND l.aktiv = true
  AND  v.deputat_gym_tagesgenau > 0
  AND  v.monat IN (8, 9, 10, 11, 12)
UNION ALL
SELECT 'BK', l.vollname, l.stammschule_code, v.monat,
       v.deputat_bk_tagesgenau
FROM   v_deputat_monat_tagesgenau v
JOIN   lehrer l          ON l.id = v.lehrer_id
JOIN   haushaltsjahre hj ON hj.id = v.haushaltsjahr_id
WHERE  hj.jahr = 2026 AND l.aktiv = true
  AND  v.deputat_bk_tagesgenau > 0
  AND  v.monat IN (8, 9, 10, 11, 12)
ORDER  BY 2, 1, 4;


-- ----------------------------------------------------------------------------
-- D5  Parse-Streuwerte aus dem n8n-CHARINDEX-Parsing aufspueren
--     CHARINDEX('2~'/'3~') matcht auch die letzte Ziffer eines vorherigen
--     Wertes. Typische Signatur: winzige Werte > 0 (z.B. 0,003).
--     Sollte moeglichst 0 Zeilen liefern.
-- ----------------------------------------------------------------------------
SELECT l.vollname, l.stammschule_code,
       dpp.untis_schoolyear_id, dpp.untis_term_id,
       dpp.deputat_gesamt, dpp.deputat_ges, dpp.deputat_gym, dpp.deputat_bk
FROM   deputat_pro_periode dpp
JOIN   lehrer l ON l.id = dpp.lehrer_id
WHERE (dpp.deputat_ges > 0 AND dpp.deputat_ges < 0.5)
   OR (dpp.deputat_gym > 0 AND dpp.deputat_gym < 0.5)
   OR (dpp.deputat_bk  > 0 AND dpp.deputat_bk  < 0.5)
ORDER  BY l.vollname, dpp.gueltig_von;


-- ----------------------------------------------------------------------------
-- D6  Summenprobe: Verteilung vs. Gesamtdeputat
--     Wenn ges+gym+bk deutlich vom Gesamtwert abweicht, stimmt entweder das
--     Parsing nicht oder es fehlt eine Abteilung (z.B. die Grundschulen).
--     Genau diese Zeilen sind die Kandidaten fuer den Grundschul-Umbau.
-- ----------------------------------------------------------------------------
SELECT l.stammschule_code,
       COUNT(*)                                                       AS zeilen,
       SUM(CASE WHEN ABS(dpp.deputat_gesamt
                       - (dpp.deputat_ges + dpp.deputat_gym + dpp.deputat_bk)
                    ) > 0.01 THEN 1 ELSE 0 END)                       AS abweichende_zeilen,
       ROUND(AVG(dpp.deputat_gesamt
               - (dpp.deputat_ges + dpp.deputat_gym + dpp.deputat_bk)), 3) AS avg_differenz
FROM   deputat_pro_periode dpp
JOIN   lehrer l ON l.id = dpp.lehrer_id
GROUP  BY l.stammschule_code
ORDER  BY l.stammschule_code;


-- ----------------------------------------------------------------------------
-- D7  Bestand der bisher manuell gepflegten Grundschul-Lehrkraefte
--     Basis fuer die Merge-Strategie beim ersten Grundschul-Sync.
-- ----------------------------------------------------------------------------
SELECT s.kurzname,
       s.untis_code,
       COUNT(l.id) FILTER (WHERE l.quelle = 'manuell')              AS manuell,
       COUNT(l.id) FILTER (WHERE l.quelle = 'untis')                AS aus_untis,
       COUNT(l.id) FILTER (WHERE l.personalnummer IS NULL)          AS ohne_personalnummer,
       COUNT(l.id) FILTER (WHERE l.statistik_code IS NULL)          AS ohne_statistik_code,
       COUNT(l.id)                                                  AS gesamt
FROM   schulen s
LEFT   JOIN lehrer l ON l.stammschule_id = s.id AND l.aktiv = true
GROUP  BY s.kurzname, s.untis_code
ORDER  BY s.kurzname;
