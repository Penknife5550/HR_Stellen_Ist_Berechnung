/**
 * Gemeinsame Hilfsfunktionen fuer Export-Routes.
 *
 * Zentralisiert: num(), numStr(), fmtNum(), parseJsonArray(), statusLabel()
 * Vermeidet Duplizierung in stellenplan/route.ts und berechnungsnachweis/route.ts.
 */

/**
 * Konvertiert unbekannten Wert zu number (0 als Fallback).
 */
export function num(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val) || 0;
}

/**
 * Konvertiert unbekannten Wert zu String ("0" als Fallback).
 */
export function numStr(val: unknown): string {
  if (val === null || val === undefined) return "0";
  return String(val);
}

/**
 * Formatiert Zahl im deutschen Format (Komma als Dezimaltrennzeichen).
 */
export function fmtNum(val: unknown, decimals = 2): string {
  const n = num(val);
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parsed JSONB-Feld zu Array (kommt aus DB mal als string, mal als Array).
 */
export function parseJsonArray(val: unknown): Record<string, unknown>[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

/**
 * Mapping: DB-Statuswert → Anzeigetext (deutsch).
 */
export function statusLabel(status: string | null): string {
  switch (status) {
    case "im_soll": return "Im Soll";
    case "grenzbereich": return "Grenzbereich";
    case "ueber_soll": return "Ueber Soll";
    case "nicht_berechnet": return "Nicht berechnet";
    default: return "\u2014"; // Em-Dash
  }
}
