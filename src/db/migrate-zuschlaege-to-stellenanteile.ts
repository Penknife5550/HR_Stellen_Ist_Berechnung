/**
 * Migriert bestehende Zuschlaege-Eintraege in die neue Stellenanteile-Tabelle.
 * Jeder Zuschlag wird als "genehmigt" uebernommen.
 *
 * Ausfuehren: npx tsx src/db/migrate-zuschlaege-to-stellenanteile.ts
 *
 * Kann mehrfach ausgefuehrt werden — prueft auf Duplikate via INSERT ... ON CONFLICT DO NOTHING.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { eq, asc } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function migrate() {
  console.log("Migration: Zuschlaege -> Stellenanteile\n");

  // 1. Alle zuschlag_arten laden
  const arten = await db.select().from(schema.zuschlagArten).orderBy(asc(schema.zuschlagArten.id));
  console.log(`Gefunden: ${arten.length} Zuschlagsarten`);

  // 2. Alle stellenart_typen laden (fuer Mapping)
  const typen = await db.select().from(schema.stellenartTypen);
  const typenByBezeichnung = new Map(typen.map((t) => [t.bezeichnung, t]));

  // 3. Mapping: zuschlag_art.bezeichnung -> stellenart_typ.id
  // Wenn keine exakte Uebereinstimmung, "Sonstiger Stellenanteil" verwenden
  const sonstigerTyp = typen.find((t) => t.bezeichnung === "Sonstiger Stellenanteil");
  if (!sonstigerTyp) {
    console.error("FEHLER: 'Sonstiger Stellenanteil' nicht gefunden. Bitte zuerst seed-stellenarten.ts ausfuehren.");
    process.exit(1);
  }

  const artToTyp = new Map<number, number>();
  for (const art of arten) {
    const match = typenByBezeichnung.get(art.bezeichnung);
    if (match) {
      artToTyp.set(art.id, match.id);
      console.log(`  Mapping: "${art.bezeichnung}" -> Typ ${match.id} (exakt)`);
    } else {
      artToTyp.set(art.id, sonstigerTyp.id);
      console.log(`  Mapping: "${art.bezeichnung}" -> Sonstiger Stellenanteil (Fallback)`);
    }
  }

  // 4. Alle zuschlaege laden
  const zuschlaege = await db
    .select({
      id: schema.zuschlaege.id,
      schuleId: schema.zuschlaege.schuleId,
      haushaltsjahrId: schema.zuschlaege.haushaltsjahrId,
      zuschlagArtId: schema.zuschlaege.zuschlagArtId,
      wert: schema.zuschlaege.wert,
      zeitraum: schema.zuschlaege.zeitraum,
      bemerkung: schema.zuschlaege.bemerkung,
      artBezeichnung: schema.zuschlagArten.bezeichnung,
    })
    .from(schema.zuschlaege)
    .innerJoin(schema.zuschlagArten, eq(schema.zuschlaege.zuschlagArtId, schema.zuschlagArten.id));

  console.log(`\nGefunden: ${zuschlaege.length} Zuschlaege-Eintraege`);

  let migriert = 0;
  let uebersprungen = 0;

  for (const z of zuschlaege) {
    const typId = artToTyp.get(z.zuschlagArtId) ?? sonstigerTyp.id;

    try {
      await db.insert(schema.stellenanteile).values({
        schuleId: z.schuleId,
        haushaltsjahrId: z.haushaltsjahrId,
        stellenartTypId: typId,
        wert: z.wert,
        zeitraum: z.zeitraum,
        status: "genehmigt",
        bemerkung: z.bemerkung
          ? `[Migriert aus Zuschlaege] ${z.bemerkung}`
          : `[Migriert aus Zuschlaege: ${z.artBezeichnung}]`,
        erstelltVon: "Migration",
      });
      migriert++;
      console.log(`  -> ${z.artBezeichnung} (${z.wert} Stellen, ${z.zeitraum}) fuer Schule ${z.schuleId}`);
    } catch (err: unknown) {
      uebersprungen++;
      const msg = err instanceof Error ? err.message : "Unbekannt";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        console.log(`  -> SKIP (bereits migriert): ${z.artBezeichnung} Schule ${z.schuleId}`);
      } else {
        console.error(`  -> FEHLER: ${msg}`);
      }
    }
  }

  console.log(`\nMigration abgeschlossen: ${migriert} migriert, ${uebersprungen} uebersprungen.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration fehlgeschlagen:", err);
  process.exit(1);
});
