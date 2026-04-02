import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  text,
  numeric,
  date,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// KERN-TABELLEN
// ============================================================

/** Schulstammdaten - jede Schule hat eine eigene Schulnummer */
export const schulen = pgTable("schulen", {
  id: serial("id").primaryKey(),
  schulnummer: varchar("schulnummer", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  kurzname: varchar("kurzname", { length: 10 }).notNull(),
  untisCode: varchar("untis_code", { length: 10 }),
  schulform: varchar("schulform", { length: 50 }).notNull(),
  adresse: varchar("adresse", { length: 300 }),
  plz: varchar("plz", { length: 5 }),
  ort: varchar("ort", { length: 100 }),
  farbe: varchar("farbe", { length: 7 }).notNull().default("#575756"),
  istImAufbau: boolean("ist_im_aufbau").notNull().default(false),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Stufen pro Schule (Sek I, Sek II, Primarstufe) */
export const schulStufen = pgTable("schul_stufen", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  stufe: varchar("stufe", { length: 50 }).notNull(),
  schulformTyp: varchar("schulform_typ", { length: 50 }).notNull(),
  aktiv: boolean("aktiv").notNull().default(true),
}, (table) => [
  unique("schul_stufen_unique").on(table.schuleId, table.stufe),
]);

// ============================================================
// ZEITRAUM-REFERENZEN
// ============================================================

/** Schuljahre */
export const schuljahre = pgTable("schuljahre", {
  id: serial("id").primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 20 }).notNull().unique(),
  startDatum: date("start_datum").notNull(),
  endDatum: date("end_datum").notNull(),
  untisSchoolyearId: integer("untis_schoolyear_id").unique(),
  aktiv: boolean("aktiv").notNull().default(true),
});

/** Haushaltsjahre (Kalenderjahre) */
export const haushaltsjahre = pgTable("haushaltsjahre", {
  id: serial("id").primaryKey(),
  jahr: integer("jahr").notNull().unique(),
  stichtagVorjahr: date("stichtag_vorjahr"),
  stichtagLaufend: date("stichtag_laufend"),
  gesperrt: boolean("gesperrt").notNull().default(false),
});

// ============================================================
// SCHUELERZAHLEN
// ============================================================

/** Schuelerzahlen je Schule/Stufe/Stichtag */
export const schuelerzahlen = pgTable("schuelerzahlen", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  schulStufeId: integer("schul_stufe_id").notNull().references(() => schulStufen.id),
  stichtag: date("stichtag").notNull(),
  anzahl: integer("anzahl").notNull(),
  bemerkung: text("bemerkung"),
  erfasstVon: varchar("erfasst_von", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("schuelerzahlen_unique").on(table.schuleId, table.schulStufeId, table.stichtag),
  index("idx_schuelerzahlen_stichtag").on(table.stichtag),
  index("idx_schuelerzahlen_schule").on(table.schuleId),
]);

// ============================================================
// REGELDEPUTATE (Pflichtstunden je Schulform)
// ============================================================

/**
 * Regeldeputate je Schulform — Pflichtstunden pro Vollzeitstelle.
 * Rechtsgrundlage: § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW (BASS 11-11 Nr. 1)
 */
export const regeldeputate = pgTable("regeldeputate", {
  id: serial("id").primaryKey(),
  schulformCode: varchar("schulform_code", { length: 10 }).notNull(),
  schulformName: varchar("schulform_name", { length: 100 }).notNull(),
  regeldeputat: numeric("regeldeputat", { precision: 4, scale: 1 }).notNull(),
  rechtsgrundlage: varchar("rechtsgrundlage", { length: 300 }),
  bassFundstelle: varchar("bass_fundstelle", { length: 100 }),
  gueltigAb: date("gueltig_ab"),
  bemerkung: text("bemerkung"),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("regeldeputate_unique").on(table.schulformCode),
]);

// ============================================================
// SLR-KONFIGURATION
// ============================================================

