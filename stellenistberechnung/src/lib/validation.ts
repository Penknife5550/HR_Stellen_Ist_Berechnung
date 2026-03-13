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
// SLR-WERTE
// ============================================================

export const slrWertSchema = z
  .string()
  .transform((v) => v.replace(",", "."))  // DE-Eingabe: Komma → Punkt
  .pipe(
    z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Ungueltige SLR (z.B. 19,87 oder 12,70).")
  );

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
// PFLICHTSTUNDEN
// ============================================================

export const pflichtstundenWertSchema = z
  .string()
  .transform((v) => v.replace(",", "."))
  .pipe(
    z.string().regex(/^\d{1,2}(\.\d)?$/, "Ungueltige Pflichtstundenzahl (z.B. 25,5 oder 28,0).")
  )
  .refine((v) => Number(v) >= 1 && Number(v) <= 50, "Pflichtstunden muessen zwischen 1 und 50 liegen.");

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
