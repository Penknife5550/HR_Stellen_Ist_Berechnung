-- ============================================================================
-- DIAGNOSE: Stellensoll HJ 2026 — "4 Fehler: GES, GES, GYM, GYM",
--           Zeitraum Aug-Dez fehlt, angezeigte Werte wirken veraltet (08.09.2026)
-- ============================================================================
-- STAND: Die Zeilenangaben und getAktuellesSchuljahr() beziehen sich auf den Code
-- VOR dem Fix (Commit bf8be28). Der Fix (CHANGELOG [Unreleased], 09.09.2026) hat
-- getAktuellesSchuljahr() entfernt; die Abfragen bleiben zur Aufklaerung des
-- Vorfalls gueltig.
--
-- Der Mechanismus ist im Code belegt und braucht keine DB:
--   src/app/stellensoll/actions.ts:132-140  einziger Fehlerpfad, der eine
--       Schul-Liste erzeugt: "Fehlende SLR-Werte" (String-Lookup
--       slrLookup[schul_stufen.schulform_typ] im Schuljahr aus
--       getAktuellesSchuljahr = aktiv=true ORDER BY bezeichnung DESC LIMIT 1).
--   actions.ts:216-241  ist_aktuell=false wird NUR im Erfolgsfall gesetzt
--       -> nach einem Fehler bleibt die alte Jan-Jul-Zeile sichtbar,
--          Aug-Dez wurde nie geschrieben.
--   StellensollClient.tsx  zeigt weder berechnet_am noch fehlende Zeitraeume
--       noch die Fehlerdetails -> Eindruck "alte Schuelerzahlen".
--
-- Diese Abfragen klaeren, WELCHE Konstellation den Lookup fuer GES/GYM
-- leerlaufen laesst (gleicher Mechanismus, anderer Ausloeser):
--   H1   Schuljahr "2026/2027" in /einstellungen angelegt (Checkliste v0.8.1
--        Pkt. 8): per Schema-Default aktiv=true, ohne SLR-Carry-over
--   H2a  SLR-Zeilen der GES/GYM-Typen in 2025/2026 geloescht / auf 0 gesetzt
--   H2b  schul_stufen.schulform_typ von GES/GYM abweichend geschrieben
--   H2c  anderes Schuljahr per "Als aktiv setzen" aktiviert
--
-- Wo ausfuehren: n8n -> Postgres Node gegen die App-DB (stellenistberechnung),
--                oder direkt: docker compose exec db psql -U stellenist -d stellenistberechnung
-- Alle Abfragen sind read-only. Reihenfolge einhalten; jeder Block sagt,
-- welches Ergebnis was bedeutet.
-- ============================================================================

-- (1) Alle Schuljahre mit aktiv-Flag. Die App waehlt: aktiv=true ORDER BY bezeichnung DESC LIMIT 1.
--     H1  : oberste Zeile '2026/2027' (oder neuer) mit aktiv=true, daneben weitere aktive Zeilen (Seed setzt alle aktiv).
--     H2c : genau EINE Zeile aktiv=true und es ist NICHT die hoechste Bezeichnung -> Toggle benutzt.
--     H2a/H2b: 'wird_fuer_berechnung_genutzt' steht bei '2025/2026' -> Ursache liegt in (2) oder (3).
SELECT id, bezeichnung, aktiv, start_datum, end_datum,
       bezeichnung = (SELECT bezeichnung FROM schuljahre WHERE aktiv = true
                      ORDER BY bezeichnung DESC LIMIT 1) AS wird_fuer_berechnung_genutzt
FROM schuljahre
ORDER BY bezeichnung DESC;

