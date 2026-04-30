-- ============================================================
-- INITIAL-SEED Stellenist-Berechnung
-- ============================================================
-- Idempotent: Mehrfaches Ausfuehren verursacht keine Duplikate
-- (alle INSERTs nutzen ON CONFLICT DO NOTHING)
--
-- Ausfuehren:
--   sudo docker exec -i stellenist-db psql -U stellenist -d stellenistberechnung < seed_initial.sql
-- Oder als Heredoc direkt im psql:
--   sudo docker exec -i stellenist-db psql -U stellenist -d stellenistberechnung
--   \i /pfad/zu/seed_initial.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. SCHULEN
-- ------------------------------------------------------------
INSERT INTO schulen (schulnummer, name, kurzname, untis_code, schulform, adresse, plz, ort, farbe) VALUES
  ('195182', 'Freie Evangelische Gesamtschule Minden',  'GES', 'GES', 'Gesamtschule', 'Kingsleyallee 5', '32425', 'Minden', '#6BAA24'),
  ('196083', 'Freies Evangelisches Gymnasium Minden',   'GYM', 'GYM', 'Gymnasium',    'Kingsleyallee 6', '32425', 'Minden', '#FBC900'),
  ('100166', 'Freies Evangelisches Berufskolleg Minden','BK',  'BK',  'Berufskolleg', 'Kingsleyallee 6', '32425', 'Minden', '#5C82A5'),
  ('195054', 'Grundschule Stemwede',                    'GSS', NULL,  'Grundschule',  NULL, NULL, NULL, '#ad1928'),
  ('195844', 'Grundschule Minderheide',                 'GSM', NULL,  'Grundschule',  NULL, NULL, NULL, '#e2001a'),
  ('194608', 'Grundschule Haddenhausen',                'GSH', NULL,  'Grundschule',  NULL, NULL, NULL, '#509ac6')
ON CONFLICT (schulnummer) DO NOTHING;

-- ------------------------------------------------------------
-- 2. SCHUL-STUFEN
-- ------------------------------------------------------------
INSERT INTO schul_stufen (schule_id, stufe, schulform_typ) VALUES
  ((SELECT id FROM schulen WHERE kurzname='GES'), 'Sek I',       'Gesamtschule Sek I'),
  ((SELECT id FROM schulen WHERE kurzname='GES'), 'Sek II',      'Gesamtschule Sek II'),
  ((SELECT id FROM schulen WHERE kurzname='GYM'), 'Sek I',       'Gymnasium Sek I (G9)'),
  ((SELECT id FROM schulen WHERE kurzname='GYM'), 'Sek II',      'Gymnasium Sek II'),
  ((SELECT id FROM schulen WHERE kurzname='BK'),  'Vollzeit',    'Berufskolleg Vollzeit'),
  ((SELECT id FROM schulen WHERE kurzname='GSS'), 'Primarstufe', 'Grundschule'),
  ((SELECT id FROM schulen WHERE kurzname='GSM'), 'Primarstufe', 'Grundschule'),
  ((SELECT id FROM schulen WHERE kurzname='GSH'), 'Primarstufe', 'Grundschule')
ON CONFLICT (schule_id, stufe) DO NOTHING;

-- ------------------------------------------------------------
-- 3. SCHULJAHRE
-- ------------------------------------------------------------
INSERT INTO schuljahre (bezeichnung, start_datum, end_datum) VALUES
  ('2023/2024', '2023-08-01', '2024-07-31'),
  ('2024/2025', '2024-08-01', '2025-07-31'),
  ('2025/2026', '2025-08-01', '2026-07-31')
ON CONFLICT (bezeichnung) DO NOTHING;

-- ------------------------------------------------------------
-- 4. HAUSHALTSJAHRE
-- ------------------------------------------------------------
INSERT INTO haushaltsjahre (jahr, stichtag_vorjahr, stichtag_laufend) VALUES
  (2024, '2023-10-15', '2024-10-15'),
  (2025, '2024-10-15', '2025-10-15'),
  (2026, '2025-10-15', '2026-10-15')
ON CONFLICT (jahr) DO NOTHING;

-- ------------------------------------------------------------
-- 5. SLR-WERTE 2025/2026
-- ------------------------------------------------------------
INSERT INTO slr_werte (schuljahr_id, schulform_typ, relation, quelle) VALUES
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Grundschule',           21.95, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Hauptschule',           17.86, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Realschule',            20.19, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Sekundarschule',        16.27, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Gymnasium Sek I (G8)',  19.17, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Gymnasium Sek I (G9)',  19.87, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Gymnasium Sek II',      12.70, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Gesamtschule Sek I',    18.63, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Gesamtschule Sek II',   12.70, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Berufskolleg Teilzeit', 41.64, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)'),
  ((SELECT id FROM schuljahre WHERE bezeichnung='2025/2026'), 'Berufskolleg Vollzeit', 16.18, '§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)')
