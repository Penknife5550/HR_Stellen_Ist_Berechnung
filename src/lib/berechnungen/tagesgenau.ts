/**
 * Tagesgenaue Deputats-Korrektur.
 *
 * Wenn HR in der Aenderungshistorie ein tatsaechliches Datum eintraegt,
 * wird der Monatswert nicht pauschal (letzter Sync-Wert) genommen,
 * sondern tagesgewichtet berechnet — analog zur Excel-Hilfstabelle (Spalten T/U/V).
 *
 * Formel (wie im Excel):
 *   Monats-Deputat = (Std_alt / Monatstage * Tage_alt) + (Std_neu / Monatstage * Tage_neu)
 *
 * Beispiel: Aenderung am 09.02. von 10→17 Std. im Februar (28 Tage):
 *   (10/28 * 8) + (17/28 * 20) = 2,86 + 12,14 = 15,0 Std.
 *   Statt pauschal 17 (letzter Sync-Wert).
 *
 * Rechtsgrundlage: § 3 Abs. 1 FESchVO — tagesgenaue Erfassung.
 */

/**
 * Gibt die Anzahl Tage im Monat zurueck.
 */
function tageImMonat(jahr: number, monat: number): number {
  // new Date(jahr, monat, 0) gibt den letzten Tag des Monats
  return new Date(jahr, monat, 0).getDate();
}

export interface TagesgenauAenderung {
  lehrerId: number;
  monat: number;
  /** Altes Deputat (vor der Aenderung) */
  altGesamt: number;
  altGes: number;
  altGym: number;
  altBk: number;
  /** Neues Deputat (nach der Aenderung) */
  neuGesamt: number;
  neuGes: number;
  neuGym: number;
  neuBk: number;
  /** Tag im Monat an dem die Aenderung stattfand (1-31) */
  aenderungTag: number;
  /** Gesamttage im Monat */
  monatsTage: number;
  stammschuleCode: string | null;
}

export interface TagesgenauKorrektur {
  monat: number;
  /** Differenz zur pauschalen Summe fuer die Schule (kann positiv oder negativ sein) */
  differenzSchulspezifisch: number;
}

/**
 * Berechnet die tagesgewichteten Korrekturen fuer eine Schule.
 *
 * @param aenderungen - Alle Aenderungen mit tatsaechlichem Datum
 * @param schulKurzname - GES, GYM, BK, GSH, GSM, GSS etc.
 * @param jahr - Kalenderjahr (fuer Tage-im-Monat Berechnung)
 * @returns Array von Korrekturen pro Monat
 */
export function berechneTagesgenauKorrekturen(
  aenderungen: TagesgenauAenderung[],
  schulKurzname: string,
  jahr: number,
): TagesgenauKorrektur[] {
  const korrekturen: TagesgenauKorrektur[] = [];

  // Schulspezifische Spalte bestimmen
  const spalteMap: Record<string, "ges" | "gym" | "bk"> = {
    GES: "ges",
    GYM: "gym",
    BK: "bk",
  };
  const spalte = spalteMap[schulKurzname];

  // Nach Monat gruppieren
  const byMonat = new Map<number, TagesgenauAenderung[]>();
  for (const a of aenderungen) {
    const arr = byMonat.get(a.monat) ?? [];
    arr.push(a);
    byMonat.set(a.monat, arr);
  }

  for (const [monat, monatsAenderungen] of byMonat) {
    let gesamtKorrektur = 0;
    const tage = tageImMonat(jahr, monat);

    for (const a of monatsAenderungen) {
      // Alt- und Neu-Werte fuer diese Schule
      let altWert: number;
      let neuWert: number;

      if (spalte) {
        // GES/GYM/BK: schulspezifische Spalte
        altWert = spalte === "ges" ? a.altGes : spalte === "gym" ? a.altGym : a.altBk;
        neuWert = spalte === "ges" ? a.neuGes : spalte === "gym" ? a.neuGym : a.neuBk;
      } else {
        // Grundschulen: nur wenn Lehrer zu dieser Schule gehoert
        if (a.stammschuleCode !== schulKurzname) continue;
        altWert = a.altGesamt;
        neuWert = a.neuGesamt;
      }

      // Wenn alt == neu fuer diese Schule → keine Korrektur noetig
      if (Math.abs(altWert - neuWert) < 0.001) continue;

      // Tage vor und nach der Aenderung
      const tageBisAenderung = a.aenderungTag - 1; // Tag 1-based, also Tag 9 → 8 Tage vorher
      const tageAbAenderung = tage - tageBisAenderung;

      // Tagesgewichteter Wert
      const gewichteterWert = (altWert * tageBisAenderung + neuWert * tageAbAenderung) / tage;

      // Der pauschale Wert in der DB ist neuWert (letzter Sync gewinnt)
      // Korrektur = gewichteter Wert - pauschaler Wert
      const korrektur = gewichteterWert - neuWert;

      gesamtKorrektur += korrektur;
    }

    if (Math.abs(gesamtKorrektur) > 0.001) {
      korrekturen.push({ monat, differenzSchulspezifisch: gesamtKorrektur });
    }
  }

  return korrekturen;
}
