/**
 * Seed-Script: Standard-Stellenarten nach NRW-Recht.
 *
 * Ausfuehren: npx tsx src/db/seed-stellenarten.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const STELLENARTEN = [
  {
    bezeichnung: "Personalbedarfspauschale",
    kurzbezeichnung: "PBP",
    beschreibung: "2 % des Grundstellenbedarfs fuer ueberplanmaessigen Vertretungsbedarf",
    rechtsgrundlage: "§ 107 Abs. 3 Nr. 1 SchulG NRW",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 1,
  },
  {
    bezeichnung: "Personalnebenkostenpauschale",
    kurzbezeichnung: "PNP",
    beschreibung: "0,5 % des Grundstellenbedarfs fuer Personalnebenkosten",
    rechtsgrundlage: "§ 107 Abs. 3 Nr. 2 SchulG NRW",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 2,
  },
  {
    bezeichnung: "Ganztagszuschlag",
    kurzbezeichnung: "GT",
    beschreibung: "Erhoehung des Grundstellenbedarfs bei genehmigtem Ganztagsbetrieb",
    rechtsgrundlage: "§ 3 Abs. 1 Satz 3 FESchVO",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 3,
  },
  {
    bezeichnung: "LES-Stellenbudget",
    kurzbezeichnung: "LES",
    beschreibung: "Stellenbudget fuer Lern- und Entwicklungsstoerungen (Foerderschwerpunkte LE, ES, SQ)",
    rechtsgrundlage: "§ 3a FESchVO",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 4,
  },
  {
    bezeichnung: "GL-Mehrbedarf Sek I",
    kurzbezeichnung: "GL",
    beschreibung: "Unterrichtsmehrbedarf Gemeinsames Lernen Sek. I (1/6 Stelle + 0,125 je 3 Schueler)",
    rechtsgrundlage: "§ 3b FESchVO",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 5,
  },
  {
    bezeichnung: "Waldorfzuschlag",
    kurzbezeichnung: "WF",
    beschreibung: "+10% Primarstufe/Sek I, +5% Sek II auf Grundstellen (nur Waldorfschulen)",
    rechtsgrundlage: "§ 3 Abs. 4 FESchVO",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 6,
  },
  {
    bezeichnung: "Zusatzbeihilfe",
    kurzbezeichnung: "ZB",
    beschreibung: "Sonderstellen im Einzelfall, befristet max. 5 Jahre, Ermessensentscheidung der BR",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG i.V.m. § 2 Abs. 5 FESchVO",
    bindungstyp: "beides" as const,
    istIsoliert: true,
    istStandard: true,
    sortierung: 7,
  },
  {
    bezeichnung: "Digitalisierungsbeauftragter",
    kurzbezeichnung: "DIGI",
    beschreibung: "Stellenanteil fuer den Digitalisierungsbeauftragten der Schule",
    rechtsgrundlage: null,
    bindungstyp: "person" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 8,
  },
  {
    bezeichnung: "Unterrichtsmehrbedarf",
    kurzbezeichnung: "UMB",
    beschreibung: "Genereller Unterrichtsmehrbedarf gemaess Bewirtschaftungserlass",
    rechtsgrundlage: "§ 107 Abs. 1 SchulG NRW",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 9,
  },
  {
    bezeichnung: "Ausgleichsbedarf",
    kurzbezeichnung: "AGL",
    beschreibung: "Ausgleich gemaess Bewirtschaftungserlass",
    rechtsgrundlage: "§ 107 Abs. 1 SchulG NRW",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 10,
  },
  {
    bezeichnung: "Verwaltungspersonalstellen",
    kurzbezeichnung: "VP",
    beschreibung: "Pauschalstellen nach Schuelerzahl (unabhaengig von tatsaechlich beschaeftigten Kraeften)",
    rechtsgrundlage: "§ 4 FESchVO",
    bindungstyp: "schule" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 11,
  },
  {
    bezeichnung: "Sonstiger Stellenanteil",
    kurzbezeichnung: "SONST",
    beschreibung: "Fuer kurzfristige oder nicht kategorisierbare Stellenanteile",
    rechtsgrundlage: null,
    bindungstyp: "beides" as const,
    istIsoliert: false,
    istStandard: true,
    sortierung: 99,
  },
];

async function seedStellenarten() {
  console.log("Stellenarten einfuegen...\n");

  for (const sa of STELLENARTEN) {
    await db
      .insert(schema.stellenartTypen)
      .values(sa)
      .onConflictDoUpdate({
        target: [schema.stellenartTypen.bezeichnung],
        set: {
          kurzbezeichnung: sa.kurzbezeichnung,
          beschreibung: sa.beschreibung,
          rechtsgrundlage: sa.rechtsgrundlage,
          bindungstyp: sa.bindungstyp,
          istIsoliert: sa.istIsoliert,
          istStandard: sa.istStandard,
          sortierung: sa.sortierung,
        },
      });

    console.log(`   ${sa.kurzbezeichnung}: ${sa.bezeichnung} (${sa.bindungstyp})`);
  }

  console.log("\nStellenarten erfolgreich eingefuegt!");
  process.exit(0);
}

seedStellenarten().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
