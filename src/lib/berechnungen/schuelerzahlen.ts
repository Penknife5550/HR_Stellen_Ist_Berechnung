/**
 * Schuelerzahlen-Datumslogik nach NRW-Recht.
 *
 * Regeln (§ 3 FESchVO, VV zu § 3 FESchVO):
 * - Stichtag: 15. Oktober (amtliche Schulstatistik)
 * - Jan-Jul: Schuelerzahl vom 15.10. des VORJAHRES
 * - Aug-Dez: Schuelerzahl vom 15.10. des LAUFENDEN Jahres
 * - Sonderfall Aufbauschulen: Immer laufendes Jahr
 */

/**
 * Ermittelt den massgeblichen Stichtag fuer einen Monat im Haushaltsjahr.
 */
export function getStichtagFuerMonat(
  haushaltsjahr: number,
  monat: number,
  istImAufbau: boolean
): Date {
  if (istImAufbau) {
    // Schulen im Aufbau: immer laufendes Jahr
    return new Date(haushaltsjahr, 9, 15); // 15. Oktober laufendes Jahr
  }

  if (monat >= 1 && monat <= 7) {
    // Januar bis Juli: Vorjahr
    return new Date(haushaltsjahr - 1, 9, 15); // 15. Oktober Vorjahr
  }

  // August bis Dezember: laufendes Jahr
  return new Date(haushaltsjahr, 9, 15);
}

/**
 * Gibt die beiden massgeblichen Stichtage fuer ein Haushaltsjahr zurueck.
 */
export function getStichtageFuerHaushaltsjahr(
  haushaltsjahr: number,
  istImAufbau: boolean
): { janJul: Date; augDez: Date } {
  return {
    janJul: getStichtagFuerMonat(haushaltsjahr, 1, istImAufbau),
    augDez: getStichtagFuerMonat(haushaltsjahr, 8, istImAufbau),
  };
}

/**
 * Bestimmt den Zeitraum ("jan_jul" oder "aug_dez") fuer einen Monat.
 */
export function getZeitraumFuerMonat(monat: number): "jan_jul" | "aug_dez" {
  return monat >= 1 && monat <= 7 ? "jan_jul" : "aug_dez";
}

/**
 * Anzahl der Monate pro Zeitraum.
 */
export function getMonateImZeitraum(zeitraum: "jan_jul" | "aug_dez"): number {
  return zeitraum === "jan_jul" ? 7 : 5;
}
