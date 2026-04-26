/**
 * Seed-Script: Statistik-Codes nach NRW-Standard.
 *
 * Codes-Schema: Buchstabe = Rechtsverhaeltnis, +T = Teilzeit.
 *   L  = Beamter auf Lebenszeit            U  = Angestellter unbefristet (TV-L)
 *   P  = Beamter auf Probe                 B  = Angestellter befristet (TV-L)
 *   ...T = Teilzeit-Variante
 *
 * Sortierung haelt Beamte-Block (10-40) vor Angestellten-Block (50-80) —
 * im Export bestimmt MIN(sortierung) je Gruppe die Gruppen-Reihenfolge.
 *
 * Codes sind via /einstellungen/statistik-codes erweiterbar (z.B. Referendare).
 *
 * Ausfuehren: npx tsx src/db/seed-statistik-codes.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

type StatistikCodeSeed = {
  code: string;
  bezeichnung: string;
  gruppe: "beamter" | "angestellter";
  istTeilzeit: boolean;
  sortierung: number;
};

const STATISTIK_CODES: StatistikCodeSeed[] = [
  // Beamte (10-40)
  { code: "L",  bezeichnung: "Beamter auf Lebenszeit (Vollzeit)", gruppe: "beamter",      istTeilzeit: false, sortierung: 10 },
  { code: "LT", bezeichnung: "Beamter auf Lebenszeit (Teilzeit)", gruppe: "beamter",      istTeilzeit: true,  sortierung: 20 },
  { code: "P",  bezeichnung: "Beamter auf Probe (Vollzeit)",      gruppe: "beamter",      istTeilzeit: false, sortierung: 30 },
  { code: "PT", bezeichnung: "Beamter auf Probe (Teilzeit)",      gruppe: "beamter",      istTeilzeit: true,  sortierung: 40 },
  // Angestellte TV-L (50-80)
  { code: "U",  bezeichnung: "Angestellter unbefristet (Vollzeit)", gruppe: "angestellter", istTeilzeit: false, sortierung: 50 },
  { code: "UT", bezeichnung: "Angestellter unbefristet (Teilzeit)", gruppe: "angestellter", istTeilzeit: true,  sortierung: 60 },
  { code: "B",  bezeichnung: "Angestellter befristet (Vollzeit)",   gruppe: "angestellter", istTeilzeit: false, sortierung: 70 },
  { code: "BT", bezeichnung: "Angestellter befristet (Teilzeit)",   gruppe: "angestellter", istTeilzeit: true,  sortierung: 80 },
];

async function seedStatistikCodes() {
  console.log("Seed: Statistik-Codes (NRW-Standard)\n");
  console.log(`  ${STATISTIK_CODES.length} Codes werden angelegt/aktualisiert\n`);

  for (const sc of STATISTIK_CODES) {
    await db
      .insert(schema.statistikCodes)
      .values(sc)
      .onConflictDoUpdate({
        target: [schema.statistikCodes.code],
        set: {
          bezeichnung: sc.bezeichnung,
          gruppe: sc.gruppe,
          istTeilzeit: sc.istTeilzeit,
          sortierung: sc.sortierung,
          updatedAt: new Date(),
        },
      });

    const tzLabel = sc.istTeilzeit ? "TZ" : "VZ";
    const grpLabel = sc.gruppe === "beamter" ? "Beamter      " : "Angestellter ";
    console.log(`   [${sc.code.padEnd(2)}] ${grpLabel} ${tzLabel}  ${sc.bezeichnung}`);
  }

  console.log("\nStatistik-Codes erfolgreich eingefuegt/aktualisiert!");
  process.exit(0);
}

seedStatistikCodes().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
