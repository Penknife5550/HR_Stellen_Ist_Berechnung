/**
 * Seed-Script: Regeldeputate nach NRW-Recht einfuegen.
 *
 * Ausfuehren: npx tsx src/db/seed-regeldeputate.ts
 *
 * Rechtsgrundlage: § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW (BASS 11-11 Nr. 1)
 * Verordnung vom 13. Mai 2025 (GV. NRW. 2025 S. 444)
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

const REGELDEPUTATE_DATEN = [
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
    schulformName: "Grundschule Herford",
    regeldeputat: "28.0",
    rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
    bassFundstelle: "BASS 11-11 Nr. 1",
    gueltigAb: "2025-05-13",
    bemerkung: null,
  },
  {
    schulformCode: "GSM",
    schulformName: "Grundschule Minden",
    regeldeputat: "28.0",
    rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
    bassFundstelle: "BASS 11-11 Nr. 1",
    gueltigAb: "2025-05-13",
    bemerkung: null,
  },
  {
    schulformCode: "GSS",
    schulformName: "Grundschule Stemwede",
    regeldeputat: "28.0",
    rechtsgrundlage: "§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW",
    bassFundstelle: "BASS 11-11 Nr. 1",
    gueltigAb: "2025-05-13",
    bemerkung: null,
  },
];

async function seedRegeldeputate() {
  console.log("Regeldeputate einfuegen...\n");

  for (const rd of REGELDEPUTATE_DATEN) {
    await db
      .insert(schema.regeldeputate)
      .values(rd)
      .onConflictDoUpdate({
        target: [schema.regeldeputate.schulformCode],
        set: {
          schulformName: rd.schulformName,
          regeldeputat: rd.regeldeputat,
          rechtsgrundlage: rd.rechtsgrundlage,
          bassFundstelle: rd.bassFundstelle,
          gueltigAb: rd.gueltigAb,
          bemerkung: rd.bemerkung,
        },
      });

    console.log(
      `   ${rd.schulformCode}: ${rd.regeldeputat} Std/Woche (${rd.schulformName})`
    );
  }

  console.log("\nRegeldeputate erfolgreich eingefuegt!");
  process.exit(0);
}

seedRegeldeputate().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