/** SLR-Werte je Schuljahr und Schulform-Typ */
export const slrWerte = pgTable("slr_werte", {
  id: serial("id").primaryKey(),
  schuljahrId: integer("schuljahr_id").notNull().references(() => schuljahre.id),
  schulformTyp: varchar("schulform_typ", { length: 50 }).notNull(),
  relation: numeric("relation", { precision: 6, scale: 2 }).notNull(),
  quelle: varchar("quelle", { length: 200 }),
  geaendertVon: varchar("geaendert_von", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("slr_werte_unique").on(table.schuljahrId, table.schulformTyp),
]);

/** SLR-Aenderungshistorie — jede Aenderung wird versioniert */
export const slrHistorie = pgTable("slr_historie", {
  id: serial("id").primaryKey(),
  slrWertId: integer("slr_wert_id").notNull().references(() => slrWerte.id),
  schuljahrId: integer("schuljahr_id").notNull().references(() => schuljahre.id),
  schulformTyp: varchar("schulform_typ", { length: 50 }).notNull(),
  relationAlt: numeric("relation_alt", { precision: 6, scale: 2 }).notNull(),
  relationNeu: numeric("relation_neu", { precision: 6, scale: 2 }).notNull(),
  quelleAlt: varchar("quelle_alt", { length: 200 }),
  quelleNeu: varchar("quelle_neu", { length: 200 }),
  grund: text("grund"),
  geaendertVon: varchar("geaendert_von", { length: 100 }).notNull(),
  geaendertAm: timestamp("geaendert_am", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_slr_historie_slr_wert").on(table.slrWertId),
  index("idx_slr_historie_schuljahr").on(table.schuljahrId),
]);

// ============================================================
// ZUSCHLAEGE
// ============================================================

/** Zuschlagsarten (Stammdaten) */
export const zuschlagArten = pgTable("zuschlag_arten", {
  id: serial("id").primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 100 }).notNull().unique(),
  beschreibung: text("beschreibung"),
  istStandard: boolean("ist_standard").notNull().default(false),
  sortierung: integer("sortierung").notNull().default(0),
});

/** Zuschlagswerte je Schule/Haushaltsjahr */
export const zuschlaege = pgTable("zuschlaege", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  zuschlagArtId: integer("zuschlag_art_id").notNull().references(() => zuschlagArten.id),
  wert: numeric("wert", { precision: 8, scale: 4 }).notNull(),
  zeitraum: varchar("zeitraum", { length: 10 }).notNull().default("ganzjahr"),
  bemerkung: text("bemerkung"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("zuschlaege_unique").on(
    table.schuleId,
    table.haushaltsjahrId,
    table.zuschlagArtId,
    table.zeitraum
  ),
]);

// ============================================================
// STELLENARTEN & STELLENANTEILE
// ============================================================

/**
 * Stammdaten: Welche Arten von zusaetzlichen Stellenanteilen gibt es?
 * Rechtsgrundlagen: §§ 3, 3a, 3b FESchVO, § 106 Abs. 10, § 107 SchulG NRW
 *
 * Drei Grundtypen nach NRW-Recht:
 *   A      = Stellenzuschlag (deputatswirksam, Anlage 2a Abschnitt 2)
 *   A_106  = Sonderbedarf § 106 Abs. 10 SchulG (Anlage 2a Abschnitt 4, isoliert)
 *   B      = Wahlleistung Geld oder Stelle (BASS 11-02 Nr. 24)
 *   C      = Reine Geldleistung (keine Deputatswirkung)
 */
