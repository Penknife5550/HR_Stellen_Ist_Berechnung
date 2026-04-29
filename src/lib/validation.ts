/**
 * Zentrale Validierungs-Schemas (Zod).
 * Alle Eingabevalidierung an einem Ort.
 */

import { z } from "zod";

// ============================================================
// SCHUELERZAHLEN
// ============================================================

export const schuelerzahlSchema = z.object({
  schuleId: z.number().int().positive("Ungueltige Schule."),
  schulStufeId: z.number().int().positive("Ungueltige Stufe."),
  stichtag: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat (YYYY-MM-DD)."),
  anzahl: z.number().int().min(0, "Anzahl darf nicht negativ sein.").max(5000, "Anzahl unrealistisch hoch (max. 5000)."),
  bemerkung: z.string().max(500).optional(),
});

// ============================================================
// ZUSCHLAEGE
// ============================================================

export const zuschlagWertSchema = z
  .string()
  .transform((v) => v.replace(",", "."))
  .pipe(
    z.string().regex(/^-?\d{1,4}(\.\d{1,4})?$/, "Ungültiger Zuschlagswert.")
  );

// ============================================================
// MEHRARBEIT
// ============================================================

export const mehrarbeitSchema = z.object({
  lehrerId: z.number().int().positive("Ungueltige Lehrkraft."),
  haushaltsjahrId: z.number().int().positive("Ungueltiges Haushaltsjahr."),
  monat: z.number().int().min(1, "Monat muss zwischen 1 und 12 liegen.").max(12, "Monat muss zwischen 1 und 12 liegen."),
  stunden: z.string()
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Ungueltige Stundenanzahl."))
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Stunden muessen zwischen 0 und 100 liegen."),
  schuleId: z.number().int().positive().optional(),
  bemerkung: z.string().max(500).optional(),
});

// ============================================================
// SYNC-PAYLOAD (n8n)
// ============================================================

export const lehrerPayloadSchema = z.object({
  teacher_id: z.number().int().positive("Ungueltige Teacher-ID."),
  name: z.string().min(1).max(50),
  vollname: z.string().min(1).max(200),
  personalnummer: z.string().max(20).nullable().optional(),
  stammschule: z.string().max(10),
  deputat: z.number().min(0).max(200, "Deputat unrealistisch hoch."),
  deputat_ges: z.number().min(0).max(200),
  deputat_gym: z.number().min(0).max(200),
  deputat_bk: z.number().min(0).max(200),
  // NRW-Statistik-Code aus Untis (`StatisticCodes`-Spalte). Optional fuer
  // Backwards-Compat — alte n8n-Workflows ohne dieses Feld sind weiterhin
  // gueltig, der Lehrer behaelt dann den vorhandenen Code.
  statistik_code: z.string().max(5).nullable().optional(),
  schuljahr_text: z.string().optional(),
});

export const syncPayloadSchema = z.object({
  api_key: z.string().min(1),
  sync_datum: z.string().min(1, "sync_datum fehlt."),
  schuljahr_text: z.string().optional(),
  // Untis-Schuljahr als Int (z.B. 20252026). Optional fuer Backwards-Compat
  // mit aelteren n8n-Workflows. Wird fuer den Coverage-Tie-Breaker bei
  // gleichem term_id-Zahlenwert ueber Schuljahre hinweg genutzt.
  school_year_id: z.number().int().positive().optional(),
  term_id: z.number().int().positive().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  lehrer: z.array(lehrerPayloadSchema).min(1, "Mindestens 1 Lehrer erforderlich.").max(500, "Maximal 500 Lehrer pro Sync."),
});

// ============================================================
// SYNC-PAYLOAD v2 (Periodenmodell — Untis 1:1)
// ============================================================
//
// Format-Konvention:
//   Datumsfelder im Format "DD.MM.YYYY" (deutsch) — wie bisher.
//   Deputatswerte als number (Wochenstunden, max 3 Nachkommastellen).

const germanDateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
const germanDateField = z.string().regex(germanDateRegex, "Datum erwartet im Format DD.MM.YYYY.");

/** Eine Untis-Periode (Master-Daten). */
export const untisTermPayloadSchema = z.object({
  school_year_id: z.number().int().positive("Ungueltige school_year_id."),
  term_id: z.number().int().positive("Ungueltige term_id."),
  term_name: z.string().max(50).nullable().optional(),
  date_from: germanDateField,
  /** Effektives Periodenende (LEAD(DateFrom)-1 oder echtes DateTo bei b-Perioden). */
  date_to: germanDateField,
  /** True wenn Untis ein echtes (nicht Schuljahresende-)DateTo gesetzt hat. */
  is_b_period: z.boolean().optional().default(false),
});

export const untisTermsSyncPayloadSchema = z.object({
  api_key: z.string().min(1),
  sync_datum: z.string().min(1, "sync_datum fehlt."),
  terms: z
    .array(untisTermPayloadSchema)
    .min(1, "Mindestens 1 Term erforderlich.")
    .max(200, "Maximal 200 Terms pro Sync."),
});

/** Wert eines Lehrers fuer EINE Periode. */
export const lehrerProPeriodePayloadSchema = z.object({
  teacher_id: z.number().int().positive("Ungueltige Teacher-ID."),
  name: z.string().min(1).max(50),
  vollname: z.string().min(1).max(200),
  personalnummer: z.string().max(20).nullable().optional(),
  stammschule: z.string().max(10),
  /** NRW-Statistik-Code (Beamter/Angestellter) — optional, gleich wie v1. */
  statistik_code: z.string().max(5).nullable().optional(),
  /** Untis-Periodenidentitaet — Schuljahr + Term-ID. */
  school_year_id: z.number().int().positive("Ungueltige school_year_id."),
  term_id: z.number().int().positive("Ungueltige term_id."),
  /** Werte fuer genau diese Periode. */
  deputat_gesamt: z.number().min(0).max(200, "Deputat unrealistisch hoch."),
  deputat_ges: z.number().min(0).max(200),
  deputat_gym: z.number().min(0).max(200),
  deputat_bk: z.number().min(0).max(200),
});

export const syncV2PayloadSchema = z.object({
  api_key: z.string().min(1),
  sync_datum: z.string().min(1, "sync_datum fehlt."),
  schuljahr_text: z.string().optional(),
  /**
   * Werte pro (Lehrer x Periode). Ein Sync-Call kann beliebig viele Eintraege
   * tragen — etwa "alle Lehrer einer Periode" oder "ein Lehrer ueber alle
   * Perioden eines Schuljahrs".
   */
  eintraege: z
    .array(lehrerProPeriodePayloadSchema)
    .min(1, "Mindestens 1 Eintrag erforderlich.")
    .max(5000, "Maximal 5000 Eintraege pro Sync."),
});

// ============================================================
// AUTH: LOGIN
// ============================================================

export const loginSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse.").max(200),
  password: z.string().min(1, "Passwort darf nicht leer sein.").max(200),
});

// ============================================================
// AUTH: BENUTZER ERSTELLEN (Admin)
// ============================================================

export const createBenutzerSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse.").max(200),
  name: z.string().min(1, "Name darf nicht leer sein.").max(200),
  rolle: z.enum(["admin", "mitarbeiter", "betrachter"], {
    message: "Ungueltige Rolle.",
  }),
  passwort: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein.")
    .max(200),
});

// ============================================================
// AUTH: BENUTZER BEARBEITEN (Admin)
// ============================================================

export const updateBenutzerSchema = z.object({
  id: z.number().int().positive("Ungueltige Benutzer-ID."),
  name: z.string().min(1, "Name darf nicht leer sein.").max(200),
  email: z.string().email("Ungueltige E-Mail-Adresse.").max(200),
  rolle: z.enum(["admin", "mitarbeiter", "betrachter"], {
    message: "Ungueltige Rolle.",
  }),
});

// ============================================================
// AUTH: PASSWORT AENDERN
// ============================================================

