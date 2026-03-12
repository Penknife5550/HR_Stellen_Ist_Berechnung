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
// SLR-KONFIGURATION
// ============================================================

/** SLR-Werte je Schuljahr und Schulform-Typ */
export const slrWerte = pgTable("slr_werte", {
  id: serial("id").primaryKey(),
  schuljahrId: integer("schuljahr_id").notNull().references(() => schuljahre.id),
  schulformTyp: varchar("schulform_typ", { length: 50 }).notNull(),
  relation: numeric("relation", { precision: 6, scale: 2 }).notNull(),
  quelle: varchar("quelle", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("slr_werte_unique").on(table.schuljahrId, table.schulformTyp),
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
// LEHRER & DEPUTATE (aus Untis via n8n)
// ============================================================

/** Lehrerstammdaten */
export const lehrer = pgTable("lehrer", {
  id: serial("id").primaryKey(),
  untisTeacherId: integer("untis_teacher_id").notNull().unique(),
  personalnummer: varchar("personalnummer", { length: 20 }),
  name: varchar("name", { length: 50 }).notNull(),
  vollname: varchar("vollname", { length: 200 }).notNull(),
  stammschuleId: integer("stammschule_id").references(() => schulen.id),
  stammschuleCode: varchar("stammschule_code", { length: 10 }),
  aktiv: boolean("aktiv").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_lehrer_stammschule").on(table.stammschuleId),
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
