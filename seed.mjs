/**
 * Production Seed-Script (JavaScript, kein TypeScript noetig).
 *
 * Ausfuehren im Container:
 *   docker exec stellenist-app node seed.mjs
 *
 * Nutzt nur `postgres` und `bcryptjs` — beide im Standalone-Build garantiert.
 */

import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function seed() {
  console.log("=== Stellenistberechnung Seed ===\n");

  // ============================================================
  // 1. SCHULEN
  // ============================================================
  console.log("1. Schulen anlegen...");
  const schulen = await sql`
    INSERT INTO schulen (schulnummer, name, kurzname, untis_code, schulform, adresse, plz, ort, farbe)
    VALUES
      ('195182', 'Freie Evangelische Gesamtschule Minden', 'GES', 'GES', 'Gesamtschule', 'Kingsleyallee 5', '32425', 'Minden', '#6BAA24'),
      ('196083', 'Freies Evangelisches Gymnasium Minden', 'GYM', 'GYM', 'Gymnasium', 'Kingsleyallee 6', '32425', 'Minden', '#FBC900'),
      ('100166', 'Freies Evangelisches Berufskolleg Minden', 'BK', 'BK', 'Berufskolleg', 'Kingsleyallee 6', '32425', 'Minden', '#5C82A5'),
      ('195054', 'Grundschule Stemwede', 'GSS', NULL, 'Grundschule', NULL, NULL, NULL, '#ad1928'),
      ('195844', 'Grundschule Minderheide', 'GSM', NULL, 'Grundschule', NULL, NULL, NULL, '#e2001a'),
      ('194608', 'Grundschule Haddenhausen', 'GSH', NULL, 'Grundschule', NULL, NULL, NULL, '#509ac6')
    ON CONFLICT (schulnummer) DO NOTHING
    RETURNING id, kurzname
  `;
  const sid = Object.fromEntries(schulen.map((s) => [s.kurzname, s.id]));
  console.log(`   ${schulen.map((s) => s.kurzname).join(", ")}`);

  // ============================================================
  // 2. SCHUL-STUFEN
  // ============================================================
  console.log("2. Schul-Stufen anlegen...");
  await sql`
    INSERT INTO schul_stufen (schule_id, stufe, schulform_typ) VALUES
      (${sid.GES}, 'Sek I',       'Gesamtschule Sek I'),
      (${sid.GES}, 'Sek II',      'Gesamtschule Sek II'),
      (${sid.GYM}, 'Sek I',       'Gymnasium Sek I (G9)'),
      (${sid.GYM}, 'Sek II',      'Gymnasium Sek II'),
      (${sid.BK},  'Vollzeit',    'Berufskolleg Vollzeit'),
      (${sid.GSS}, 'Primarstufe', 'Grundschule'),
      (${sid.GSM}, 'Primarstufe', 'Grundschule'),
      (${sid.GSH}, 'Primarstufe', 'Grundschule')
    ON CONFLICT (schule_id, stufe) DO NOTHING
  `;

  // ============================================================
  // 3. SCHULJAHRE
  // ============================================================
  console.log("3. Schuljahre anlegen...");
  const schuljahre = await sql`
    INSERT INTO schuljahre (bezeichnung, start_datum, end_datum) VALUES
      ('2023/2024', '2023-08-01', '2024-07-31'),
      ('2024/2025', '2024-08-01', '2025-07-31'),
      ('2025/2026', '2025-08-01', '2026-07-31')
    ON CONFLICT (bezeichnung) DO NOTHING
    RETURNING id, bezeichnung
  `;
  const sjMap = Object.fromEntries(schuljahre.map((s) => [s.bezeichnung, s.id]));

  // ============================================================
  // 4. HAUSHALTSJAHRE
  // ============================================================
  console.log("4. Haushaltsjahre anlegen...");
  await sql`
    INSERT INTO haushaltsjahre (jahr, stichtag_vorjahr, stichtag_laufend) VALUES
      (2024, '2023-10-15', '2024-10-15'),
      (2025, '2024-10-15', '2025-10-15'),
      (2026, '2025-10-15', '2026-10-15')
    ON CONFLICT (jahr) DO NOTHING
  `;

  // ============================================================
  // 5. SLR-WERTE 2025/2026
  // ============================================================
  console.log("5. SLR-Werte 2025/2026 anlegen...");
  const sj2526Id = sjMap["2025/2026"];
  const quelle = "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)";
  await sql`
    INSERT INTO slr_werte (schuljahr_id, schulform_typ, relation, quelle) VALUES
      (${sj2526Id}, 'Grundschule',             '21.95', ${quelle}),
      (${sj2526Id}, 'Hauptschule',             '17.86', ${quelle}),
      (${sj2526Id}, 'Realschule',              '20.19', ${quelle}),
      (${sj2526Id}, 'Sekundarschule',          '16.27', ${quelle}),
      (${sj2526Id}, 'Gymnasium Sek I (G8)',    '19.17', ${quelle}),
      (${sj2526Id}, 'Gymnasium Sek I (G9)',    '19.87', ${quelle}),
      (${sj2526Id}, 'Gymnasium Sek II',        '12.70', ${quelle}),
      (${sj2526Id}, 'Gesamtschule Sek I',     '18.63', ${quelle}),
      (${sj2526Id}, 'Gesamtschule Sek II',    '12.70', ${quelle}),
      (${sj2526Id}, 'Berufskolleg Teilzeit',   '41.64', ${quelle}),
      (${sj2526Id}, 'Berufskolleg Vollzeit',   '16.18', ${quelle})
    ON CONFLICT (schuljahr_id, schulform_typ) DO NOTHING
  `;

  // ============================================================
  // 6. ZUSCHLAGSARTEN (Legacy — fuer Abwaertskompatibilitaet)
  // ============================================================
  console.log("6. Zuschlagsarten anlegen...");
  await sql`
    INSERT INTO zuschlag_arten (bezeichnung, beschreibung, ist_standard, sortierung) VALUES
      ('Leitungszeit (Schulleitung)', 'Leitungszeit fuer Schulleitung', true, 1),
      ('Integration', 'Gemeinsames Lernen / Inklusion', true, 2),
      ('KAoA', 'Kein Abschluss ohne Anschluss', true, 3),
      ('Digitalisierungsbeauftragter', 'Digitalisierungsbeauftragter', true, 4),
      ('Teilnahme an Schulleiterqualifikation', 'SLQ-Zuschlag', false, 5),
      ('Ganztagszuschlag', 'Nur bei Refinanzierungszusage', false, 6),
      ('Unterrichtsmehrbedarf', 'Sonderpaed. Foerderung etc.', false, 7),
      ('Ausgleichsbedarf', 'Gem. Bewirtschaftungserlass', false, 8)
    ON CONFLICT (bezeichnung) DO NOTHING
  `;

  // ============================================================
  // 7. REGELDEPUTATE
  // ============================================================
  console.log("7. Regeldeputate anlegen...");
  await sql`
    INSERT INTO regeldeputate (schulform_code, schulform_name, regeldeputat, rechtsgrundlage, bass_fundstelle, gueltig_ab, bemerkung) VALUES
      ('GES', 'Gesamtschule',          '25.5', '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', 'Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)'),
      ('GYM', 'Gymnasium',             '25.5', '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', 'Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)'),
      ('BK',  'Berufskolleg',          '25.5', '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', 'Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)'),
      ('GSH', 'Grundschule Herford',   '28.0', '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', NULL),
      ('GSM', 'Grundschule Minden',    '28.0', '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', NULL),
      ('GSS', 'Grundschule Stemwede',  '28.0', '§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW', 'BASS 11-11 Nr. 1', '2025-05-13', NULL)
    ON CONFLICT (schulform_code) DO NOTHING
  `;

  // ============================================================
  // 8. STELLENART-TYPEN (NRW-Drei-Typen-Modell)
  // ============================================================
  console.log("8. Stellenart-Typen anlegen...");

  const stellenarten = [
    // --- TYP A: Stellenzuschlaege (Abschnitt 2, erhoeht Pauschale) ---
    { bezeichnung: "Ganztagsunterricht 20 %", kb: "GT20", kz: "GT20", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 10, beschreibung: "20 % Aufschlag auf den Grundstellenbedarf bei genehmigtem gebundenem Ganztagsbetrieb", rg: "§ 9 Abs. 1 VO zu § 93 Abs. 2 SchulG; BASS 11-11 Nr. 1" },
    { bezeichnung: "Ganztagsunterricht 30 %", kb: "GT30", kz: "GT30", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 11, beschreibung: "30 % Aufschlag auf den Grundstellenbedarf bei erweitertem Ganztagsbetrieb (Foerderschulen)", rg: "§ 9 Abs. 1 VO zu § 93 Abs. 2 SchulG; BASS 11-11 Nr. 1" },
    { bezeichnung: "Schulleitungsentlastung (Leitungszeit)", kb: "SLE", kz: "SLE", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 12, beschreibung: "Leitungszeit: 9 WStd Grund + 0,7 WStd je Planstelle bis 50. + 0,3 ab 51. Stelle; GS +2 WStd", rg: "§ 5 VO zu § 93 Abs. 2 SchulG (AVO-RL); BASS 11-11 Nr. 1" },
    { bezeichnung: "KAoA – Kein Abschluss ohne Anschluss", kb: "KAoA", kz: "KAoA", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 13, beschreibung: "Berufliche Orientierung: Anrechnungsstunden je Schule abhaengig von Jahrgangsklassen 8/9/10", rg: "Gesonderter Jahreserlass MSB; BASS 11-11 Nr. 1" },
    { bezeichnung: "Gemeinsames Lernen Sockel", kb: "GL-S", kz: "GL-S", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 14, beschreibung: "1,0 Stelle pauschal je Schule mit genehmigtem Gemeinsamem Lernen (Sockelausstattung)", rg: "§ 3a Abs. 1 FESchVO; BASS 11-11 Nr. 1" },
    { bezeichnung: "Gemeinsames Lernen je Schueler", kb: "GL-K", kz: "GL-K", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 15, beschreibung: "Anteilige Stellen je Schueler mit sonderpaed. Foerderbedarf im GL (Schluessel je Foerderschwerpunkt)", rg: "§ 3a Abs. 1 FESchVO" },
    { bezeichnung: "LES-Stellenbudget Sockel", kb: "LES-S", kz: "LES-S", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 16, beschreibung: "Fester Sockelbetrag je Schule fuer Lern-/Entwicklungsstoerungen (LE, ES, SQ)", rg: "§ 3a FESchVO; Anlage 7 FESchVO" },
    { bezeichnung: "LES-Stellenbudget je Schueler", kb: "LES-K", kz: "LES-K", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 17, beschreibung: "Anteilige Stellen je Schueler mit LES-Foerderbedarf (Schluessel aus Bewirtschaftungserlass)", rg: "§ 3a FESchVO; Anlage 7 FESchVO" },
    { bezeichnung: "Sozialpaedagogische Fachkraft", kb: "SPF", kz: "SPF", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: false, sf: '["GS"]', sort: 18, beschreibung: "Mind. 0,5 Stellen je Grundschule mit genehmigtem Gemeinsamem Lernen", rg: "§ 3a Abs. 1 FESchVO" },
    { bezeichnung: "Personal- und Schwerbehindertenvertretung", kb: "SBV", kz: "SBV", typ: "A", bt: "person", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 19, beschreibung: "Anrechnungsstunden fuer gewaehlte SBV; Umrechnung in Stellen nach Regelstundenmass", rg: "§ 3 Abs. 1 FESchVO i.V.m. SGB IX" },
    { bezeichnung: "Beratungslehrkraefte", kb: "BL", kz: "BL", typ: "A", bt: "person", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 20, beschreibung: "1 Anrechnungsstunde je angefangene 200 Schueler; max. 5 Std. je Beratungslehrkraft", rg: "BASS 12-21 Nr. 4" },
    { bezeichnung: "Anrechnungsstunden (Lehrerrat, Gleichstellung u.a.)", kb: "ANR", kz: "ANR", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 21, beschreibung: "0,4-1,2 Std. je Stelle je Schulform (Lehrerrat, Gleichstellungsbeauftragte, Fortbildung, Sicherheit)", rg: "§ 2 Abs. 5 VO zu § 93 Abs. 2 SchulG (AVO-RL)" },
    { bezeichnung: "Deutschfoerderung / DaZ (Seiteneinsteiger)", kb: "DAZ", kz: "DAZ", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 22, beschreibung: "Stellen je genehmigter Intensivklasse oder Foerdergruppe", rg: "BASS 13-63 Nr. 3" },
    { bezeichnung: "Muttersprachlicher Unterricht", kb: "MSU", kz: "MSU", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 23, beschreibung: "Stellen je genehmigtem Herkunftssprachenkurs (HSU)", rg: "AVO-RL (BASS 11-11 Nr. 1); BASS 13-63 Nr. 2" },
    { bezeichnung: "Unterrichtsmehrbedarf", kb: "UMB", kz: "UMB", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 24, beschreibung: "Genereller Unterrichtsmehrbedarf gemaess jaehrlichem Bewirtschaftungserlass", rg: "§ 107 Abs. 1 SchulG NRW" },
    { bezeichnung: "Ausgleichsbedarf", kb: "AGL", kz: "AGL", typ: "A", bt: "schule", iso: false, a2a: true, ep: true, par: true, sf: null, sort: 25, beschreibung: "Ausgleich gemaess jaehrlichem Bewirtschaftungserlass", rg: "§ 107 Abs. 1 SchulG NRW" },
    { bezeichnung: "Sonstige gesetzliche Tatbestaende", kb: "SONST-A", kz: "SONST-A2", typ: "A", bt: "beides", iso: false, a2a: true, ep: true, par: false, sf: null, sort: 29, beschreibung: "Sammelposition fuer weitere gesetzliche Unterrichtsbedarfe (Abschnitt 2 Anlage 2a)", rg: "§ 3 FESchVO i.V.m. AVO-RL" },

    // --- TYP A_106: Sonderbedarfe § 106 Abs. 10 (Abschnitt 4, isoliert) ---
    { bezeichnung: "Digitalisierungsbeauftragter", kb: "DIGI", kz: "DIGI", typ: "A_106", bt: "person", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 40, beschreibung: "Anrechnungsstunden fuer den Digitalisierungsbeauftragten der Schule (auf Antrag)", rg: "§ 106 Abs. 10 SchulG; BASS 11-02 (Digitalisierungserlass)" },
    { bezeichnung: "Schulleitungsqualifikation (SLQ)", kb: "SLQ", kz: "SLQ", typ: "A_106", bt: "person", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 41, beschreibung: "1 Anrechnungsstunde je Teilnehmer waehrend der Qualifikationsmassnahme (befristet)", rg: "BASS 21-02 Nr. 7; § 106 Abs. 10 SchulG" },
    { bezeichnung: "Sonderzuschlag LES (§ 106 Abs. 10)", kb: "LES-10", kz: "LES-10", typ: "A_106", bt: "schule", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 42, beschreibung: "Stellen je Bewilligungsbescheid — nur wenn regulaerer LES-Zuschlag nicht ausreicht", rg: "§ 106 Abs. 10 SchulG; Anlage 7 FESchVO" },
    { bezeichnung: "Fachleiterbonus (LAA-Betreuung)", kb: "FLB", kz: "FLB", typ: "A_106", bt: "person", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 43, beschreibung: "Anrechnungsstunden je betreutem Lehramtsanwaerter (nur anerkannte Ausbildungsschule)", rg: "§ 106 Abs. 10 SchulG; AVO-RL Anlage" },
    { bezeichnung: "Einsatz im oeffentlichen Schuldienst", kb: "OEF", kz: "OEF", typ: "A_106", bt: "person", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 44, beschreibung: "Stellen je Abordnungsumfang (Nachweis der Abordnung erforderlich)", rg: "§ 106 Abs. 10 Satz 2 SchulG" },
    { bezeichnung: "Bilinguale Angebote / Modellversuche", kb: "BIL", kz: "BIL", typ: "A_106", bt: "schule", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 45, beschreibung: "Stellen je Bewilligungsbescheid (genehmigte Modellversuche durch MSB)", rg: "§ 106 Abs. 10 SchulG" },
    { bezeichnung: "Vertretungsbedarf", kb: "VTR", kz: "VTR", typ: "A_106", bt: "schule", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 46, beschreibung: "Stellen je Bewilligungsbescheid (zeitlich befristet, nur bei nicht kompensierbarem Ausfall)", rg: "§ 106 Abs. 10 SchulG; VVzFESchVO Nr. 3.1.2" },
    { bezeichnung: "Zusatzbeihilfe (sonstiger Sonderbedarf)", kb: "ZB", kz: "ZB", typ: "A_106", bt: "beides", iso: true, a2a: true, ep: false, par: false, sf: null, sort: 49, beschreibung: "Sonderstellen im Einzelfall, befristet max. 5 Jahre, Ermessensentscheidung der BR", rg: "§ 106 Abs. 10 SchulG i.V.m. § 2 Abs. 5 FESchVO" },

    // --- TYP B: Wahlleistung Geld oder Stelle ---
    { bezeichnung: "Geld oder Stelle: Paed. Uebermittagsbetreuung Sek I", kb: "GOS Sek I", kz: "GOS-SEK1", typ: "B", bt: "schule", iso: false, a2a: false, ep: false, par: true, sf: null, sort: 60, beschreibung: "Traeger waehlt: Stelle (0,3-0,6 VZE) ODER EUR-Betrag (20.200-40.300 EUR). Wahl fuer Schuljahr bindend.", rg: "BASS 11-02 Nr. 24" },
    { bezeichnung: "Geld oder Stelle: Gebundener Ganztag Sek I", kb: "GOS GT", kz: "GOS-GT-SEK1", typ: "B", bt: "schule", iso: false, a2a: false, ep: false, par: true, sf: null, sort: 61, beschreibung: "Erhoehte Betraege fuer Sek I mit gebundenem Ganztagsbetrieb. Nicht kombinierbar mit GT20/GT30.", rg: "BASS 11-02 Nr. 24; BASS 12-63 Nr. 2" },

    // --- TYP C: Reine Geldleistungen ---
    { bezeichnung: "Dreizehn Plus (13+)", kb: "13+", kz: "13PLUS", typ: "C", bt: "schule", iso: false, a2a: false, ep: false, par: false, sf: '["GS"]', sort: 80, beschreibung: "Foerderung paed. Betreuung nach dem Unterricht (ab 13 Uhr, mind. 4 Tage/Woche). Nur GS ohne Ganztag.", rg: "BASS 11-02 Nr. 9 (Runderlass 31.07.2008)" },
    { bezeichnung: "Schule von acht bis eins", kb: "8bis1", kz: "8BIS1", typ: "C", bt: "schule", iso: false, a2a: false, ep: false, par: false, sf: '["GS"]', sort: 81, beschreibung: "Foerderung paed. Betreuung vor dem Unterricht (ab 8:00 Uhr). Nur GS ohne Ganztag.", rg: "BASS 11-02 Nr. 9" },
    { bezeichnung: "Silentien", kb: "Silen", kz: "SILEN", typ: "C", bt: "schule", iso: false, a2a: false, ep: false, par: false, sf: '["GS"]', sort: 82, beschreibung: "Individuelle Foerderung in Kleingruppen (Deutsch/Mathe), mind. 12 Wochen a 3 WStd. Nur GS in soz. Brennpunkten.", rg: "BASS 11-02 Nr. 9" },
    { bezeichnung: "Versorgungszuschuss", kb: "VZS", kz: "VZS", typ: "C", bt: "schule", iso: false, a2a: false, ep: false, par: false, sf: null, sort: 83, beschreibung: "Zuschuss fuer beamtete Lehrkraefte mit Versorgungsanspruechen. Gesonderter Antrag vor Versorgungsfall.", rg: "§ 107 Abs. 5 SchulG; FESchVO" },
  ];

  for (const sa of stellenarten) {
    await sql`
      INSERT INTO stellenart_typen
        (bezeichnung, kurzbezeichnung, kuerzel, beschreibung, rechtsgrundlage,
         typ, bindungstyp, ist_isoliert, anlage2a, erhoeht_pauschale,
         parametrisierbar, schulform_filter, ist_standard, sortierung, aktiv)
      VALUES
        (${sa.bezeichnung}, ${sa.kb}, ${sa.kz}, ${sa.beschreibung}, ${sa.rg},
         ${sa.typ}, ${sa.bt}, ${sa.iso}, ${sa.a2a}, ${sa.ep},
         ${sa.par}, ${sa.sf ? sql`${sa.sf}::jsonb` : null}, true, ${sa.sort}, true)
      ON CONFLICT (bezeichnung) DO NOTHING
    `;
  }
  console.log(`   ${stellenarten.length} Stellenarten eingefuegt`);

  // ============================================================
  // 9. BEISPIEL-SCHUELERZAHLEN
  // ============================================================
  console.log("9. Beispiel-Schuelerzahlen anlegen...");
  const stufen = await sql`SELECT id, schule_id, stufe FROM schul_stufen`;
  const findStufe = (schuleId, stufe) =>
    stufen.find((s) => s.schule_id === schuleId && s.stufe === stufe);

  const gesSekI = findStufe(sid.GES, "Sek I");
  const gymSekI = findStufe(sid.GYM, "Sek I");

  if (gesSekI && gymSekI) {
    await sql`
      INSERT INTO schuelerzahlen (schule_id, schul_stufe_id, stichtag, anzahl, erfasst_von) VALUES
        (${sid.GES}, ${gesSekI.id}, '2023-10-15', 530, 'Seed'),
        (${sid.GES}, ${gesSekI.id}, '2024-10-15', 569, 'Seed'),
        (${sid.GYM}, ${gymSekI.id}, '2023-10-15', 457, 'Seed'),
        (${sid.GYM}, ${gymSekI.id}, '2024-10-15', 455, 'Seed')
      ON CONFLICT (schule_id, schul_stufe_id, stichtag) DO NOTHING
    `;
  }

  // ============================================================
  // 10. ADMIN-BENUTZER
  // ============================================================
  console.log("10. Admin-Benutzer anlegen...");
  const adminHash = await bcrypt.hash("Admin2026!", 12);
  await sql`
    INSERT INTO benutzer (email, passwort_hash, name, rolle, aktiv)
    VALUES ('admin@fes-credo.de', ${adminHash}, 'Administrator', 'admin', true)
    ON CONFLICT (email) DO NOTHING
  `;
  console.log("    Admin: admin@fes-credo.de / Admin2026!");

  console.log("\n=== Seed abgeschlossen! ===");
}

try {
  await seed();
} catch (err) {
  console.error("Seed-Fehler:", err);
  process.exit(1);
} finally {
  await sql.end();
}
