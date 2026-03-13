/**
 * Stellenist-Berechnung aus monatlichen Deputatsdaten.
 *
 * Das Stellenist ist die Summe der tatsaechlich besetzten Stellen (FTE).
 *
 * Formel (wie im Excel):
 *   Stellenist Jan-Jul = Summe(Wochenstunden Jan-Jul) / (7 x Regeldeputat)
 *   Stellenist Aug-Dez = Summe(Wochenstunden Aug-Dez) / (5 x Regeldeputat)
 *   + Mehrarbeit-Stellen
 *   = Stellenist gesamt
 */

import { roundToDecimals } from "./rounding";

export interface MonatlicheStunden {
  monat: number;            // 1-12
  stunden: number;          // Summe Wochenstunden aller Lehrer an dieser Schule
}

export interface StellenistInput {
  monatlicheStunden: MonatlicheStunden[];
  regeldeputat: number;     // z.B. 25.5 Wochenstunden
  mehrarbeitStunden: MonatlicheStunden[];
}

export interface ZeitraumErgebnis {
  summeStunden: number;
  anzahlMonate: number;
  monatsDurchschnitt: number;
  stellen: number;
}

export interface StellenistErgebnis {
  janJul: ZeitraumErgebnis;
  augDez: ZeitraumErgebnis;
  mehrarbeitStellen: { janJul: number; augDez: number };
  gesamtStellen: { janJul: number; augDez: number };
  stellenistGerundet: number;  // Gewichteter Jahresdurchschnitt, 1 Dezimalstelle
}

/**
 * Berechnet das Stellenist aus monatlichen Deputatsdaten.
 */
export function berechneStellenist(input: StellenistInput): StellenistErgebnis {
  // Regulaere Stunden nach Zeitraum
  const janJulStunden = input.monatlicheStunden
    .filter((m) => m.monat >= 1 && m.monat <= 7)
    .reduce((sum, m) => sum + m.stunden, 0);

  const augDezStunden = input.monatlicheStunden
    .filter((m) => m.monat >= 8 && m.monat <= 12)
    .reduce((sum, m) => sum + m.stunden, 0);

  // Mehrarbeit nach Zeitraum
  const janJulMehrarbeit = input.mehrarbeitStunden
    .filter((m) => m.monat >= 1 && m.monat <= 7)
    .reduce((sum, m) => sum + m.stunden, 0);

  const augDezMehrarbeit = input.mehrarbeitStunden
    .filter((m) => m.monat >= 8 && m.monat <= 12)
    .reduce((sum, m) => sum + m.stunden, 0);

  // Stellen berechnen
  const janJulStellen = input.regeldeputat > 0
    ? janJulStunden / (7 * input.regeldeputat)
    : 0;
  const augDezStellen = input.regeldeputat > 0
    ? augDezStunden / (5 * input.regeldeputat)
    : 0;

  // Mehrarbeit in Stellen umrechnen
  const mehrarbeitJanJul = input.regeldeputat > 0
    ? janJulMehrarbeit / (7 * input.regeldeputat)
    : 0;
  const mehrarbeitAugDez = input.regeldeputat > 0
    ? augDezMehrarbeit / (5 * input.regeldeputat)
    : 0;

  // Gewichteter Jahresdurchschnitt: (Jan-Jul * 7 + Aug-Dez * 5) / 12
  const gesamtJanJul = janJulStellen + mehrarbeitJanJul;
  const gesamtAugDez = augDezStellen + mehrarbeitAugDez;
  const gewichtet = (gesamtJanJul * 7 + gesamtAugDez * 5) / 12;

  return {
    janJul: {
      summeStunden: janJulStunden,
      anzahlMonate: 7,
      monatsDurchschnitt: janJulStunden / 7,
      stellen: janJulStellen,
    },
    augDez: {
      summeStunden: augDezStunden,
      anzahlMonate: 5,
      monatsDurchschnitt: augDezStunden / 5,
      stellen: augDezStellen,
    },
    mehrarbeitStellen: {
      janJul: mehrarbeitJanJul,
      augDez: mehrarbeitAugDez,
    },
    gesamtStellen: {
      janJul: gesamtJanJul,
      augDez: gesamtAugDez,
    },
    stellenistGerundet: roundToDecimals(gewichtet, 1),
  };
}