-- (2) SLR-Werte je Schuljahr; Typ in [..] macht Leerzeichen sichtbar, len zeigt unsichtbare Zeichen.
--     Erwartung 2025/2026 (Seed): 11 Zeilen inkl. 'Gesamtschule Sek I', 'Gesamtschule Sek II',
--     'Gymnasium Sek I (G9)', 'Gymnasium Sek II', 'Berufskolleg Vollzeit', 'Grundschule'.
--     H1 : beim genutzten Schuljahr fehlen die 4 GES/GYM-Typen oder sind abweichend geschrieben.
--     H2a: bei 2025/2026 fehlen die 4 Typen oder relation = 0.
SELECT sj.bezeichnung, sj.aktiv,
       '[' || w.schulform_typ || ']' AS typ, length(w.schulform_typ) AS len,
       w.relation, w.quelle, w.geaendert_von, w.created_at, w.updated_at
FROM slr_werte w
JOIN schuljahre sj ON sj.id = w.schuljahr_id
ORDER BY sj.bezeichnung DESC, w.schulform_typ;

-- (3) schul_stufen.schulform_typ je Schule = Lookup-Schluessel der Berechnung (+ ist_im_aufbau fuer Symptom 3).
--     H2b: GES/GYM-Typen weichen zeichengenau von den Typen in (2) ab (fehlendes '(G9)', 'Sek.', Leerzeichen).
SELECT s.kurzname, st.stufe,
       '[' || st.schulform_typ || ']' AS typ, length(st.schulform_typ) AS len,
       st.aktiv AS stufe_aktiv, s.aktiv AS schule_aktiv, s.ist_im_aufbau
FROM schul_stufen st
JOIN schulen s ON s.id = st.schule_id
ORDER BY s.kurzname, st.stufe;

-- (4) ANTI-JOIN — reproduziert exakt die Pruefung in actions.ts:129-132:
--     Typen mit Schuelerzahlen an einem HJ-2026-Stichtag, fuer die das per getAktuellesSchuljahr
--     gewaehlte Schuljahr keinen SLR-Wert > 0 hat.
--     Erwartung: genau die GES/GYM-Typen an beiden Stichtagen (= die 4 Fehler).
--     Leeres Ergebnis: Ursache liegt NICHT im SLR-Lookup -> (6) lesen; Daten wurden seit dem Klick geaendert.
WITH sj AS (
  SELECT id, bezeichnung FROM schuljahre WHERE aktiv = true ORDER BY bezeichnung DESC LIMIT 1
), hj AS (
  SELECT stichtag_vorjahr AS stichtag FROM haushaltsjahre WHERE jahr = 2026
  UNION
  SELECT stichtag_laufend FROM haushaltsjahre WHERE jahr = 2026
)
SELECT DISTINCT s.kurzname, z.stichtag,
       '[' || st.schulform_typ || ']' AS typ_ohne_slr, sj.bezeichnung AS genutztes_schuljahr
FROM schuelerzahlen z
JOIN schul_stufen st ON st.id = z.schul_stufe_id
JOIN schulen s ON s.id = z.schule_id
CROSS JOIN sj
WHERE z.stichtag IN (SELECT stichtag FROM hj WHERE stichtag IS NOT NULL)
  AND NOT EXISTS (
        SELECT 1 FROM slr_werte w
        WHERE w.schuljahr_id = sj.id
          AND w.schulform_typ = st.schulform_typ
          AND w.relation > 0)
ORDER BY s.kurzname, z.stichtag;

-- (5) Stichtage des HJ 2026 und Schuelerzahlen je Schule/Stichtag.
--     Jedes fehlende (Schule, Stichtag)-Paar = stiller Skip (Z.122), erwartet 5 Skips.
--     GES und GYM MUESSEN an beiden Stichtagen Zeilen haben (sonst waeren es keine 4 Fehler).
--     NULL bei stichtag_laufend => Aug-Dez wird fuer alle still uebersprungen.
SELECT jahr, stichtag_vorjahr, stichtag_laufend, gesperrt FROM haushaltsjahre WHERE jahr = 2026;

SELECT s.kurzname, z.stichtag, count(*) AS zeilen, sum(z.anzahl) AS schueler,
       max(z.updated_at) AS zuletzt_geaendert