export const changePasswordSchema = z
  .object({
    aktuellesPasswort: z.string().min(1, "Aktuelles Passwort eingeben."),
    neuesPasswort: z
      .string()
      .min(8, "Neues Passwort muss mindestens 8 Zeichen lang sein.")
      .max(200),
    neuesPasswortBestaetigung: z.string().min(1, "Passwort-Bestaetigung eingeben."),
  })
  .refine((data) => data.neuesPasswort === data.neuesPasswortBestaetigung, {
    message: "Passwoerter stimmen nicht ueberein.",
    path: ["neuesPasswortBestaetigung"],
  });

// ============================================================
// AUTH: PASSWORT ZURUECKSETZEN (Admin)
// ============================================================

export const resetPasswordSchema = z.object({
  id: z.number().int().positive("Ungueltige Benutzer-ID."),
  neuesPasswort: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein.")
    .max(200),
});

// ============================================================
// EINSTELLUNGEN: SCHULEN
// ============================================================

export const createSchuleSchema = z.object({
  schulnummer: z.string().min(1, "Schulnummer erforderlich.").max(10),
  name: z.string().min(1, "Name erforderlich.").max(200),
  kurzname: z.string().min(1, "Kurzname erforderlich.").max(10),
  schulform: z.string().min(1, "Schulform erforderlich.").max(50),
  farbe: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Format: #RRGGBB").default("#575756"),
  untisCode: z.string().max(10).optional(),
  adresse: z.string().max(300).optional(),
  plz: z.string().max(5).optional(),
  ort: z.string().max(100).optional(),
  istImAufbau: z.boolean().default(false),
});

export const updateSchuleSchema = createSchuleSchema.extend({
  id: z.number().int().positive("Ungueltige Schul-ID."),
});

// ============================================================
// EINSTELLUNGEN: SCHUL-STUFEN
// ============================================================

export const createSchulStufeSchema = z.object({
  schuleId: z.number().int().positive("Ungueltige Schule."),
  stufe: z.string().min(1, "Stufenname erforderlich.").max(50),
  schulformTyp: z.string().min(1, "Schulform-Typ erforderlich.").max(50),
});

export const updateSchulStufeSchema = createSchulStufeSchema.extend({
  id: z.number().int().positive("Ungueltige Stufen-ID."),
});

// ============================================================
// EINSTELLUNGEN: SCHULJAHR
// ============================================================

export const schuljahrSchema = z.object({
  bezeichnung: z
    .string()
    .regex(/^\d{4}\/\d{4}$/, "Format: JJJJ/JJJJ (z.B. 2026/2027)")
    .max(20),
  startDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungueltiges Datumsformat."),
  endDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungueltiges Datumsformat."),
});

// ============================================================
// EINSTELLUNGEN: HAUSHALTSJAHR
// ============================================================

export const haushaltsjahrSchema = z.object({
  jahr: z.number().int().min(2020, "Jahr muss >= 2020 sein.").max(2050, "Jahr muss <= 2050 sein."),
  stichtagVorjahr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungueltiges Datumsformat."),
  stichtagLaufend: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungueltiges Datumsformat."),
});

// ============================================================
// HELPER: FormData sicher zu Number parsen
// ============================================================

export function safeFormNumber(formData: FormData, key: string): number {
  const raw = formData.get(key);
  if (raw === null || raw === undefined || raw === "") return NaN;
  const num = Number(raw);
  if (!Number.isFinite(num)) return NaN;
  return num;
}

export function safeFormString(formData: FormData, key: string, maxLength = 500): string {
  const raw = formData.get(key);
  if (raw === null || raw === undefined) return "";
  return String(raw).slice(0, maxLength);
}

// ============================================================
// STELLENANTEILE
// ============================================================

const stellenanteilWert = z
  .string()
  .transform((v) => v.replaceAll(",", "."))
  .pipe(z.string().regex(/^-?\d{1,4}(\.\d{1,4})?$/, "Ungueltiger Stellenanteil (z.B. 0,5 oder 2,0)."));