ON CONFLICT (schuljahr_id, schulform_typ) DO NOTHING;

-- ------------------------------------------------------------
-- 6. ZUSCHLAGSARTEN
-- ------------------------------------------------------------
INSERT INTO zuschlag_arten (bezeichnung, beschreibung, ist_standard, sortierung) VALUES
  ('Leitungszeit (Schulleitung)',           'Leitungszeit fuer Schulleitung',                 true,  1),
  ('Integration',                            'Gemeinsames Lernen / Inklusion',                 true,  2),
  ('KAoA',                                   'Kein Abschluss ohne Anschluss',                  true,  3),
  ('Digitalisierungsbeauftragter',           'Digitalisierungsbeauftragter',                   true,  4),
  ('Teilnahme an Schulleiterqualifikation',  'SLQ-Zuschlag',                                   false, 5),
  ('Ganztagszuschlag',                       'Nur bei Refinanzierungszusage',                  false, 6),
  ('Unterrichtsmehrbedarf',                  'Sonderpaed. Foerderung etc.',                    false, 7),
  ('Ausgleichsbedarf',                       'Gem. Bewirtschaftungserlass',                    false, 8)
ON CONFLICT (bezeichnung) DO NOTHING;

-- ------------------------------------------------------------
-- 7. REGELDEPUTATE
-- ------------------------------------------------------------
INSERT INTO regeldeputate (schulform_code, schulform_name, regeldeputat, rechtsgrundlage, bass_fundstelle, gueltig_ab, bemerkung) VALUES
  ('GES', 'Gesamtschule',         25.5, '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', 'Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)'),
  ('GYM', 'Gymnasium',             25.5, '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', 'Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)'),
  ('BK',  'Berufskolleg',          25.5, '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', 'Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)'),
  ('GSH', 'Grundschule Herford',   28.0, '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', NULL),
  ('GSM', 'Grundschule Minden',    28.0, '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', NULL),
  ('GSS', 'Grundschule Stemwede',  28.0, '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', NULL)
ON CONFLICT (schulform_code) DO NOTHING;

-- ------------------------------------------------------------
-- 8. BEISPIEL-SCHUELERZAHLEN
-- ------------------------------------------------------------
INSERT INTO schuelerzahlen (schule_id, schul_stufe_id, stichtag, anzahl, erfasst_von) VALUES
  ((SELECT id FROM schulen WHERE kurzname='GES'),
   (SELECT s.id FROM schul_stufen s JOIN schulen sc ON s.schule_id=sc.id WHERE sc.kurzname='GES' AND s.stufe='Sek I'),
   '2023-10-15', 530, 'Seed'),
  ((SELECT id FROM schulen WHERE kurzname='GES'),
   (SELECT s.id FROM schul_stufen s JOIN schulen sc ON s.schule_id=sc.id WHERE sc.kurzname='GES' AND s.stufe='Sek I'),
   '2024-10-15', 569, 'Seed'),
  ((SELECT id FROM schulen WHERE kurzname='GYM'),
   (SELECT s.id FROM schul_stufen s JOIN schulen sc ON s.schule_id=sc.id WHERE sc.kurzname='GYM' AND s.stufe='Sek I'),
   '2023-10-15', 457, 'Seed'),
  ((SELECT id FROM schulen WHERE kurzname='GYM'),
   (SELECT s.id FROM schul_stufen s JOIN schulen sc ON s.schule_id=sc.id WHERE sc.kurzname='GYM' AND s.stufe='Sek I'),
   '2024-10-15', 455, 'Seed')
ON CONFLICT (schule_id, schul_stufe_id, stichtag) DO NOTHING;