FROM schuelerzahlen z
JOIN schulen s ON s.id = z.schule_id
WHERE z.stichtag IN (SELECT stichtag_vorjahr FROM haushaltsjahre WHERE jahr = 2026
                     UNION SELECT stichtag_laufend FROM haushaltsjahre WHERE jahr = 2026)
GROUP BY s.kurzname, z.stichtag
ORDER BY s.kurzname, z.stichtag;

-- (5b) 'Aktuelle' Schuelerzahlen unter einem Datum, das in KEINEM Haushaltsjahr als Stichtag steht:
--      diese Zeilen findet die Berechnung nie (exakter Datums-Match). Leer = gut.
SELECT s.kurzname, z.stichtag, count(*) AS zeilen, sum(z.anzahl) AS schueler, max(z.erfasst_von) AS erfasst_von
FROM schuelerzahlen z
JOIN schulen s ON s.id = z.schule_id
WHERE z.stichtag >= DATE '2026-01-01'
  AND z.stichtag NOT IN (SELECT stichtag_vorjahr FROM haushaltsjahre WHERE stichtag_vorjahr IS NOT NULL
                         UNION SELECT stichtag_laufend FROM haushaltsjahre WHERE stichtag_laufend IS NOT NULL)
GROUP BY s.kurzname, z.stichtag
ORDER BY s.kurzname, z.stichtag;

-- (6) Letzte Berechnungs-Audit-Zeilen: enthalten die in der UI verworfenen details
--     ('Fehlende SLR-Werte: <Typ>'). Entscheidet H1/H2a (Seed-Schreibweise) vs. H2b (abweichende Schreibweise).
SELECT zeitpunkt, benutzer,
       jsonb_pretty(neue_werte -> 'fehler')     AS fehler,
       jsonb_pretty(neue_werte -> 'ergebnisse') AS ergebnisse
FROM audit_log
WHERE tabelle = 'berechnung_stellensoll'
ORDER BY zeitpunkt DESC
LIMIT 3;

-- (7) ist_aktuell-Zeilen HJ 2026 mit berechnet_am. Erwartung H1: GYM/GES nur 'jan-jul',
--     berechnet_am VOR dem 08.09. 22:06; grundstellen_details enthaelt slr 19.87/12.70 (Seed 2025/2026).
--     BK/GS*: berechnet_am = 08.09.2026 (die 3 Erfolge).
SELECT s.kurzname, b.zeitraum, b.stellensoll, b.berechnet_am, b.berechnet_von, b.ist_aktuell,
       b.grundstellen_details
FROM berechnung_stellensoll b
JOIN schulen s ON s.id = b.schule_id
JOIN haushaltsjahre h ON h.id = b.haushaltsjahr_id
WHERE h.jahr = 2026
ORDER BY s.kurzname, b.zeitraum, b.berechnet_am DESC;

-- (8) Audit-Spur seit Deploy: WER hat Schuljahre / SLR / Schulstufen angefasst (Tabellenname wird
--     unterschiedlich geschrieben, daher ILIKE). INSERT auf schuljahre = H1; UPDATE 'aktiv_gesetzt' = H2c;
--     DELETE/UPDATE auf slr_werte = H2a; UPDATE auf schul_stufen/schulStufen = H2b.
SELECT zeitpunkt, tabelle, aktion, datensatz_id, benutzer, alte_werte, neue_werte
FROM audit_log
WHERE zeitpunkt >= TIMESTAMPTZ '2026-09-01'
  AND (tabelle ILIKE '%schuljahr%' OR tabelle ILIKE '%slr%' OR tabelle ILIKE '%stufen%')
ORDER BY zeitpunkt;

SELECT h.geaendert_am, h.geaendert_von, sj.bezeichnung, h.schulform_typ, h.relation_alt, h.relation_neu, h.grund
FROM slr_historie h
JOIN schuljahre sj ON sj.id = h.schuljahr_id
WHERE h.geaendert_am >= TIMESTAMPTZ '2026-09-01'
ORDER BY h.geaendert_am;