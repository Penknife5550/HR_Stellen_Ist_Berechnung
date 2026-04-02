/**
 * Seed-Script: Standard-Stellenarten nach NRW-Recht.
 *
 * Drei-Typen-Modell:
 *   A      = Stellenzuschlag (Anlage 2a Abschnitt 2, erhoeht Pauschale)
 *   A_106  = Sonderbedarf § 106 Abs. 10 (Anlage 2a Abschnitt 4, isoliert)
 *   B      = Wahlleistung Geld oder Stelle (BASS 11-02 Nr. 24)
 *   C      = Reine Geldleistung (kein Stelleneffekt)
 *
 * Ausfuehren: npx tsx src/db/seed-stellenarten.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

type StellenartSeed = {
  bezeichnung: string;
  kurzbezeichnung: string;
  kuerzel: string;
  beschreibung: string;
  rechtsgrundlage: string | null;
  typ: "A" | "A_106" | "B" | "C";
  bindungstyp: "schule" | "person" | "beides";
  istIsoliert: boolean;
  anlage2a: boolean;
  erhoehtPauschale: boolean;
  parametrisierbar: boolean;
  schulformFilter: string[] | null;
  istStandard: boolean;
  sortierung: number;
};

// ============================================================
// TYP A – Stellenzuschlaege (Abschnitt 2, erhoeht Pauschale)
// ============================================================

const TYP_A_STANDARD: StellenartSeed[] = [
  {
    bezeichnung: "Ganztagsunterricht 20 %",
    kurzbezeichnung: "GT20",
    kuerzel: "GT20",
    beschreibung: "20 % Aufschlag auf den Grundstellenbedarf bei genehmigtem gebundenem Ganztagsbetrieb",
    rechtsgrundlage: "§ 9 Abs. 1 VO zu § 93 Abs. 2 SchulG; BASS 11-11 Nr. 1",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 10,
  },
  {
    bezeichnung: "Ganztagsunterricht 30 %",
    kurzbezeichnung: "GT30",
    kuerzel: "GT30",
    beschreibung: "30 % Aufschlag auf den Grundstellenbedarf bei erweitertem Ganztagsbetrieb (Foerderschulen)",
    rechtsgrundlage: "§ 9 Abs. 1 VO zu § 93 Abs. 2 SchulG; BASS 11-11 Nr. 1",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 11,
  },
  {
    bezeichnung: "Schulleitungsentlastung (Leitungszeit)",
    kurzbezeichnung: "SLE",
    kuerzel: "SLE",
    beschreibung: "Leitungszeit: 9 WStd Grund + 0,7 WStd je Planstelle bis 50. + 0,3 ab 51. Stelle; GS +2 WStd",
    rechtsgrundlage: "§ 5 VO zu § 93 Abs. 2 SchulG (AVO-RL); BASS 11-11 Nr. 1",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 12,
  },
  {
    bezeichnung: "KAoA – Kein Abschluss ohne Anschluss",
    kurzbezeichnung: "KAoA",
    kuerzel: "KAoA",
    beschreibung: "Berufliche Orientierung: Anrechnungsstunden je Schule abhaengig von Jahrgangsklassen 8/9/10",
    rechtsgrundlage: "Gesonderter Jahreserlass MSB; BASS 11-11 Nr. 1",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 13,
  },
  {
    bezeichnung: "Gemeinsames Lernen Sockel",
    kurzbezeichnung: "GL-S",
    kuerzel: "GL-S",
    beschreibung: "1,0 Stelle pauschal je Schule mit genehmigtem Gemeinsamem Lernen (Sockelausstattung)",
    rechtsgrundlage: "§ 3a Abs. 1 FESchVO; BASS 11-11 Nr. 1",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 14,
  },
  {
    bezeichnung: "Gemeinsames Lernen je Schueler",
    kurzbezeichnung: "GL-K",
    kuerzel: "GL-K",
    beschreibung: "Anteilige Stellen je Schueler mit sonderpaed. Foerderbedarf im GL (Schluessel je Förderschwerpunkt)",
    rechtsgrundlage: "§ 3a Abs. 1 FESchVO",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 15,
  },
  {
    bezeichnung: "LES-Stellenbudget Sockel",
    kurzbezeichnung: "LES-S",
    kuerzel: "LES-S",
    beschreibung: "Fester Sockelbetrag je Schule fuer Lern-/Entwicklungsstoerungen (LE, ES, SQ)",
    rechtsgrundlage: "§ 3a FESchVO; Anlage 7 FESchVO",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 16,
  },
  {
    bezeichnung: "LES-Stellenbudget je Schueler",
    kurzbezeichnung: "LES-K",
    kuerzel: "LES-K",
    beschreibung: "Anteilige Stellen je Schueler mit LES-Foerderbedarf (Schluessel aus Bewirtschaftungserlass)",
    rechtsgrundlage: "§ 3a FESchVO; Anlage 7 FESchVO",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 17,
  },
  {
    bezeichnung: "Sozialpaedagogische Fachkraft",
    kurzbezeichnung: "SPF",
    kuerzel: "SPF",
    beschreibung: "Mind. 0,5 Stellen je Grundschule mit genehmigtem Gemeinsamem Lernen",
    rechtsgrundlage: "§ 3a Abs. 1 FESchVO",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: ["GS"],
    istStandard: true,
    sortierung: 18,
  },
  {
    bezeichnung: "Personal- und Schwerbehindertenvertretung",
    kurzbezeichnung: "SBV",
    kuerzel: "SBV",
    beschreibung: "Anrechnungsstunden fuer gewaehlte SBV; Umrechnung in Stellen nach Regelstundenmass",
    rechtsgrundlage: "§ 3 Abs. 1 FESchVO i.V.m. SGB IX",
    typ: "A",
    bindungstyp: "person",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 19,
  },
  {
    bezeichnung: "Beratungslehrkraefte",
    kurzbezeichnung: "BL",
    kuerzel: "BL",
    beschreibung: "1 Anrechnungsstunde je angefangene 200 Schueler; max. 5 Std. je Beratungslehrkraft",
    rechtsgrundlage: "BASS 12-21 Nr. 4",
    typ: "A",
    bindungstyp: "person",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 20,
  },
  {
    bezeichnung: "Anrechnungsstunden (Lehrerrat, Gleichstellung u.a.)",
    kurzbezeichnung: "ANR",
    kuerzel: "ANR",
    beschreibung: "0,4–1,2 Std. je Stelle je Schulform (Lehrerrat, Gleichstellungsbeauftragte, Fortbildung, Sicherheit)",
    rechtsgrundlage: "§ 2 Abs. 5 VO zu § 93 Abs. 2 SchulG (AVO-RL)",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 21,
  },
  {
    bezeichnung: "Deutschfoerderung / DaZ (Seiteneinsteiger)",
    kurzbezeichnung: "DAZ",
    kuerzel: "DAZ",
    beschreibung: "Stellen je genehmigter Intensivklasse oder Foerdergruppe",
    rechtsgrundlage: "BASS 13-63 Nr. 3",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 22,
  },
  {
    bezeichnung: "Muttersprachlicher Unterricht",
    kurzbezeichnung: "MSU",
    kuerzel: "MSU",
    beschreibung: "Stellen je genehmigtem Herkunftssprachenkurs (HSU)",
    rechtsgrundlage: "AVO-RL (BASS 11-11 Nr. 1); BASS 13-63 Nr. 2",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 23,
  },
  {
    bezeichnung: "Unterrichtsmehrbedarf",
    kurzbezeichnung: "UMB",
    kuerzel: "UMB",
    beschreibung: "Genereller Unterrichtsmehrbedarf gemaess jaehrlichem Bewirtschaftungserlass",
    rechtsgrundlage: "§ 107 Abs. 1 SchulG NRW",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 24,
  },
  {
    bezeichnung: "Ausgleichsbedarf",
    kurzbezeichnung: "AGL",
    kuerzel: "AGL",
    beschreibung: "Ausgleich gemaess jaehrlichem Bewirtschaftungserlass",
    rechtsgrundlage: "§ 107 Abs. 1 SchulG NRW",
    typ: "A",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 25,
  },
  {
    bezeichnung: "Sonstige gesetzliche Tatbestaende",
    kurzbezeichnung: "SONST-A",
    kuerzel: "SONST-A2",
    beschreibung: "Sammelposition fuer weitere gesetzliche Unterrichtsbedarfe (Abschnitt 2 Anlage 2a)",
    rechtsgrundlage: "§ 3 FESchVO i.V.m. AVO-RL",
    typ: "A",
    bindungstyp: "beides",
    istIsoliert: false,
    anlage2a: true,
    erhoehtPauschale: true,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 29,
  },
];

// ============================================================
// TYP A_106 – Sonderbedarfe § 106 Abs. 10 (Abschnitt 4, isoliert)
// ============================================================

const TYP_A_106: StellenartSeed[] = [
  {
    bezeichnung: "Digitalisierungsbeauftragter",
    kurzbezeichnung: "DIGI",
    kuerzel: "DIGI",
    beschreibung: "Anrechnungsstunden fuer den Digitalisierungsbeauftragten der Schule (auf Antrag)",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG; BASS 11-02 (Digitalisierungserlass)",
    typ: "A_106",
    bindungstyp: "person",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 40,
  },
  {
    bezeichnung: "Schulleitungsqualifikation (SLQ)",
    kurzbezeichnung: "SLQ",
    kuerzel: "SLQ",
    beschreibung: "1 Anrechnungsstunde je Teilnehmer waehrend der Qualifikationsmassnahme (befristet)",
    rechtsgrundlage: "BASS 21-02 Nr. 7; § 106 Abs. 10 SchulG",
    typ: "A_106",
    bindungstyp: "person",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 41,
  },
  {
    bezeichnung: "Sonderzuschlag LES (§ 106 Abs. 10)",
    kurzbezeichnung: "LES-10",
    kuerzel: "LES-10",
    beschreibung: "Stellen je Bewilligungsbescheid — nur wenn regulaerer LES-Zuschlag nicht ausreicht",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG; Anlage 7 FESchVO",
    typ: "A_106",
    bindungstyp: "schule",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 42,
  },
  {
    bezeichnung: "Fachleiterbonus (LAA-Betreuung)",
    kurzbezeichnung: "FLB",
    kuerzel: "FLB",
    beschreibung: "Anrechnungsstunden je betreutem Lehramtsanwaerter (nur anerkannte Ausbildungsschule)",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG; AVO-RL Anlage",
    typ: "A_106",
    bindungstyp: "person",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 43,
  },
  {
    bezeichnung: "Einsatz im oeffentlichen Schuldienst",
    kurzbezeichnung: "OEF",
    kuerzel: "OEF",
    beschreibung: "Stellen je Abordnungsumfang (Nachweis der Abordnung erforderlich)",
    rechtsgrundlage: "§ 106 Abs. 10 Satz 2 SchulG",
    typ: "A_106",
    bindungstyp: "person",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 44,
  },
  {
    bezeichnung: "Bilinguale Angebote / Modellversuche",
    kurzbezeichnung: "BIL",
    kuerzel: "BIL",
    beschreibung: "Stellen je Bewilligungsbescheid (genehmigte Modellversuche durch MSB)",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG",
    typ: "A_106",
    bindungstyp: "schule",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 45,
  },
  {
    bezeichnung: "Vertretungsbedarf",
    kurzbezeichnung: "VTR",
    kuerzel: "VTR",
    beschreibung: "Stellen je Bewilligungsbescheid (zeitlich befristet, nur bei nicht kompensierbarem Ausfall)",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG; VVzFESchVO Nr. 3.1.2",
    typ: "A_106",
    bindungstyp: "schule",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 46,
  },
  {
    bezeichnung: "Zusatzbeihilfe (sonstiger Sonderbedarf)",
    kurzbezeichnung: "ZB",
    kuerzel: "ZB",
    beschreibung: "Sonderstellen im Einzelfall, befristet max. 5 Jahre, Ermessensentscheidung der BR",
    rechtsgrundlage: "§ 106 Abs. 10 SchulG i.V.m. § 2 Abs. 5 FESchVO",
    typ: "A_106",
    bindungstyp: "beides",
    istIsoliert: true,
    anlage2a: true,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 49,
  },
];

// ============================================================
// TYP B – Wahlleistung "Geld oder Stelle" (BASS 11-02 Nr. 24)
// ============================================================

const TYP_B: StellenartSeed[] = [
  {
    bezeichnung: "Geld oder Stelle: Paed. Uebermittagsbetreuung Sek I",
    kurzbezeichnung: "GOS Sek I",
    kuerzel: "GOS-SEK1",
    beschreibung: "Traeger waehlt: Stelle (0,3–0,6 VZE) ODER EUR-Betrag (20.200–40.300 EUR). Wahl fuer Schuljahr bindend.",
    rechtsgrundlage: "BASS 11-02 Nr. 24",
    typ: "B",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: false, // nur bei Stellenwahl
    erhoehtPauschale: false,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 60,
  },
  {
    bezeichnung: "Geld oder Stelle: Gebundener Ganztag Sek I",
    kurzbezeichnung: "GOS GT",
    kuerzel: "GOS-GT-SEK1",
    beschreibung: "Erhoehte Betraege fuer Sek I mit gebundenem Ganztagsbetrieb. Nicht kombinierbar mit GT20/GT30.",
    rechtsgrundlage: "BASS 11-02 Nr. 24; BASS 12-63 Nr. 2",
    typ: "B",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: false,
    erhoehtPauschale: false,
    parametrisierbar: true,
    schulformFilter: null,
    istStandard: true,
    sortierung: 61,
  },
];

// ============================================================
// TYP C – Reine Geldleistungen (kein Stelleneffekt)
// ============================================================

const TYP_C: StellenartSeed[] = [
  {
    bezeichnung: "Dreizehn Plus (13+)",
    kurzbezeichnung: "13+",
    kuerzel: "13PLUS",
    beschreibung: "Foerderung paed. Betreuung nach dem Unterricht (ab 13 Uhr, mind. 4 Tage/Woche). Nur GS ohne Ganztag.",
    rechtsgrundlage: "BASS 11-02 Nr. 9 (Runderlass 31.07.2008)",
    typ: "C",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: false,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: ["GS"],
    istStandard: true,
    sortierung: 80,
  },
  {
    bezeichnung: "Schule von acht bis eins",
    kurzbezeichnung: "8bis1",
    kuerzel: "8BIS1",
    beschreibung: "Foerderung paed. Betreuung vor dem Unterricht (ab 8:00 Uhr). Nur GS ohne Ganztag.",
    rechtsgrundlage: "BASS 11-02 Nr. 9",
    typ: "C",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: false,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: ["GS"],
    istStandard: true,
    sortierung: 81,
  },
  {
    bezeichnung: "Silentien",
    kurzbezeichnung: "Silen",
    kuerzel: "SILEN",
    beschreibung: "Individuelle Foerderung in Kleingruppen (Deutsch/Mathe), mind. 12 Wochen a 3 WStd. Nur GS in soz. Brennpunkten.",
    rechtsgrundlage: "BASS 11-02 Nr. 9",
    typ: "C",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: false,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: ["GS"],
    istStandard: true,
    sortierung: 82,
  },
  {
    bezeichnung: "Versorgungszuschuss",
    kurzbezeichnung: "VZS",
    kuerzel: "VZS",
    beschreibung: "Zuschuss fuer beamtete Lehrkraefte mit Versorgungsanspruechen. Gesonderter Antrag vor Versorgungsfall.",
    rechtsgrundlage: "§ 107 Abs. 5 SchulG; FESchVO",
    typ: "C",
    bindungstyp: "schule",
    istIsoliert: false,
    anlage2a: false,
    erhoehtPauschale: false,
    parametrisierbar: false,
    schulformFilter: null,
    istStandard: true,
    sortierung: 83,
  },
];

// ============================================================
// ALLE STELLENARTEN
// ============================================================

const ALLE_STELLENARTEN: StellenartSeed[] = [
  ...TYP_A_STANDARD,
  ...TYP_A_106,
  ...TYP_B,
  ...TYP_C,
];

async function seedStellenarten() {
  console.log("Stellenarten einfuegen/aktualisieren...\n");
  console.log(`  ${TYP_A_STANDARD.length} Typ A  (Standardzuschlaege, Abschnitt 2)`);
  console.log(`  ${TYP_A_106.length} Typ A_106 (Sonderbedarfe § 106 Abs. 10, Abschnitt 4)`);
  console.log(`  ${TYP_B.length} Typ B  (Wahlleistungen Geld/Stelle)`);
  console.log(`  ${TYP_C.length} Typ C  (Reine Geldleistungen)`);
  console.log(`  ─────────────────`);
  console.log(`  ${ALLE_STELLENARTEN.length} Stellenarten gesamt\n`);

  for (const sa of ALLE_STELLENARTEN) {
    await db
      .insert(schema.stellenartTypen)
      .values(sa)
      .onConflictDoUpdate({
        target: [schema.stellenartTypen.bezeichnung],
        set: {
          kurzbezeichnung: sa.kurzbezeichnung,
          kuerzel: sa.kuerzel,
          beschreibung: sa.beschreibung,
          rechtsgrundlage: sa.rechtsgrundlage,
          typ: sa.typ,
          bindungstyp: sa.bindungstyp,
          istIsoliert: sa.istIsoliert,
          anlage2a: sa.anlage2a,
          erhoehtPauschale: sa.erhoehtPauschale,
          parametrisierbar: sa.parametrisierbar,
          schulformFilter: sa.schulformFilter,
          istStandard: sa.istStandard,
          sortierung: sa.sortierung,
          updatedAt: new Date(),
        },
      });

    const typLabel = { A: "A  ", A_106: "A§106", B: "B  ", C: "C  " }[sa.typ];
    console.log(`   [${typLabel}] ${sa.kuerzel.padEnd(12)} ${sa.bezeichnung}`);
  }

  // Alte Stellenarten deaktivieren die nicht mehr im Seed sind
  // (z.B. Waldorf, Personalbedarfspauschale als Stellenart)
  const alteBezeichnungen = [
    "Personalbedarfspauschale",
    "Personalnebenkostenpauschale",
    "Ganztagszuschlag", // ersetzt durch GT20/GT30
    "LES-Stellenbudget", // ersetzt durch LES-S/LES-K
    "GL-Mehrbedarf Sek I", // ersetzt durch GL-S/GL-K
    "Waldorfzuschlag",
    "Verwaltungspersonalstellen", // nicht Teil der Deputats-Stellenberechnung
    "Sonstiger Stellenanteil", // ersetzt durch SONST-A2
  ];

  for (const bez of alteBezeichnungen) {
    await db
      .update(schema.stellenartTypen)
      .set({ aktiv: false, updatedAt: new Date() })
      .where(
        // nur deaktivieren wenn die neue Variante existiert
        require("drizzle-orm").eq(schema.stellenartTypen.bezeichnung, bez)
      );
    console.log(`   [DEAKTIVIERT] ${bez}`);
  }

  console.log("\nStellenarten erfolgreich eingefuegt/aktualisiert!");
  process.exit(0);
}

seedStellenarten().catch((err) => {
  console.error("Seed-Fehler:", err);
  process.exit(1);
});