-- ------------------------------------------------------------
-- 9. ADMIN-BENUTZER
--    Passwort: Admin2026!  (bitte nach 1. Login aendern)
-- ------------------------------------------------------------
INSERT INTO benutzer (email, passwort_hash, name, rolle, aktiv) VALUES
  ('admin@fes-credo.de',
   '$2b$12$MVuu88Q9qiF.lu8xT4TKlOxV1ctSFUoUSzQt1EM/eDsCbWxTUtmsy',
   'Administrator', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- ------------------------------------------------------------
-- 10. STATISTIK-CODES (NRW-Standard)
-- ------------------------------------------------------------
INSERT INTO statistik_codes (code, bezeichnung, gruppe, ist_teilzeit, sortierung) VALUES
  ('L',  'Beamter auf Lebenszeit (Vollzeit)',     'beamter',      false, 10),
  ('LT', 'Beamter auf Lebenszeit (Teilzeit)',     'beamter',      true,  20),
  ('P',  'Beamter auf Probe (Vollzeit)',          'beamter',      false, 30),
  ('PT', 'Beamter auf Probe (Teilzeit)',          'beamter',      true,  40),
  ('U',  'Angestellter unbefristet (Vollzeit)',   'angestellter', false, 50),
  ('UT', 'Angestellter unbefristet (Teilzeit)',   'angestellter', true,  60),
  ('B',  'Angestellter befristet (Vollzeit)',     'angestellter', false, 70),
  ('BT', 'Angestellter befristet (Teilzeit)',     'angestellter', true,  80)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 11. STELLENARTEN (NRW-Recht)
-- ------------------------------------------------------------
-- Typ A — Stellenzuschlaege (Anlage 2a Abschnitt 2)
INSERT INTO stellenart_typen (bezeichnung, kurzbezeichnung, kuerzel, beschreibung, rechtsgrundlage, typ, bindungstyp, ist_isoliert, anlage2a, erhoeht_pauschale, parametrisierbar, schulform_filter, ist_standard, sortierung) VALUES
  ('Ganztagsunterricht 20 %', 'GT20', 'GT20', '20 % Aufschlag auf den Grundstellenbedarf bei genehmigtem gebundenem Ganztagsbetrieb', '§ 9 Abs. 1 VO zu § 93 Abs. 2 SchulG; BASS 11-11 Nr. 1', 'A', 'schule', false, true, true, false, NULL, true, 10),
  ('Ganztagsunterricht 30 %', 'GT30', 'GT30', '30 % Aufschlag auf den Grundstellenbedarf bei erweitertem Ganztagsbetrieb (Foerderschulen)', '§ 9 Abs. 1 VO zu § 93 Abs. 2 SchulG; BASS 11-11 Nr. 1', 'A', 'schule', false, true, true, false, NULL, true, 11),
  ('Schulleitungsentlastung (Leitungszeit)', 'SLE', 'SLE', 'Leitungszeit: 9 WStd Grund + 0,7 WStd je Planstelle bis 50. + 0,3 ab 51. Stelle; GS +2 WStd', '§ 5 VO zu § 93 Abs. 2 SchulG (AVO-RL); BASS 11-11 Nr. 1', 'A', 'schule', false, true, true, false, NULL, true, 12),
  ('KAoA – Kein Abschluss ohne Anschluss', 'KAoA', 'KAoA', 'Berufliche Orientierung: Anrechnungsstunden je Schule abhaengig von Jahrgangsklassen 8/9/10', 'Gesonderter Jahreserlass MSB; BASS 11-11 Nr. 1', 'A', 'schule', false, true, true, true, NULL, true, 13),
  ('Gemeinsames Lernen Sockel', 'GL-S', 'GL-S', '1,0 Stelle pauschal je Schule mit genehmigtem Gemeinsamem Lernen (Sockelausstattung)', '§ 3a Abs. 1 FESchVO; BASS 11-11 Nr. 1', 'A', 'schule', false, true, true, false, NULL, true, 14),
  ('Gemeinsames Lernen je Schueler', 'GL-K', 'GL-K', 'Anteilige Stellen je Schueler mit sonderpaed. Foerderbedarf im GL (Schluessel je Förderschwerpunkt)', '§ 3a Abs. 1 FESchVO', 'A', 'schule', false, true, true, true, NULL, true, 15),
  ('LES-Stellenbudget Sockel', 'LES-S', 'LES-S', 'Fester Sockelbetrag je Schule fuer Lern-/Entwicklungsstoerungen (LE, ES, SQ)', '§ 3a FESchVO; Anlage 7 FESchVO', 'A', 'schule', false, true, true, true, NULL, true, 16),
  ('LES-Stellenbudget je Schueler', 'LES-K', 'LES-K', 'Anteilige Stellen je Schueler mit LES-Foerderbedarf (Schluessel aus Bewirtschaftungserlass)', '§ 3a FESchVO; Anlage 7 FESchVO', 'A', 'schule', false, true, true, true, NULL, true, 17),
  ('Sozialpaedagogische Fachkraft', 'SPF', 'SPF', 'Mind. 0,5 Stellen je Grundschule mit genehmigtem Gemeinsamem Lernen', '§ 3a Abs. 1 FESchVO', 'A', 'schule', false, true, true, false, '["GS"]'::jsonb, true, 18),
  ('Personal- und Schwerbehindertenvertretung', 'SBV', 'SBV', 'Anrechnungsstunden fuer gewaehlte SBV; Umrechnung in Stellen nach Regelstundenmass', '§ 3 Abs. 1 FESchVO i.V.m. SGB IX', 'A', 'person', false, true, true, false, NULL, true, 19),
  ('Beratungslehrkraefte', 'BL', 'BL', '1 Anrechnungsstunde je angefangene 200 Schueler; max. 5 Std. je Beratungslehrkraft', 'BASS 12-21 Nr. 4', 'A', 'person', false, true, true, false, NULL, true, 20),
  ('Anrechnungsstunden (Lehrerrat, Gleichstellung u.a.)', 'ANR', 'ANR', '0,4-1,2 Std. je Stelle je Schulform (Lehrerrat, Gleichstellungsbeauftragte, Fortbildung, Sicherheit)', '§ 2 Abs. 5 VO zu § 93 Abs. 2 SchulG (AVO-RL)', 'A', 'schule', false, true, true, true, NULL, true, 21),
  ('Deutschfoerderung / DaZ (Seiteneinsteiger)', 'DAZ', 'DAZ', 'Stellen je genehmigter Intensivklasse oder Foerdergruppe', 'BASS 13-63 Nr. 3', 'A', 'schule', false, true, true, true, NULL, true, 22),
  ('Muttersprachlicher Unterricht', 'MSU', 'MSU', 'Stellen je genehmigtem Herkunftssprachenkurs (HSU)', 'AVO-RL (BASS 11-11 Nr. 1); BASS 13-63 Nr. 2', 'A', 'schule', false, true, true, false, NULL, true, 23),
  ('Unterrichtsmehrbedarf', 'UMB', 'UMB', 'Genereller Unterrichtsmehrbedarf gemaess jaehrlichem Bewirtschaftungserlass', '§ 107 Abs. 1 SchulG NRW', 'A', 'schule', false, true, true, true, NULL, true, 24),
  ('Ausgleichsbedarf', 'AGL', 'AGL', 'Ausgleich gemaess jaehrlichem Bewirtschaftungserlass', '§ 107 Abs. 1 SchulG NRW', 'A', 'schule', false, true, true, true, NULL, true, 25),
  ('Sonstige gesetzliche Tatbestaende', 'SONST-A', 'SONST-A2', 'Sammelposition fuer weitere gesetzliche Unterrichtsbedarfe (Abschnitt 2 Anlage 2a)', '§ 3 FESchVO i.V.m. AVO-RL', 'A', 'beides', false, true, true, false, NULL, true, 29),

-- Typ A_106 — Sonderbedarfe § 106 Abs. 10 (Abschnitt 4, isoliert)
  ('Digitalisierungsbeauftragter', 'DIGI', 'DIGI', 'Anrechnungsstunden fuer den Digitalisierungsbeauftragten der Schule (auf Antrag)', '§ 106 Abs. 10 SchulG; BASS 11-02 (Digitalisierungserlass)', 'A_106', 'person', true, true, false, false, NULL, true, 40),
  ('Schulleitungsqualifikation (SLQ)', 'SLQ', 'SLQ', '1 Anrechnungsstunde je Teilnehmer waehrend der Qualifikationsmassnahme (befristet)', 'BASS 21-02 Nr. 7; § 106 Abs. 10 SchulG', 'A_106', 'person', true, true, false, false, NULL, true, 41),
  ('Sonderzuschlag LES (§ 106 Abs. 10)', 'LES-10', 'LES-10', 'Stellen je Bewilligungsbescheid — nur wenn regulaerer LES-Zuschlag nicht ausreicht', '§ 106 Abs. 10 SchulG; Anlage 7 FESchVO', 'A_106', 'schule', true, true, false, false, NULL, true, 42),
  ('Fachleiterbonus (LAA-Betreuung)', 'FLB', 'FLB', 'Anrechnungsstunden je betreutem Lehramtsanwaerter (nur anerkannte Ausbildungsschule)', '§ 106 Abs. 10 SchulG; AVO-RL Anlage', 'A_106', 'person', true, true, false, false, NULL, true, 43),
  ('Einsatz im oeffentlichen Schuldienst', 'OEF', 'OEF', 'Stellen je Abordnungsumfang (Nachweis der Abordnung erforderlich)', '§ 106 Abs. 10 Satz 2 SchulG', 'A_106', 'person', true, true, false, false, NULL, true, 44),
  ('Bilinguale Angebote / Modellversuche', 'BIL', 'BIL', 'Stellen je Bewilligungsbescheid (genehmigte Modellversuche durch MSB)', '§ 106 Abs. 10 SchulG', 'A_106', 'schule', true, true, false, false, NULL, true, 45),
  ('Vertretungsbedarf', 'VTR', 'VTR', 'Stellen je Bewilligungsbescheid (zeitlich befristet, nur bei nicht kompensierbarem Ausfall)', '§ 106 Abs. 10 SchulG; VVzFESchVO Nr. 3.1.2', 'A_106', 'schule', true, true, false, false, NULL, true, 46),
  ('Zusatzbeihilfe (sonstiger Sonderbedarf)', 'ZB', 'ZB', 'Sonderstellen im Einzelfall, befristet max. 5 Jahre, Ermessensentscheidung der BR', '§ 106 Abs. 10 SchulG i.V.m. § 2 Abs. 5 FESchVO', 'A_106', 'beides', true, true, false, false, NULL, true, 49),

-- Typ B — Wahlleistung "Geld oder Stelle"
  ('Geld oder Stelle: Paed. Uebermittagsbetreuung Sek I', 'GOS Sek I', 'GOS-SEK1', 'Traeger waehlt: Stelle (0,3-0,6 VZE) ODER EUR-Betrag (20.200-40.300 EUR). Wahl fuer Schuljahr bindend.', 'BASS 11-02 Nr. 24', 'B', 'schule', false, false, false, true, NULL, true, 60),
  ('Geld oder Stelle: Gebundener Ganztag Sek I', 'GOS GT', 'GOS-GT-SEK1', 'Erhoehte Betraege fuer Sek I mit gebundenem Ganztagsbetrieb. Nicht kombinierbar mit GT20/GT30.', 'BASS 11-02 Nr. 24; BASS 12-63 Nr. 2', 'B', 'schule', false, false, false, true, NULL, true, 61),

-- Typ C — Reine Geldleistungen
  ('Dreizehn Plus (13+)', '13+', '13PLUS', 'Foerderung paed. Betreuung nach dem Unterricht (ab 13 Uhr, mind. 4 Tage/Woche). Nur GS ohne Ganztag.', 'BASS 11-02 Nr. 9 (Runderlass 31.07.2008)', 'C', 'schule', false, false, false, false, '["GS"]'::jsonb, true, 80),
  ('Schule von acht bis eins', '8bis1', '8BIS1', 'Foerderung paed. Betreuung vor dem Unterricht (ab 8:00 Uhr). Nur GS ohne Ganztag.', 'BASS 11-02 Nr. 9', 'C', 'schule', false, false, false, false, '["GS"]'::jsonb, true, 81),
  ('Silentien', 'Silen', 'SILEN', 'Individuelle Foerderung in Kleingruppen (Deutsch/Mathe), mind. 12 Wochen a 3 WStd. Nur GS in soz. Brennpunkten.', 'BASS 11-02 Nr. 9', 'C', 'schule', false, false, false, false, '["GS"]'::jsonb, true, 82),
  ('Versorgungszuschuss', 'VZS', 'VZS', 'Zuschuss fuer beamtete Lehrkraefte mit Versorgungsanspruechen. Gesonderter Antrag vor Versorgungsfall.', '§ 107 Abs. 5 SchulG; FESchVO', 'C', 'schule', false, false, false, false, NULL, true, 83)
ON CONFLICT (bezeichnung) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'schulen'         AS tabelle, COUNT(*) AS rows FROM schulen
UNION ALL SELECT 'schul_stufen',     COUNT(*) FROM schul_stufen
UNION ALL SELECT 'schuljahre',       COUNT(*) FROM schuljahre
UNION ALL SELECT 'haushaltsjahre',   COUNT(*) FROM haushaltsjahre
UNION ALL SELECT 'slr_werte',        COUNT(*) FROM slr_werte
UNION ALL SELECT 'zuschlag_arten',   COUNT(*) FROM zuschlag_arten
UNION ALL SELECT 'regeldeputate',    COUNT(*) FROM regeldeputate
UNION ALL SELECT 'schuelerzahlen',   COUNT(*) FROM schuelerzahlen
UNION ALL SELECT 'benutzer',         COUNT(*) FROM benutzer
UNION ALL SELECT 'statistik_codes',  COUNT(*) FROM statistik_codes
UNION ALL SELECT 'stellenart_typen', COUNT(*) FROM stellenart_typen
ORDER BY tabelle;
