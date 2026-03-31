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

// Navigation: Siehe Sidebar.tsx (dort als einzige Quelle definiert)
