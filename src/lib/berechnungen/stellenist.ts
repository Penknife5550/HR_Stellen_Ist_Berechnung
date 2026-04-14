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

export interface MonatlicheStellen {
  monat: number;
  stellen: number;
}

export interface StellenistInput {
  monatlicheStunden: MonatlicheStunden[];
  regeldeputat: number;     // z.B. 25.5 Wochenstunden
  /** Lehrer-bezogene Mehrarbeit in Stunden (wird ueber Regeldeputat in Stellen umgerechnet) */
  mehrarbeitStunden: MonatlicheStunden[];
  /** Schulweite Mehrarbeit direkt in Stellenanteilen (Pauschale, flieszt 1:1 in Stellen) */
  mehrarbeitStellen?: MonatlicheStellen[];
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

  // Lehrer-Mehrarbeit (Stunden) in Stellen umrechnen
  const mehrarbeitJanJulStd = input.regeldeputat > 0
    ? janJulMehrarbeit / (7 * input.regeldeputat)
    : 0;
  const mehrarbeitAugDezStd = input.regeldeputat > 0
    ? augDezMehrarbeit / (5 * input.regeldeputat)
    : 0;

  // Schulweite Mehrarbeit direkt als Stellenanteil (monatlich → Jahresanteil pro Zeitraum)
  // Ein Monat mit 0,1 Stellenanteil zaehlt 1/12 Jahr = 0,1 × (1/7) fuer den Zeitraum jan-jul etc.
  // Vereinfacht: wir mitteln ueber die Monate im Zeitraum (da die Stellenist-Formel sich auch am
  // Monatsdurchschnitt orientiert). Eine Schule, die jeden Monat im Zeitraum 0,1 Stellen
  // Mehrarbeit hat, ergibt also 0,1 Stellen Mehrarbeit in diesem Zeitraum.
  const stellenanteile = input.mehrarbeitStellen ?? [];
  const janJulStellenanteilSumme = stellenanteile
    .filter((m) => m.monat >= 1 && m.monat <= 7)
    .reduce((s, m) => s + m.stellen, 0);
  const augDezStellenanteilSumme = stellenanteile
    .filter((m) => m.monat >= 8 && m.monat <= 12)
    .reduce((s, m) => s + m.stellen, 0);
  const mehrarbeitJanJulPauschal = janJulStellenanteilSumme / 7;
  const mehrarbeitAugDezPauschal = augDezStellenanteilSumme / 5;

  const mehrarbeitJanJul = mehrarbeitJanJulStd + mehrarbeitJanJulPauschal;
  const mehrarbeitAugDez = mehrarbeitAugDezStd + mehrarbeitAugDezPauschal;

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
