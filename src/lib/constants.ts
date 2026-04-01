// CREDO Corporate Design Farben
export const SCHULFORM_CONFIG = {
  GES: {
    label: "Gesamtschule",
    kurzname: "GES",
    farbe: "#6BAA24",
    farbeHell: "#E8F5D6",
    reihenfolge: 1,
  },
  GYM: {
    label: "Gymnasium",
    kurzname: "GYM",
    farbe: "#FBC900",
    farbeHell: "#FEF7CC",
    reihenfolge: 2,
  },
  BK: {
    label: "Berufskolleg",
    kurzname: "BK",
    farbe: "#5C82A5",
    farbeHell: "#DFE8EF",
    reihenfolge: 3,
  },
  GSH: {
    label: "Grundschule Herford",
    kurzname: "GSH",
    farbe: "#E2001A",
    farbeHell: "#FCE4E8",
    reihenfolge: 4,
  },
  GSM: {
    label: "Grundschule Minden",
    kurzname: "GSM",
    farbe: "#009AC6",
    farbeHell: "#CCF0FA",
    reihenfolge: 5,
  },
  GSS: {
    label: "Grundschule Stemwede",
    kurzname: "GSS",
    farbe: "#8B5E3C",
    farbeHell: "#F0E6DC",
    reihenfolge: 6,
  },
} as const;

export type SchulformCode = keyof typeof SCHULFORM_CONFIG;

// SLR Standardwerte 2025/2026
// Rechtsgrundlage: § 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)
export const SLR_DEFAULTS_2025_2026 = {
  "Grundschule": 21.95,
  "Hauptschule": 17.86,
  "Realschule": 20.19,
  "Sekundarschule": 16.27,
  "Gymnasium Sek I (G8)": 19.17,
  "Gymnasium Sek I (G9)": 19.87,
  "Gymnasium Sek II": 12.70,
  "Gesamtschule Sek I": 18.63,
  "Gesamtschule Sek II": 12.70,
  "Berufskolleg Teilzeit": 41.64,
  "Berufskolleg Vollzeit": 16.18,
} as const;

// Monate (deutsch)
export const MONATE = [
  "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

export const MONATE_KURZ = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
] as const;

// Regelstundendeputat — Fallback wenn kein DB-Eintrag in Tabelle `regeldeputate` existiert
// Primaer aus DB laden via getRegeldeputateMap() (queries.ts)
export const REGELSTUNDEN_DEFAULT = "25.5";

// Schulform-Langbezeichnung fuer Vertragsunterlagen
export function getSchulformLang(schulform: string | null): string {
  switch (schulform) {
    case "Gesamtschule": return "Ev. priv. Gesamtschule";
    case "Gymnasium": return "Ev. priv. Gymnasium";
    case "Berufskolleg": return "Ev. priv. Berufskolleg";
    default: return schulform ?? "Schule";
  }
}

// Nachtrag-Status
export const NACHTRAG_STATUS = {
  OFFEN: null,
  ERSTELLT: "erstellt",
  VERSENDET: "versendet",
} as const;

// Stellenanteil-Status
export const STELLENANTEIL_STATUS = {
  BEANTRAGT: "beantragt",
  GENEHMIGT: "genehmigt",
  ABGELEHNT: "abgelehnt",
  ZURUECKGEZOGEN: "zurueckgezogen",
} as const;

export const STELLENANTEIL_STATUS_LABELS: Record<string, string> = {
  beantragt: "Beantragt",
  genehmigt: "Genehmigt",
  abgelehnt: "Abgelehnt",
  zurueckgezogen: "Zurueckgezogen",
};

export const STELLENANTEIL_STATUS_FARBEN: Record<string, { bg: string; text: string }> = {
  beantragt: { bg: "bg-amber-50 border-amber-300", text: "text-amber-800" },
  genehmigt: { bg: "bg-green-50 border-green-300", text: "text-green-800" },
  abgelehnt: { bg: "bg-red-50 border-red-300", text: "text-red-800" },
  zurueckgezogen: { bg: "bg-gray-50 border-gray-300", text: "text-gray-600" },
};

export const ZEITRAUM_OPTIONS = [
  { value: "ganzjahr", label: "Ganzjahr" },
  { value: "jan-jul", label: "Januar - Juli" },
  { value: "aug-dez", label: "August - Dezember" },
] as const;

export const BINDUNGSTYP_LABELS: Record<string, string> = {
  schule: "Schulbezogen",
  person: "Personengebunden",
  beides: "Schul- oder personengebunden",
};

// Navigation: Siehe Sidebar.tsx (dort als einzige Quelle definiert)