export const stellenartTypen = pgTable("stellenart_typen", {
  id: serial("id").primaryKey(),
  bezeichnung: varchar("bezeichnung", { length: 150 }).notNull().unique(),
  kurzbezeichnung: varchar("kurzbezeichnung", { length: 30 }),
  kuerzel: varchar("kuerzel", { length: 15 }),
  beschreibung: text("beschreibung"),
  rechtsgrundlage: varchar("rechtsgrundlage", { length: 300 }),
  /** Grundtyp: A = Stellenzuschlag, A_106 = §106 Sonderbedarf, B = Wahlleistung, C = Geldleistung */
  typ: varchar("typ", { length: 10 }).notNull().default("A"),
  bindungstyp: varchar("bindungstyp", { length: 10 }).notNull().default("schule"),
  istIsoliert: boolean("ist_isoliert").notNull().default(false),
  /** Erscheint in Anlage 2a der FESchVO? */
  anlage2a: boolean("anlage2a").notNull().default(true),
  /** Erhoeht die Personalbedarfspauschale (nur Abschnitt 2 = true)? */
  erhoehtPauschale: boolean("erhoeht_pauschale").notNull().default(false),
  /** Wert aendert sich jaehrlich per Erlass? */
  parametrisierbar: boolean("parametrisierbar").notNull().default(false),
  /** Schulformfilter: z.B. ["GE","GY"] oder ["ALLE"]. NULL = alle Schulformen. */
  schulformFilter: jsonb("schulform_filter"),
  istStandard: boolean("ist_standard").notNull().default(false),
  sortierung: integer("sortierung").notNull().default(0),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Konkrete Stellenanteile pro Schule/Haushaltsjahr.
 * Kann schulbezogen (pauschal) oder personengebunden (mit Lehrer) sein.
 */
export const stellenanteile = pgTable("stellenanteile", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  stellenartTypId: integer("stellenart_typ_id").notNull().references(() => stellenartTypen.id),
  lehrerId: integer("lehrer_id").references(() => lehrer.id),
  /** Stellenanteil in VZE (z.B. 0.5). Bei Typ C oder Typ B mit wahlrecht="geld" ist wert = 0. */
  wert: numeric("wert", { precision: 8, scale: 4 }).notNull(),
  /** EUR-Betrag fuer Typ B (Geldvariante) und Typ C (reine Geldleistung). NULL bei reinen Stellenzuschlaegen. */
  eurBetrag: numeric("eur_betrag", { precision: 12, scale: 2 }),
  /** Wahlrecht: "stelle" | "geld" | NULL. Nur relevant bei Typ B. */
  wahlrecht: varchar("wahlrecht", { length: 10 }),
  zeitraum: varchar("zeitraum", { length: 10 }).notNull().default("ganzjahr"),
  status: varchar("status", { length: 20 }).notNull().default("beantragt"),
  befristetBis: date("befristet_bis"),
  antragsdatum: date("antragsdatum"),
  aktenzeichen: varchar("aktenzeichen", { length: 100 }),
  dmsDokumentennummer: varchar("dms_dokumentennummer", { length: 100 }),
  bemerkung: text("bemerkung"),
  erstelltVon: varchar("erstellt_von", { length: 100 }),
  geaendertVon: varchar("geaendert_von", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_stellenanteile_schule_hj").on(table.schuleId, table.haushaltsjahrId),
  index("idx_stellenanteile_lehrer").on(table.lehrerId),
  index("idx_stellenanteile_befristung").on(table.befristetBis),
  index("idx_stellenanteile_status").on(table.status),
]);

// ============================================================
// LEHRER & DEPUTATE (aus Untis via n8n)
// ============================================================

/** Lehrerstammdaten — aus Untis (n8n-Sync) oder manuell angelegt (Grundschulen) */
export const lehrer = pgTable("lehrer", {
  id: serial("id").primaryKey(),
  untisTeacherId: integer("untis_teacher_id").unique(),
  personalnummer: varchar("personalnummer", { length: 20 }),
  name: varchar("name", { length: 50 }).notNull(),
  vollname: varchar("vollname", { length: 200 }).notNull(),
  vorname: varchar("vorname", { length: 100 }),
  nachname: varchar("nachname", { length: 100 }),
  stammschuleId: integer("stammschule_id").references(() => schulen.id),
  stammschuleCode: varchar("stammschule_code", { length: 10 }),
  quelle: varchar("quelle", { length: 20 }).notNull().default("untis"),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_lehrer_stammschule").on(table.stammschuleId),
  index("idx_lehrer_quelle").on(table.quelle),
]);

/** Monatliche Deputate */
export const deputatMonatlich = pgTable("deputat_monatlich", {
  id: serial("id").primaryKey(),
  lehrerId: integer("lehrer_id").notNull().references(() => lehrer.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  monat: integer("monat").notNull(),
  deputatGesamt: numeric("deputat_gesamt", { precision: 8, scale: 3 }),
  deputatGes: numeric("deputat_ges", { precision: 8, scale: 3 }).default("0"),
  deputatGym: numeric("deputat_gym", { precision: 8, scale: 3 }).default("0"),
  deputatBk: numeric("deputat_bk", { precision: 8, scale: 3 }).default("0"),
  quelle: varchar("quelle", { length: 20 }).default("untis"),
  untisSchoolyearId: integer("untis_schoolyear_id"),
  untisTermId: integer("untis_term_id"),
  syncDatum: timestamp("sync_datum", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("deputat_monatlich_unique").on(table.lehrerId, table.haushaltsjahrId, table.monat),
  index("idx_deputat_monatlich_lehrer").on(table.lehrerId),
  index("idx_deputat_monatlich_hj_monat").on(table.haushaltsjahrId, table.monat),
]);

/** Mehrarbeit */
export const mehrarbeit = pgTable("mehrarbeit", {
  id: serial("id").primaryKey(),
  lehrerId: integer("lehrer_id").notNull().references(() => lehrer.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  monat: integer("monat").notNull(),
  stunden: numeric("stunden", { precision: 8, scale: 2 }).notNull().default("0"),
  schuleId: integer("schule_id").references(() => schulen.id),
  bemerkung: text("bemerkung"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("mehrarbeit_unique").on(table.lehrerId, table.haushaltsjahrId, table.monat, table.schuleId),
]);

// ============================================================
// DEPUTAT-AENDERUNGSHISTORIE
// ============================================================

/**
 * Protokolliert jede Aenderung an Deputatsdaten bei einem Sync.
 * Rechtsgrundlage: § 3 Abs. 1 FESchVO — monatsgenaue Nachvollziehbarkeit
 * der tatsaechlich erteilten Unterrichtsstunden.
 */
export const deputatAenderungen = pgTable("deputat_aenderungen", {
  id: serial("id").primaryKey(),
  lehrerId: integer("lehrer_id").notNull().references(() => lehrer.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  monat: integer("monat").notNull(),
  // Alte Werte (vor dem Sync)
  deputatGesamtAlt: numeric("deputat_gesamt_alt", { precision: 8, scale: 3 }),
  deputatGesAlt: numeric("deputat_ges_alt", { precision: 8, scale: 3 }),
  deputatGymAlt: numeric("deputat_gym_alt", { precision: 8, scale: 3 }),
  deputatBkAlt: numeric("deputat_bk_alt", { precision: 8, scale: 3 }),
  // Neue Werte (nach dem Sync)
  deputatGesamtNeu: numeric("deputat_gesamt_neu", { precision: 8, scale: 3 }),
  deputatGesNeu: numeric("deputat_ges_neu", { precision: 8, scale: 3 }),
  deputatGymNeu: numeric("deputat_gym_neu", { precision: 8, scale: 3 }),
  deputatBkNeu: numeric("deputat_bk_neu", { precision: 8, scale: 3 }),
  // Art der Aenderung
  aenderungstyp: varchar("aenderungstyp", { length: 30 }).notNull(),
  // "deputat_aenderung" = PlannedWeek hat sich geaendert (Gehaltsrelevant!)
  // "verteilung_aenderung" = Nur Schulverteilung geaendert
  // "neu" = Erster Eintrag fuer diesen Monat
  istGehaltsrelevant: boolean("ist_gehaltsrelevant").notNull().default(false),
  termIdAlt: integer("term_id_alt"),
  termIdNeu: integer("term_id_neu"),
  // Automatisch vom Sync gesetzt (Untis-Datum = immer Montag)
  geaendertAm: timestamp("geaendert_am", { withTimezone: true }).notNull().defaultNow(),
  // Tatsaechliches Aenderungsdatum (manuell von HR korrigierbar)
  // Untis erzwingt Montag — hier wird das reale Datum eingetragen
  tatsaechlichesDatum: date("tatsaechliches_datum"),
  // Wer hat das tatsaechliche Datum gesetzt?
  datumKorrigiertVon: varchar("datum_korrigiert_von", { length: 100 }),
  datumKorrigiertAm: timestamp("datum_korrigiert_am", { withTimezone: true }),
  // Nachtrag-Status: null = offen, "erstellt", "versendet"
  nachtragStatus: varchar("nachtrag_status", { length: 20 }),
  nachtragErstelltAm: timestamp("nachtrag_erstellt_am", { withTimezone: true }),
  nachtragErstelltVon: varchar("nachtrag_erstellt_von", { length: 100 }),
}, (table) => [
  index("idx_deputat_aenderungen_lehrer").on(table.lehrerId, table.haushaltsjahrId),
  index("idx_deputat_aenderungen_gehaltsrelevant")
    .on(table.haushaltsjahrId, table.istGehaltsrelevant)
    .where(sql`ist_gehaltsrelevant = true`),
]);

// ============================================================
// SYNC-PROTOKOLL
// ============================================================

/** n8n Sync-Log */
export const deputatSyncLog = pgTable("deputat_sync_log", {
  id: serial("id").primaryKey(),
  syncDatum: timestamp("sync_datum", { withTimezone: true }).notNull().defaultNow(),
  schuljahrText: varchar("schuljahr_text", { length: 20 }),
  termId: integer("term_id"),
  anzahlLehrer: integer("anzahl_lehrer"),
  anzahlAenderungen: integer("anzahl_aenderungen"),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  fehlerDetails: text("fehler_details"),
  rohdaten: jsonb("rohdaten"),
});

// ============================================================
// BERECHNUNGSERGEBNISSE
// ============================================================

/** Stellensoll-Berechnungen */
export const berechnungStellensoll = pgTable("berechnung_stellensoll", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  zeitraum: varchar("zeitraum", { length: 10 }).notNull(),
  grundstellenDetails: jsonb("grundstellen_details").notNull(),
  grundstellenSumme: numeric("grundstellen_summe", { precision: 8, scale: 2 }).notNull(),
  grundstellenGerundet: numeric("grundstellen_gerundet", { precision: 8, scale: 1 }).notNull(),
  zuschlaegeSumme: numeric("zuschlaege_summe", { precision: 8, scale: 4 }).notNull().default("0"),
  zuschlaege_details: jsonb("zuschlaege_details"),
  stellensoll: numeric("stellensoll", { precision: 8, scale: 1 }).notNull(),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
  berechnetVon: varchar("berechnet_von", { length: 100 }),
  istAktuell: boolean("ist_aktuell").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_berechnung_stellensoll_aktuell")
    .on(table.schuleId, table.haushaltsjahrId)
    .where(sql`ist_aktuell = true`),
]);

/** Stellenist-Berechnungen */
export const berechnungStellenist = pgTable("berechnung_stellenist", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  zeitraum: varchar("zeitraum", { length: 10 }).notNull(),
  monatsDurchschnittStunden: numeric("monats_durchschnitt_stunden", { precision: 10, scale: 4 }),
  regelstundendeputat: numeric("regelstundendeputat", { precision: 6, scale: 2 }),
  stellenist: numeric("stellenist", { precision: 8, scale: 4 }).notNull(),
  stellenistGerundet: numeric("stellenist_gerundet", { precision: 8, scale: 1 }).notNull(),
  mehrarbeitStellen: numeric("mehrarbeit_stellen", { precision: 8, scale: 4 }).notNull().default("0"),
  stellenistGesamt: numeric("stellenist_gesamt", { precision: 8, scale: 1 }).notNull(),
  details: jsonb("details"),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
  berechnetVon: varchar("berechnet_von", { length: 100 }),
  istAktuell: boolean("ist_aktuell").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_berechnung_stellenist_aktuell")
    .on(table.schuleId, table.haushaltsjahrId)
    .where(sql`ist_aktuell = true`),
]);

/** Soll-Ist-Vergleich */
export const berechnungVergleich = pgTable("berechnung_vergleich", {
  id: serial("id").primaryKey(),
  schuleId: integer("schule_id").notNull().references(() => schulen.id),
  haushaltsjahrId: integer("haushaltsjahr_id").notNull().references(() => haushaltsjahre.id),
  stellensollId: integer("stellensoll_id").references(() => berechnungStellensoll.id),
  stellenistId: integer("stellenist_id").references(() => berechnungStellenist.id),
  stellensoll: numeric("stellensoll", { precision: 8, scale: 1 }).notNull(),
  stellenist: numeric("stellenist", { precision: 8, scale: 1 }).notNull(),
  differenz: numeric("differenz", { precision: 8, scale: 1 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  refinanzierung: numeric("refinanzierung", { precision: 8, scale: 1 }),
  berechnetAm: timestamp("berechnet_am", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// AUDIT-LOG
// ============================================================

/** Aenderungsprotokoll */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  tabelle: varchar("tabelle", { length: 50 }).notNull(),
  datensatzId: integer("datensatz_id").notNull(),
  aktion: varchar("aktion", { length: 20 }).notNull(),
  alteWerte: jsonb("alte_werte"),
  neueWerte: jsonb("neue_werte"),
  benutzer: varchar("benutzer", { length: 100 }),
  zeitpunkt: timestamp("zeitpunkt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_audit_log_tabelle").on(table.tabelle, table.datensatzId),
]);

// ============================================================
// BENUTZER (Authentifizierung)
// ============================================================

/** Benutzer der Anwendung (Personalabteilung) */
export const benutzer = pgTable("benutzer", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwortHash: varchar("passwort_hash", { length: 200 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  rolle: varchar("rolle", { length: 20 }).notNull().default("betrachter"),
  aktiv: boolean("aktiv").notNull().default(true),
  letzterLogin: timestamp("letzter_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
