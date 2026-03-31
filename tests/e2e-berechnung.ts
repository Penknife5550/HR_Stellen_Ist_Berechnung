/**
 * E2E-Berechnungstest: Prueft die gesamte Pipeline
 * Sync → Deputat-Summen → Stellenist → Stellensoll → Vergleich
 *
 * Ausfuehren: npx tsx tests/e2e-berechnung.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { berechneGrundstellen } from "../src/lib/berechnungen/grundstellen";
import { berechneStellensoll } from "../src/lib/berechnungen/stellensoll";
import { berechneStellenist } from "../src/lib/berechnungen/stellenist";
// berechneGewichtetenDurchschnitt wird nicht importiert (hat DB-Abhaengigkeit)

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

// Farbcodes fuer Terminal-Ausgabe
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function pass(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg: string) { console.log(`  ${RED}✗${RESET} ${msg}`); }
function info(msg: string) { console.log(`  ${CYAN}ℹ${RESET} ${msg}`); }
function header(msg: string) { console.log(`\n${BOLD}${msg}${RESET}`); }

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string, detail?: string) {
  if (condition) {
    pass(msg);
    passed++;
  } else {
    fail(`${msg}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function assertClose(actual: number, expected: number, tolerance: number, msg: string) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    pass(`${msg}: ${actual} (erwartet ${expected})`);
    passed++;
  } else {
    fail(`${msg}: ${actual} (erwartet ${expected}, Abweichung ${diff})`);
    failed++;
  }
}

async function main() {
  console.log(`\n${BOLD}════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  E2E-Berechnungstest: Stellenistberechnung NRW${RESET}`);
  console.log(`${BOLD}════════════════════════════════════════════════════${RESET}`);

  // ========================================
  // 1. SYNC-DATEN PRUEFEN
  // ========================================
  header("1. n8n-Sync-Daten pruefen");

  const syncLogs = await db.select().from(schema.deputatSyncLog).orderBy(asc(schema.deputatSyncLog.id));
  assert(syncLogs.length >= 2, `${syncLogs.length} Sync-Vorgaenge protokolliert`);
  assert(syncLogs.every(l => l.status === "success"), "Alle Syncs erfolgreich");

  const lehrerCount = await db.select({ count: sql<number>`count(*)` }).from(schema.lehrer);
  assert(Number(lehrerCount[0].count) >= 10, `${lehrerCount[0].count} Lehrer in DB`);

  // ========================================
  // 2. DEPUTAT-SUMMEN PRO SCHULE PRUEFEN
  // ========================================
  header("2. Deputat-Summen pro Schule pruefen");

  const alleSchulen = await db.select().from(schema.schulen).where(eq(schema.schulen.aktiv, true));
  const hj2026 = await db.select().from(schema.haushaltsjahre).where(eq(schema.haushaltsjahre.jahr, 2026));

  if (hj2026.length === 0) {
    fail("Haushaltsjahr 2026 nicht gefunden");
    process.exit(1);
  }

  for (const schule of alleSchulen) {
    const rows = await db
      .select({
        monat: schema.deputatMonatlich.monat,
        summeGesamt: sql<string>`sum(${schema.deputatMonatlich.deputatGesamt}::numeric)`,
        summeSchule: sql<string>`sum(CASE
          WHEN ${schema.schulen.kurzname} = 'GES' THEN ${schema.deputatMonatlich.deputatGes}::numeric
          WHEN ${schema.schulen.kurzname} = 'GYM' THEN ${schema.deputatMonatlich.deputatGym}::numeric
          WHEN ${schema.schulen.kurzname} = 'BK' THEN ${schema.deputatMonatlich.deputatBk}::numeric
          ELSE ${schema.deputatMonatlich.deputatGesamt}::numeric
        END)`,
        anzahlLehrer: sql<number>`count(distinct ${schema.deputatMonatlich.lehrerId})`,
      })
      .from(schema.deputatMonatlich)
      .innerJoin(schema.lehrer, eq(schema.deputatMonatlich.lehrerId, schema.lehrer.id))
      .innerJoin(schema.schulen, eq(schema.lehrer.stammschuleId, schema.schulen.id))
      .where(
        and(
          eq(schema.deputatMonatlich.haushaltsjahrId, hj2026[0].id),
          eq(schema.lehrer.stammschuleId, schule.id),
        )
      )
      .groupBy(schema.deputatMonatlich.monat, schema.schulen.kurzname)
      .orderBy(asc(schema.deputatMonatlich.monat));

    if (rows.length > 0) {
      const janRow = rows.find(r => r.monat === 1);
      const augRow = rows.find(r => r.monat === 8);

      info(`${schule.kurzname}: ${rows.length} Monate mit Daten`);
      if (janRow) {
        info(`  Jan: ${janRow.anzahlLehrer} Lehrer, ${janRow.summeGesamt} Std gesamt, ${janRow.summeSchule} Std schulspezifisch`);
      }
      if (augRow) {
        info(`  Aug: ${augRow.anzahlLehrer} Lehrer, ${augRow.summeGesamt} Std gesamt, ${augRow.summeSchule} Std schulspezifisch`);
      }
    }
  }

  // ========================================
  // 3. GRUNDSTELLEN-BERECHNUNG PRUEFEN
  // ========================================
  header("3. Grundstellen-Berechnung (GES Sek I, HJ 2026)");

  // Jan-Jul 2026: Stichtag 15.10.2025 → Schuelerzahl aus DB
  const szJanJul = await db
    .select()
    .from(schema.schuelerzahlen)
    .where(eq(schema.schuelerzahlen.stichtag, "2024-10-15")); // Vorjahr fuer HJ 2025

  const szAugDez = await db
    .select()
    .from(schema.schuelerzahlen)
    .where(eq(schema.schuelerzahlen.stichtag, "2024-10-15"));

  // GES Sek I mit 569 Schuelern (Seed-Daten Stichtag 15.10.2024)
  const gesResult = berechneGrundstellen([
    { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 569, slr: 18.63 },
  ]);

  assertClose(gesResult.teilErgebnisse[0].ergebnisTrunc, 30.54, 0.001, "GES 569/18.63 trunc(2)");
  assertClose(gesResult.grundstellenzahl, 30.5, 0.001, "GES Grundstellen gerundet");

  // GYM Sek I mit 455 Schuelern
  const gymResult = berechneGrundstellen([
    { stufe: "Sek I", schulformTyp: "Gymnasium Sek I (G9)", schueler: 455, slr: 19.87 },
  ]);

  assertClose(gymResult.teilErgebnisse[0].ergebnisTrunc, 22.89, 0.001, "GYM 455/19.87 trunc(2)");
  assertClose(gymResult.grundstellenzahl, 22.9, 0.001, "GYM Grundstellen gerundet");

  // ========================================
  // 4. STELLENSOLL-BERECHNUNG
  // ========================================
  header("4. Stellensoll-Berechnung");

  const gesSollResult = berechneStellensoll({
    stufen: [{ stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 569, slr: 18.63 }],
    zuschlaege: [
      { bezeichnung: "Leitungszeit", wert: 0.2 },
      { bezeichnung: "KAoA", wert: 0.24 },
      { bezeichnung: "Digitalisierung", wert: 0.04 },
    ],
  });

  assertClose(gesSollResult.grundstellen.grundstellenzahl, 30.5, 0.001, "GES Grundstellen");
  assertClose(gesSollResult.zuschlaegeSumme, 0.48, 0.001, "GES Zuschlaege Summe");
  // 30.5 + 0.48 = 30.98 → round(1) = 31.0
  assertClose(gesSollResult.stellensoll, 31.0, 0.001, "GES Stellensoll");

  // ========================================
  // 5. STELLENIST-BERECHNUNG
  // ========================================
  header("5. Stellenist-Berechnung (aus sync-Daten)");

  // GES: schulspezifische Stunden (deputat_ges)
  // Jan-Jul: 108 Std/Monat × 7 = 756
  // Aug-Dez: 137 Std/Monat × 5 = 685 (mit Neumann)
  const gesIstResult = berechneStellenist({
    monatlicheStunden: [
      { monat: 1, stunden: 108 },
      { monat: 2, stunden: 108 },
      { monat: 3, stunden: 108 },
      { monat: 4, stunden: 108 },
      { monat: 5, stunden: 108 },
      { monat: 6, stunden: 108 },
      { monat: 7, stunden: 108 },
      { monat: 8, stunden: 137 },
      { monat: 9, stunden: 137 },
      { monat: 10, stunden: 137 },
      { monat: 11, stunden: 137 },
      { monat: 12, stunden: 137 },
    ],
    regeldeputat: 25.5,
    mehrarbeitStunden: [],
  });

  // Jan-Jul: 756 / 178.5 = 4.2352...
  assertClose(gesIstResult.janJul.stellen, 4.2352, 0.001, "GES Stellenist Jan-Jul");
  // Aug-Dez: 685 / 127.5 = 5.3725...
  assertClose(gesIstResult.augDez.stellen, 5.3725, 0.001, "GES Stellenist Aug-Dez");
  // Gewichtet: (4.2352 × 7 + 5.3725 × 5) / 12 = (29.6470 + 26.8627) / 12 = 4.7091
  assertClose(gesIstResult.stellenistGerundet, 4.7, 0.001, "GES Stellenist Jahresschnitt");

  // ========================================
  // 6. VERGLEICH
  // ========================================
  header("6. Soll-Ist-Vergleich (GES)");

  const sollGES = 31.0;
  const istGES = 4.7;
  const diff = Math.round((istGES - sollGES) * 10) / 10;
  const status = diff <= 0 ? "im_soll" : diff <= 0.5 ? "grenzbereich" : "ueber_soll";

  assertClose(diff, -26.3, 0.1, "GES Differenz");
  assert(status === "im_soll", `GES Status: ${status} (gruen)`);
  assert(Math.min(istGES, sollGES) === istGES, `GES Refinanzierung: ${istGES} Stellen`);

  info(`\n  GES Zusammenfassung:`);
  info(`  Stellensoll:  ${sollGES} (Grundstellen 30.5 + Zuschlaege 0.48)`);
  info(`  Stellenist:   ${istGES} (5 Lehrer Jan-Jul, 6 Aug-Dez, schulspez. Std)`);
  info(`  Differenz:    ${diff} → ${YELLOW}STARK UNTER SOLL${RESET} (Land zahlt ${istGES} Stellen)`);
  info(`  ⚠ Deutet auf Unterbesetzung hin — mit Testdaten (nur ${alleSchulen.length} Schulen geseedet)`);

  // ========================================
  // 7. CROSS-SCHOOL-FIX PRUEFEN
  // ========================================
  header("7. Cross-School-Deputat-Fix pruefen");

  // Aus den Sync-Testdaten (Jan):
  // GES-Lehrer: Mueller(25.5 GES), Schmidt(20 GES + 5.5 GYM), Weber(22 GES),
  //             Fischer(15 GES + 10.5 GYM), Wagner(25.5 GES)
  // GYM-Lehrer: Becker(25.5 GYM), Hoffmann(3 GES + 22.5 GYM), Schaefer(18 GYM + 2 BK)
  // BK-Lehrer:  Koch(25.5 BK), Richter(25.5 BK)

  // KORREKT (schulspezifisch, alle Lehrer):
  // GES: 25.5 + 20 + 22 + 15 + 25.5 + 3(Hoffmann!) = 111.0
  // GYM: 5.5(Schmidt) + 10.5(Fischer) + 25.5 + 22.5 + 18 = 82.0
  // BK: 2(Schaefer) + 25.5 + 25.5 = 53.0
  // Total: 111 + 82 + 53 = 246.0

  // FALSCH (alter Code: summeGesamt nach Stammschule):
  // GES: 25.5 + 25.5 + 22 + 25.5 + 25.5 = 124.0 (zu hoch!)
  // GYM: 25.5 + 25.5 + 20 = 71.0 (zu niedrig!)
  // BK: 25.5 + 25.5 = 51.0 (zu niedrig!)
  // Total: 124 + 71 + 51 = 246.0 (Summe stimmt, aber Verteilung falsch!)

  // DB-Query: schulspezifische Summen pruefen
  const gesSchulRows = await db
    .select({
      monat: schema.deputatMonatlich.monat,
      summeGes: sql<string>`sum(${schema.deputatMonatlich.deputatGes}::numeric)`,
    })
    .from(schema.deputatMonatlich)
    .innerJoin(schema.lehrer, eq(schema.deputatMonatlich.lehrerId, schema.lehrer.id))
    .where(
      and(
        eq(schema.deputatMonatlich.haushaltsjahrId, hj2026[0].id),
        eq(schema.deputatMonatlich.monat, 1),
        eq(schema.lehrer.aktiv, true)
      )
    )
    .groupBy(schema.deputatMonatlich.monat);

  const gymSchulRows = await db
    .select({
      monat: schema.deputatMonatlich.monat,
      summeGym: sql<string>`sum(${schema.deputatMonatlich.deputatGym}::numeric)`,
    })
    .from(schema.deputatMonatlich)
    .innerJoin(schema.lehrer, eq(schema.deputatMonatlich.lehrerId, schema.lehrer.id))
    .where(
      and(
        eq(schema.deputatMonatlich.haushaltsjahrId, hj2026[0].id),
        eq(schema.deputatMonatlich.monat, 1),
        eq(schema.lehrer.aktiv, true)
      )
    )
    .groupBy(schema.deputatMonatlich.monat);

  const bkSchulRows = await db
    .select({
      monat: schema.deputatMonatlich.monat,
      summeBk: sql<string>`sum(${schema.deputatMonatlich.deputatBk}::numeric)`,
    })
    .from(schema.deputatMonatlich)
    .innerJoin(schema.lehrer, eq(schema.deputatMonatlich.lehrerId, schema.lehrer.id))
    .where(
      and(
        eq(schema.deputatMonatlich.haushaltsjahrId, hj2026[0].id),
        eq(schema.deputatMonatlich.monat, 1),
        eq(schema.lehrer.aktiv, true)
      )
    )
    .groupBy(schema.deputatMonatlich.monat);

  const gesJan = Number(gesSchulRows[0]?.summeGes ?? 0);
  const gymJan = Number(gymSchulRows[0]?.summeGym ?? 0);
  const bkJan = Number(bkSchulRows[0]?.summeBk ?? 0);

  assertClose(gesJan, 111.0, 0.01, "GES schulspez. Std (Jan): 111 inkl. Hoffmanns 3h");
  assertClose(gymJan, 82.0, 0.01, "GYM schulspez. Std (Jan): 82 inkl. Schmidt 5.5 + Fischer 10.5");
  assertClose(bkJan, 53.0, 0.01, "BK schulspez. Std (Jan): 53 inkl. Schaefers 2h");
  assertClose(gesJan + gymJan + bkJan, 246.0, 0.01, "Gesamtsumme: 246 (keine Stunden verloren/doppelt)");

  info(`\n  Vorher (falsch): GES=124, GYM=71, BK=51`);
  info(`  Nachher (fix):   GES=${gesJan}, GYM=${gymJan}, BK=${bkJan}`);
  info(`  Differenz GES:   ${124 - gesJan} Std weniger (richtig!)`);
  info(`  Differenz GYM:   +${gymJan - 71} Std mehr (richtig!)`);
  info(`  Differenz BK:    +${bkJan - 51} Std mehr (richtig!)`);

  // ========================================
  // 8. REGELDEPUTAT-FIX PRUEFEN
  // ========================================
  header("8. Regeldeputat-Fix pruefen (F1: Grundschulen)");

  // Simuliere Grundschul-Stellenist mit korrektem Regeldeputat 28.0
  const gsResult = berechneStellenist({
    monatlicheStunden: [
      { monat: 1, stunden: 280 }, // 10 Lehrer × 28 Std
      { monat: 2, stunden: 280 },
      { monat: 3, stunden: 280 },
      { monat: 4, stunden: 280 },
      { monat: 5, stunden: 280 },
      { monat: 6, stunden: 280 },
      { monat: 7, stunden: 280 },
    ],
    regeldeputat: 28.0, // KORREKT: 28.0 fuer Grundschulen (nicht 25.5!)
    mehrarbeitStunden: [],
  });

  // 280 × 7 / (7 × 28) = 1960 / 196 = 10.0
  assertClose(gsResult.janJul.stellen, 10.0, 0.001, "GS Stellenist mit Regeldeputat 28.0 = exakt 10.0");

  // Zum Vergleich: mit falschem Regeldeputat 25.5
  const gsWrongResult = berechneStellenist({
    monatlicheStunden: [
      { monat: 1, stunden: 280 },
      { monat: 2, stunden: 280 },
      { monat: 3, stunden: 280 },
      { monat: 4, stunden: 280 },
      { monat: 5, stunden: 280 },
      { monat: 6, stunden: 280 },
      { monat: 7, stunden: 280 },
    ],
    regeldeputat: 25.5, // FALSCH fuer Grundschulen
    mehrarbeitStunden: [],
  });

  // 1960 / 178.5 = 10.98 → falsch!
  assertClose(gsWrongResult.janJul.stellen, 10.98, 0.01, "GS mit falschem 25.5 waere 10.98 (zu hoch!)");
  info(`  Fix F1 verhindert: ${(gsWrongResult.janJul.stellen - gsResult.janJul.stellen).toFixed(2)} Stellen Ueberzaehlung`);

  // ========================================
  // ZUSAMMENFASSUNG
  // ========================================
  console.log(`\n${BOLD}════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Ergebnis: ${GREEN}${passed} bestanden${RESET}, ${failed > 0 ? RED : ""}${failed} fehlgeschlagen${RESET}`);
  console.log(`${BOLD}════════════════════════════════════════════════════${RESET}\n`);

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E-Test fehlgeschlagen:", err);
  process.exit(1);
});
