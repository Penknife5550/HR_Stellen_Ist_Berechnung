/**
 * Seed-Script: Fuellt die Datenbank mit Ausgangsdaten.
 *
 * Ausfuehren: npx tsx src/db/seed.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Starte Seed-Vorgang...");

  // ============================================================
  // 1. SCHULEN
  // ============================================================
  console.log("1. Schulen anlegen...");
  const [ges, gym, bk, gss, gsm, gsh] = await db
    .insert(schema.schulen)
    .values([
      {
        schulnummer: "195182",
        name: "Freie Evangelische Gesamtschule Minden",
        kurzname: "GES",
        untisCode: "GES",
        schulform: "Gesamtschule",
        adresse: "Kingsleyallee 5",
        plz: "32425",
        ort: "Minden",
        farbe: "#6BAA24",
      },
      {
        schulnummer: "196083",
        name: "Freies Evangelisches Gymnasium Minden",
        kurzname: "GYM",
        untisCode: "GYM",
        schulform: "Gymnasium",
        adresse: "Kingsleyallee 6",
        plz: "32425",
        ort: "Minden",
        farbe: "#FBC900",
      },
      {
        schulnummer: "100166",
        name: "Freies Evangelisches Berufskolleg Minden",
        kurzname: "BK",
        untisCode: "BK",
        schulform: "Berufskolleg",
        adresse: "Kingsleyallee 6",
        plz: "32425",
        ort: "Minden",
        farbe: "#5C82A5",
      },
      {
        schulnummer: "195054",
        name: "Grundschule Stemwede",
        kurzname: "GSS",
        schulform: "Grundschule",
        farbe: "#ad1928",
      },
      {
        schulnummer: "195844",
        name: "Grundschule Minderheide",
        kurzname: "GSM",
        schulform: "Grundschule",
        farbe: "#e2001a",
      },
      {
        schulnummer: "194608",
        name: "Grundschule Haddenhausen",
        kurzname: "GSH",
        schulform: "Grundschule",
        farbe: "#509ac6",
      },
    ])
    .returning();

  console.log(`   ${ges.kurzname}, ${gym.kurzname}, ${bk.kurzname}, ${gss.kurzname}, ${gsm.kurzname}, ${gsh.kurzname}`);

  // ============================================================
  // 2. SCHUL-STUFEN
  // ============================================================
  console.log("2. Schul-Stufen anlegen...");
  await db.insert(schema.schulStufen).values([
    { schuleId: ges.id, stufe: "Sek I", schulformTyp: "Gesamtschule Sek I" },
    { schuleId: ges.id, stufe: "Sek II", schulformTyp: "Gesamtschule Sek II" },
    { schuleId: gym.id, stufe: "Sek I", schulformTyp: "Gymnasium Sek I (G9)" },
    { schuleId: gym.id, stufe: "Sek II", schulformTyp: "Gymnasium Sek II" },
    { schuleId: bk.id, stufe: "Vollzeit", schulformTyp: "Berufskolleg Vollzeit" },
    { schuleId: gss.id, stufe: "Primarstufe", schulformTyp: "Grundschule" },
    { schuleId: gsm.id, stufe: "Primarstufe", schulformTyp: "Grundschule" },
    { schuleId: gsh.id, stufe: "Primarstufe", schulformTyp: "Grundschule" },
  ]);

  // ============================================================
  // 3. SCHULJAHRE
  // ============================================================
  console.log("3. Schuljahre anlegen...");
  const [sj2324, sj2425, sj2526] = await db
    .insert(schema.schuljahre)
    .values([
      {
        bezeichnung: "2023/2024",
        startDatum: "2023-08-01",
        endDatum: "2024-07-31",
      },
      {
        bezeichnung: "2024/2025",
        startDatum: "2024-08-01",
        endDatum: "2025-07-31",
      },
      {
        bezeichnung: "2025/2026",
        startDatum: "2025-08-01",
        endDatum: "2026-07-31",
      },
    ])
    .returning();

  // ============================================================
  // 4. HAUSHALTSJAHRE
  // ============================================================
  console.log("4. Haushaltsjahre anlegen...");
  await db.insert(schema.haushaltsjahre).values([
    { jahr: 2024, stichtagVorjahr: "2023-10-15", stichtagLaufend: "2024-10-15" },
    { jahr: 2025, stichtagVorjahr: "2024-10-15", stichtagLaufend: "2025-10-15" },
    { jahr: 2026, stichtagVorjahr: "2025-10-15", stichtagLaufend: "2026-10-15" },
  ]);

  // ============================================================
  // 5. SLR-WERTE 2025/2026
  // ============================================================
  console.log("5. SLR-Werte 2025/2026 anlegen...");
  await db.insert(schema.slrWerte).values([
    { schuljahrId: sj2526.id, schulformTyp: "Grundschule", relation: "21.95", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Hauptschule", relation: "17.86", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Realschule", relation: "20.19", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Sekundarschule", relation: "16.27", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Gymnasium Sek I (G8)", relation: "19.17", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Gymnasium Sek I (G9)", relation: "19.87", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Gymnasium Sek II", relation: "12.70", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Gesamtschule Sek I", relation: "18.63", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Gesamtschule Sek II", relation: "12.70", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Berufskolleg Teilzeit", relation: "41.64", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
    { schuljahrId: sj2526.id, schulformTyp: "Berufskolleg Vollzeit", relation: "16.18", quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)" },
  ]);

  // ============================================================
  // 6. ZUSCHLAGSARTEN
  // ============================================================
  console.log("6. Zuschlagsarten anlegen...");
  await db.insert(schema.zuschlagArten).values([
    { bezeichnung: "Leitungszeit (Schulleitung)", beschreibung: "Leitungszeit fuer Schulleitung", istStandard: true, sortierung: 1 },
    { bezeichnung: "Integration", beschreibung: "Gemeinsames Lernen / Inklusion", istStandard: true, sortierung: 2 },
    { bezeichnung: "KAoA", beschreibung: "Kein Abschluss ohne Anschluss", istStandard: true, sortierung: 3 },
    { bezeichnung: "Digitalisierungsbeauftragter", beschreibung: "Digitalisierungsbeauftragter", istStandard: true, sortierung: 4 },
    { bezeichnung: "Teilnahme an Schulleiterqualifikation", beschreibung: "SLQ-Zuschlag", istStandard: false, sortierung: 5 },
    { bezeichnung: "Ganztagszuschlag", beschreibung: "Nur bei Refinanzierungszusage", istStandard: false, sortierung: 6 },
    { bezeichnung: "Unterrichtsmehrbedarf", beschreibung: "Sonderpaed. Foerderung etc.", istStandard: false, sortierung: 7 },
    { bezeichnung: "Ausgleichsbedarf", beschreibung: "Gem. Bewirtschaftungserlass", istStandard: false, sortierung: 8 },
  ]);

  // ============================================================
  // 6b. REGELDEPUTATE
  // ============================================================
  console.log("6b. Regeldeputate anlegen...");
  await db.insert(schema.regeldeputate).values([
    {
      schulformCode: "GES",
      schulformName: "Gesamtschule",
      regeldeputat: "25.5",
      rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
      bassFundstelle: "BASS 11-11 Nr. 1",
      gueltigAb: "2025-05-13",
      bemerkung: "Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)",
    },
    {
      schulformCode: "GYM",
      schulformName: "Gymnasium",
      regeldeputat: "25.5",
      rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
      bassFundstelle: "BASS 11-11 Nr. 1",
      gueltigAb: "2025-05-13",
      bemerkung: "Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)",
    },
    {
      schulformCode: "BK",
      schulformName: "Berufskolleg",
      regeldeputat: "25.5",
      rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
      bassFundstelle: "BASS 11-11 Nr. 1",
      gueltigAb: "2025-05-13",
      bemerkung: "Auf-/Abrundung ueber 3 Schuljahre (§ 2 Abs. 1 Satz 2)",
    },
    {
      schulformCode: "GSH",
      schulformName: "Grundschule Haddenhausen",
      regeldeputat: "28.0",
      rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
      bassFundstelle: "BASS 11-11 Nr. 1",
      gueltigAb: "2025-05-13",
    },
    {
      schulformCode: "GSM",
      schulformName: "Grundschule Minden",
      regeldeputat: "28.0",
      rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
      bassFundstelle: "BASS 11-11 Nr. 1",
      gueltigAb: "2025-05-13",
    },
    {
      schulformCode: "GSS",
      schulformName: "Grundschule Stemwede",
      regeldeputat: "28.0",
      rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
      bassFundstelle: "BASS 11-11 Nr. 1",
      gueltigAb: "2025-05-13",
    },
  ]);

  // ============================================================
  // 7. BEISPIEL-SCHUELERZAHLEN (aus Excel)
  // ============================================================
  console.log("7. Beispiel-Schuelerzahlen anlegen...");

  // Stufen-IDs holen
  const stufenRows = await db.select().from(schema.schulStufen);
  const findStufe = (schuleId: number, stufe: string) =>
    stufenRows.find((s) => s.schuleId === schuleId && s.stufe === stufe)!;

  const gesSekI = findStufe(ges.id, "Sek I");
  const gesSekII = findStufe(ges.id, "Sek II");
  const gymSekI = findStufe(gym.id, "Sek I");
  const gymSekII = findStufe(gym.id, "Sek II");

  await db.insert(schema.schuelerzahlen).values([
    // GES - Stichtag 15.10.2023
    { schuleId: ges.id, schulStufeId: gesSekI.id, stichtag: "2023-10-15", anzahl: 530, erfasstVon: "Seed" },
    // GES - Stichtag 15.10.2024
    { schuleId: ges.id, schulStufeId: gesSekI.id, stichtag: "2024-10-15", anzahl: 569, erfasstVon: "Seed" },
    // GYM - Stichtag 15.10.2023
    { schuleId: gym.id, schulStufeId: gymSekI.id, stichtag: "2023-10-15", anzahl: 457, erfasstVon: "Seed" },
    // GYM - Stichtag 15.10.2024
    { schuleId: gym.id, schulStufeId: gymSekI.id, stichtag: "2024-10-15", anzahl: 455, erfasstVon: "Seed" },
  ]);

  // ============================================================
  // 8. INITIAL-ADMIN
  // ============================================================
  console.log("8. Admin-Benutzer anlegen...");
  const bcrypt = await import("bcryptjs");
  const adminHash = await bcrypt.hash("Admin2026!", 12);
  await db.insert(schema.benutzer).values({
    email: "admin@fes-credo.de",
    passwortHash: adminHash,
    name: "Administrator",
    rolle: "admin",
    aktiv: true,
  });
  console.log("   Admin: admin@fes-credo.de (Passwort siehe Dokumentation)");

  console.log("\nSeed-Vorgang abgeschlossen!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
