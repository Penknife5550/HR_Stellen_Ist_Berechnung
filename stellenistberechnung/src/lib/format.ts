/**
 * Formatierungshilfen fuer deutsche Zahlen und Datumsformate.
 */

/** Zahl im deutschen Format: 1.234,56 */
export function formatNumberDE(value: number, decimals = 2): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Datum im deutschen Format: TT.MM.JJJJ */
export function formatDateDE(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** EUR-Betrag: 1.234,50 EUR */
export function formatEurDE(value: number): string {
  return `${formatNumberDE(value, 2)} €`;
}

/** Stellen-Anzeige: z.B. "28,4" */
export function formatStellen(value: number): string {
  return formatNumberDE(value, 1);
}

/** Differenz mit Vorzeichen: "+2,3" oder "-1,5" */
export function formatDifferenz(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumberDE(value, 1)}`;
}