/** EUR-Betrag: Leer/undefined = kein Betrag, sonst Zahl mit max. 2 Dezimalstellen */
const eurBetragSchema = z.union([
  z.literal(""),
  z.undefined(),
  z
    .string()
    .transform((v) => v.replaceAll(",", "."))
    .pipe(z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, "Ungueltiger EUR-Betrag (z.B. 20200 oder 12500.50).")),
]);

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungueltiges Datum.").optional().or(z.literal(""));

export const stellenanteilCreateSchema = z.object({
  schuleId: z.number().int().positive(),
  haushaltsjahrId: z.number().int().positive(),
  stellenartTypId: z.number().int().positive("Stellenart auswaehlen."),
  lehrerId: z.number().int().positive().optional().nullable(),
  wert: stellenanteilWert,
  eurBetrag: eurBetragSchema,
  wahlrecht: z.enum(["stelle", "geld"]).optional().nullable(),
  zeitraum: z.enum(["ganzjahr", "jan-jul", "aug-dez"]),
  status: z.enum(["beantragt", "genehmigt", "abgelehnt", "zurueckgezogen"]).default("beantragt"),
  befristetBis: optionalDate,
  antragsdatum: optionalDate,
  aktenzeichen: z.string().max(100).optional(),
  dmsDokumentennummer: z.string().max(100).optional(),
  bemerkung: z.string().max(1000).optional(),
});

export const stellenanteilUpdateSchema = stellenanteilCreateSchema.extend({
  id: z.number().int().positive(),
});

export const stellenartTypCreateSchema = z.object({
  bezeichnung: z.string().min(1, "Bezeichnung erforderlich.").max(150),
  kurzbezeichnung: z.string().max(30).optional(),
  beschreibung: z.string().max(500).optional(),
  rechtsgrundlage: z.string().max(300).optional(),
  bindungstyp: z.enum(["schule", "person", "beides"]),
  istIsoliert: z.boolean().default(false),
});

// ============================================================
// STATISTIK-CODES (NRW Personalstatistik)
// ============================================================

const sortierungSchema = z
  .number({ error: "Sortierung muss eine Zahl sein." })
  .int("Sortierung muss eine ganze Zahl sein.")
  .min(0, "Sortierung darf nicht negativ sein.");

export const statistikCodeCreateSchema = z.object({
  code: z
    .string()
    .min(1, "Code erforderlich.")
    .max(5)
    .regex(/^[A-Z]{1,5}$/, "Code: nur 1-5 Grossbuchstaben (A-Z)."),
  bezeichnung: z.string().min(1, "Bezeichnung erforderlich.").max(150),
  gruppe: z.enum(["beamter", "angestellter", "sonstiges"]),
  istTeilzeit: z.boolean().default(false),
  sortierung: sortierungSchema.default(0),
  bemerkung: z.string().max(1000).optional(),
});

export const statistikCodeUpdateSchema = z.object({
  bezeichnung: z.string().min(1, "Bezeichnung erforderlich.").max(150),
  gruppe: z.enum(["beamter", "angestellter", "sonstiges"]),
  istTeilzeit: z.boolean(),
  sortierung: sortierungSchema,
  bemerkung: z.string().max(1000).optional(),
});

// ============================================================
// LEHRER (manuelle Anlage)
// ============================================================

export const createLehrerManualSchema = z.object({
  vorname: z.string().min(1, "Vorname erforderlich.").max(100),
  nachname: z.string().min(1, "Nachname erforderlich.").max(100),
  personalnummer: z.string().max(20).optional().or(z.literal("")),
  stammschuleId: z.number().int().positive("Schule auswaehlen."),
  // Statistik-Code optional (leerer String = kein Code).
  // Whitelisting passiert serverseitig via FK; Format hier nur grob.
  statistikCode: z
    .string()
    .max(5)
    .regex(/^[A-Z]{1,5}$/, "Ungueltiges Code-Format.")
    .optional()
    .or(z.literal("")),
});
