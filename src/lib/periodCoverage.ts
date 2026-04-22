/**
 * Coverage-Logik fuer Untis-Perioden → Kalendermonat-Zuordnung.
 *
 * Ein Haushaltsjahr umfasst ~7 Monate, wird in Untis aber durch viele
 * (oft sehr kurze) Perioden abgebildet. Beruehren mehrere Perioden
 * denselben Kalendermonat, muss die App entscheiden, welcher
 * Deputatswert fuer den Monat gilt.
 *
 * Regel: Die Periode mit den meisten Kalendertagen im Monat gewinnt.
 * Bei Gleichstand gewinnt die chronologisch spaetere Periode (groesseres
 * date_from) — robust auch ueber Schuljahreswechsel hinweg, da die
 * untis_term_id pro Schuljahr neu bei 1 startet.
 */

/**
 * Tage, die eine Periode im gegebenen Kalendermonat abdeckt.
 * Beide Enden inklusiv.
 *
 * @param periodStart ISO-Datum (YYYY-MM-DD) oder Date — Start der Periode
 * @param periodEnd   ISO-Datum (YYYY-MM-DD) oder Date — Ende der Periode (inklusiv)
 * @param jahr        Kalenderjahr
 * @param monat       Monat 1–12
 * @returns Anzahl Tage der Ueberlappung (0 wenn keine Ueberlappung)
 */
export function tageImMonat(
  periodStart: string | Date,
  periodEnd: string | Date,
  jahr: number,
  monat: number
): number {
  const start = toDate(periodStart);
  const end = toDate(periodEnd);
  if (!start || !end) return 0;
  if (end < start) return 0;

  // Monatsgrenzen (UTC-neutral; wir rechnen nur in Tagen)
  const monatStart = new Date(Date.UTC(jahr, monat - 1, 1));
  const monatEnd = new Date(Date.UTC(jahr, monat, 0)); // letzter Tag des Monats

  const overlapStart = start > monatStart ? start : monatStart;
  const overlapEnd = end < monatEnd ? end : monatEnd;
  if (overlapEnd < overlapStart) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / msPerDay) + 1;
}

/**
 * Entscheidet, ob die neue Periode den bestehenden Monatseintrag
 * ueberschreiben darf.
 *
 * Gibt true zurueck wenn
 *   - noch kein Eintrag existiert, ODER
 *   - der bestehende Eintrag keine Coverage-Info hat (Altdaten), ODER
 *   - die neue Periode mehr Tage im Monat abdeckt, ODER
 *   - gleich viele Tage und neueres date_from.
 */
export function neuePeriodeGewinnt(params: {
  jahr: number;
  monat: number;
  neueDateFrom: string | Date;
  neueDateTo: string | Date;
  bestehendeDateFrom: string | Date | null | undefined;
  bestehendeDateTo: string | Date | null | undefined;
}): boolean {
  const { jahr, monat, neueDateFrom, neueDateTo, bestehendeDateFrom, bestehendeDateTo } = params;

  // Keine Coverage-Info beim Bestehenden → immer ueberschreiben
  if (!bestehendeDateFrom || !bestehendeDateTo) return true;

  const neueTage = tageImMonat(neueDateFrom, neueDateTo, jahr, monat);
  const bestehendeTage = tageImMonat(bestehendeDateFrom, bestehendeDateTo, jahr, monat);

  if (neueTage > bestehendeTage) return true;
  if (neueTage < bestehendeTage) return false;

  // Gleichstand: chronologisch spaetere Periode gewinnt
  const neueStart = toDate(neueDateFrom);
  const bestehendeStart = toDate(bestehendeDateFrom);
  if (!neueStart || !bestehendeStart) return true;
  return neueStart > bestehendeStart;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  // ISO oder YYYY-MM-DD
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Wandelt deutsches Datum "DD.MM.YYYY" in ISO-Format "YYYY-MM-DD" um.
 * Fuer n8n-Payload, das DateFrom_Formatted/DateTo_Formatted in DE-Format liefert.
 */
export function germanDateToIso(dateStr: string): string | null {
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}
