/**
 * Rundungs-Utilities fuer die Stellenistberechnung nach NRW-Recht.
 *
 * KRITISCH: Diese Funktionen implementieren die gesetzlich vorgeschriebenen
 * Rundungsregeln fuer Ersatzschulen in NRW (§ 3 FESchVO).
 *
 * Fehler hier fuehren zu falschen Stellenberechnungen und finanziellem Schaden!
 */

/**
 * ABSCHNEIDEN nach n Dezimalstellen (NICHT runden!).
 *
 * Laut NRW-Recht muessen Teilergebnisse der Grundstellenberechnung
 * nach 2 Dezimalstellen abgeschnitten werden.
 *
 * Beispiel: 28.448738 → 28.44 (NICHT 28.45!)
 *
 * Verwendet String-basierte Berechnung um Floating-Point-Fehler zu vermeiden.
 */
export function truncateToDecimals(value: number, decimals: number): number {
  // String-basiert um Floating-Point-Probleme zu vermeiden
  // z.B. Math.trunc(1.005 * 100) / 100 kann falsch sein
  const str = value.toString();
  const dotIndex = str.indexOf(".");

  if (dotIndex === -1) {
    return value; // Ganzzahl, nichts abzuschneiden
  }

  const integerPart = str.substring(0, dotIndex);
  const decimalPart = str.substring(dotIndex + 1);

  if (decimalPart.length <= decimals) {
    return value; // Weniger Dezimalstellen als gewuenscht
  }

  const truncated = `${integerPart}.${decimalPart.substring(0, decimals)}`;
  return parseFloat(truncated);
}

/**
 * Kaufmaennisches Runden auf n Dezimalstellen.
 *
 * Fuer das Gesamtergebnis der Grundstellenberechnung:
 * Auf 1 Dezimalstelle runden.
 */
export function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Auf volle 10 EUR runden (kaufmaennisch).
 *
 * Fuer Personalbedarfs- und Personalnebenkostenpauschale.
 */
export function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}
