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
  schuljahr_text: z.string().optional(),
});

export const syncPayloadSchema = z.object({
  api_key: z.string().min(1),
  sync_datum: z.string().min(1, "sync_datum fehlt."),
  schuljahr_text: z.string().optional(),
  term_id: z.number().int().positive().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  lehrer: z.array(lehrerPayloadSchema).min(1, "Mindestens 1 Lehrer erforderlich.").max(500, "Maximal 500 Lehrer pro Sync."),
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
// LEHRER (manuelle Anlage)
// ============================================================

export const createLehrerManualSchema = z.object({
  vorname: z.string().min(1, "Vorname erforderlich.").max(100),
  nachname: z.string().min(1, "Nachname erforderlich.").max(100),
  personalnummer: z.string().max(20).optional().or(z.literal("")),
  stammschuleId: z.number().int().positive("Schule auswaehlen."),
});
