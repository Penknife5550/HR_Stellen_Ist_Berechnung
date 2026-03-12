import { describe, it, expect } from "vitest";
import { berechneStellenist } from "@/lib/berechnungen/stellenist";

describe("berechneStellenist", () => {
  const REGELDEPUTAT = 25.5;

  it("berechnet Stellenist fuer Jan-Jul korrekt", () => {
    // Beispiel: 7 Monate mit je 500 Wochenstunden
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 1, stunden: 500 },
        { monat: 2, stunden: 500 },
        { monat: 3, stunden: 500 },
        { monat: 4, stunden: 500 },
        { monat: 5, stunden: 500 },
        { monat: 6, stunden: 500 },
        { monat: 7, stunden: 500 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // Summe: 3500, Formel: 3500 / (7 * 25.5) = 3500 / 178.5 = 19.607...
    expect(result.janJul.summeStunden).toBe(3500);
    expect(result.janJul.anzahlMonate).toBe(7);
    expect(result.janJul.stellen).toBeCloseTo(19.6078, 3);
  });

  it("berechnet Stellenist fuer Aug-Dez korrekt", () => {
    // Beispiel: 5 Monate mit je 500 Wochenstunden
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 8, stunden: 500 },
        { monat: 9, stunden: 500 },
        { monat: 10, stunden: 500 },
        { monat: 11, stunden: 500 },
        { monat: 12, stunden: 500 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // Summe: 2500, Formel: 2500 / (5 * 25.5) = 2500 / 127.5 = 19.607...
    expect(result.augDez.summeStunden).toBe(2500);
    expect(result.augDez.anzahlMonate).toBe(5);
    expect(result.augDez.stellen).toBeCloseTo(19.6078, 3);
  });

  it("berechnet gewichteten Jahresdurchschnitt korrekt", () => {
    // Jan-Jul: 20 Stellen, Aug-Dez: 22 Stellen
    // Gewichtet: (20 * 7 + 22 * 5) / 12 = (140 + 110) / 12 = 250 / 12 = 20.833...
    const result = berechneStellenist({
      monatlicheStunden: [
        // Jan-Jul: Stunden die 20 Stellen ergeben: 20 * 7 * 25.5 = 3570
        { monat: 1, stunden: 510 },
        { monat: 2, stunden: 510 },
        { monat: 3, stunden: 510 },
        { monat: 4, stunden: 510 },
        { monat: 5, stunden: 510 },
        { monat: 6, stunden: 510 },
        { monat: 7, stunden: 510 },
        // Aug-Dez: Stunden die 22 Stellen ergeben: 22 * 5 * 25.5 = 2805
        { monat: 8, stunden: 561 },
        { monat: 9, stunden: 561 },
        { monat: 10, stunden: 561 },
        { monat: 11, stunden: 561 },
        { monat: 12, stunden: 561 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // Jan-Jul: 3570 / (7 * 25.5) = 3570 / 178.5 = 20.0
    expect(result.janJul.stellen).toBe(20);
    // Aug-Dez: 2805 / (5 * 25.5) = 2805 / 127.5 = 22.0
    expect(result.augDez.stellen).toBe(22);
    // Gewichtet: (20 * 7 + 22 * 5) / 12 = 20.833... → gerundet auf 20.8
    expect(result.stellenistGerundet).toBe(20.8);
  });

  it("beruecksichtigt Mehrarbeit korrekt", () => {
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 1, stunden: 510 },
        { monat: 2, stunden: 510 },
        { monat: 3, stunden: 510 },
        { monat: 4, stunden: 510 },
        { monat: 5, stunden: 510 },
        { monat: 6, stunden: 510 },
        { monat: 7, stunden: 510 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [
        { monat: 1, stunden: 10 },
        { monat: 2, stunden: 10 },
        { monat: 3, stunden: 10 },
        { monat: 4, stunden: 10 },
        { monat: 5, stunden: 10 },
        { monat: 6, stunden: 10 },
        { monat: 7, stunden: 10 },
      ],
    });

    // Mehrarbeit: 70 / (7 * 25.5) = 70 / 178.5 = 0.3921...
    expect(result.mehrarbeitStellen.janJul).toBeCloseTo(0.3921, 3);
    // Gesamt: 20.0 + 0.3921 = 20.3921...
    expect(result.gesamtStellen.janJul).toBeCloseTo(20.3921, 3);
  });

  it("behandelt leere Eingabe", () => {
    const result = berechneStellenist({
      monatlicheStunden: [],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    expect(result.janJul.summeStunden).toBe(0);
    expect(result.augDez.summeStunden).toBe(0);
    expect(result.janJul.stellen).toBe(0);
    expect(result.augDez.stellen).toBe(0);
    expect(result.stellenistGerundet).toBe(0);
  });

  it("behandelt Regeldeputat = 0 ohne Division durch Null", () => {
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 1, stunden: 500 },
      ],
      regeldeputat: 0,
      mehrarbeitStunden: [],
    });

    // Bei Regeldeputat 0 soll kein Infinity/NaN entstehen
    expect(result.janJul.stellen).toBe(0);
    expect(Number.isFinite(result.stellenistGerundet)).toBe(true);
  });

  it("berechnet korrekt mit unvollstaendigen Monaten", () => {
    // Nur 3 von 7 Monaten haben Daten (z.B. Schuljahresbeginn)
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 1, stunden: 400 },
        { monat: 2, stunden: 400 },
        { monat: 3, stunden: 400 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // Summe: 1200, Formel: 1200 / (7 * 25.5) = 1200 / 178.5 = 6.7226...
    expect(result.janJul.summeStunden).toBe(1200);
    expect(result.janJul.stellen).toBeCloseTo(6.7226, 3);
  });

  it("berechnet Monatsdurchschnitt korrekt", () => {
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 1, stunden: 300 },
        { monat: 2, stunden: 400 },
        { monat: 3, stunden: 500 },
        { monat: 4, stunden: 600 },
        { monat: 5, stunden: 500 },
        { monat: 6, stunden: 400 },
        { monat: 7, stunden: 300 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // Summe: 3000, Durchschnitt: 3000 / 7 = 428.571...
    expect(result.janJul.summeStunden).toBe(3000);
    expect(result.janJul.monatsDurchschnitt).toBeCloseTo(428.5714, 3);
  });

  it("berechnet ein realistisches Beispiel (GES mit 20 Lehrern)", () => {
    // 20 Lehrer × 25.5 Wochenstunden = 510 Wochenstunden/Monat
    // = exakt 20 Stellen
    const monatlicheStunden = Array.from({ length: 12 }, (_, i) => ({
      monat: i + 1,
      stunden: 510,
    }));

    const result = berechneStellenist({
      monatlicheStunden,
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // Jan-Jul: 3570 / (7 * 25.5) = 20.0
    expect(result.janJul.stellen).toBe(20);
    // Aug-Dez: 2550 / (5 * 25.5) = 20.0
    expect(result.augDez.stellen).toBe(20);
    // Gewichtet: (20 * 7 + 20 * 5) / 12 = 20.0
    expect(result.stellenistGerundet).toBe(20);
  });

  it("rundet Endergebnis korrekt auf 1 Dezimalstelle", () => {
    // Konstruiere einen Fall der auf x.x5 endet (Aufrundung)
    // Jan-Jul Stellen: 510 / 178.5 * 7 Monate → aber mit Variation
    const result = berechneStellenist({
      monatlicheStunden: [
        { monat: 1, stunden: 523 },
        { monat: 2, stunden: 523 },
        { monat: 3, stunden: 523 },
        { monat: 4, stunden: 523 },
        { monat: 5, stunden: 523 },
        { monat: 6, stunden: 523 },
        { monat: 7, stunden: 523 },
        { monat: 8, stunden: 523 },
        { monat: 9, stunden: 523 },
        { monat: 10, stunden: 523 },
        { monat: 11, stunden: 523 },
        { monat: 12, stunden: 523 },
      ],
      regeldeputat: REGELDEPUTAT,
      mehrarbeitStunden: [],
    });

    // 523 * 7 / (7 * 25.5) = 523 / 25.5 = 20.5098...
    // Gewichtet gleich → 20.5
    expect(result.stellenistGerundet).toBe(20.5);
  });
});
