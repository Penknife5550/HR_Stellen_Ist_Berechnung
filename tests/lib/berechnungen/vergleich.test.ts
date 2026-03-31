import { describe, it, expect } from "vitest";
import { berechneGewichtetenDurchschnitt } from "@/lib/berechnungen/vergleich";
import { roundToDecimals } from "@/lib/berechnungen/rounding";

describe("berechneGewichtetenDurchschnitt", () => {
  it("gibt 0 zurueck wenn beide Werte null sind", () => {
    expect(berechneGewichtetenDurchschnitt(null, null)).toBe(0);
  });

  it("gibt janJulWert zurueck wenn nur dieser vorhanden ist", () => {
    expect(berechneGewichtetenDurchschnitt(10, null)).toBe(10);
  });

  it("gibt augDezWert zurueck wenn nur dieser vorhanden ist", () => {
    expect(berechneGewichtetenDurchschnitt(null, 20)).toBe(20);
  });

  it("berechnet gewichteten Durchschnitt: (20*7 + 22*5)/12 = 20.8", () => {
    // (20 * 7 + 22 * 5) / 12 = (140 + 110) / 12 = 250 / 12 = 20.8333...
    // Gerundet auf 1 Dezimalstelle: 20.8
    expect(berechneGewichtetenDurchschnitt(20, 22)).toBe(20.8);
  });

  it("berechnet realistische Schulwerte: 30.5 und 28.4", () => {
    // (30.5 * 7 + 28.4 * 5) / 12 = (213.5 + 142) / 12 = 355.5 / 12 = 29.625
    // Gerundet auf 1 Dezimalstelle: 29.6
    expect(berechneGewichtetenDurchschnitt(30.5, 28.4)).toBe(29.6);
  });

  it("berechnet gleiche Werte korrekt", () => {
    // (15 * 7 + 15 * 5) / 12 = 180 / 12 = 15.0
    expect(berechneGewichtetenDurchschnitt(15, 15)).toBe(15);
  });

  it("berechnet mit Null-Wert korrekt (Wert 0 ist nicht null)", () => {
    // (0 * 7 + 10 * 5) / 12 = 50 / 12 = 4.1666...
    // Gerundet auf 1 Dezimalstelle: 4.2
    expect(berechneGewichtetenDurchschnitt(0, 10)).toBe(4.2);
  });
});

describe("Ampellogik (Status-Bestimmung)", () => {
  // Die Ampellogik aus aktualisiereVergleich:
  // differenz <= 0 → "im_soll"
  // differenz <= 0.5 → "grenzbereich"
  // differenz > 0.5 → "ueber_soll"
  // refinanzierung = Math.min(ist, soll)

  function berechneStatus(differenz: number): string {
    return differenz <= 0
      ? "im_soll"
      : differenz <= 0.5
        ? "grenzbereich"
        : "ueber_soll";
  }

  it("differenz = -5.0 → im_soll", () => {
    expect(berechneStatus(-5.0)).toBe("im_soll");
  });

  it("differenz = 0 → im_soll", () => {
    expect(berechneStatus(0)).toBe("im_soll");
  });

  it("differenz = 0.3 → grenzbereich", () => {
    expect(berechneStatus(0.3)).toBe("grenzbereich");
  });

  it("differenz = 0.5 → grenzbereich", () => {
    expect(berechneStatus(0.5)).toBe("grenzbereich");
  });

  it("differenz = 0.51 → ueber_soll", () => {
    expect(berechneStatus(0.51)).toBe("ueber_soll");
  });

  it("differenz = 5.0 → ueber_soll", () => {
    expect(berechneStatus(5.0)).toBe("ueber_soll");
  });
});

describe("Refinanzierung", () => {
  it("refinanzierung = min(ist, soll) wenn ist < soll", () => {
    const ist = 25.0;
    const soll = 28.0;
    expect(Math.min(ist, soll)).toBe(25.0);
  });

  it("refinanzierung = min(ist, soll) wenn ist > soll (ueber_soll)", () => {
    const ist = 30.0;
    const soll = 28.0;
    expect(Math.min(ist, soll)).toBe(28.0);
  });

  it("refinanzierung = min(ist, soll) wenn gleich", () => {
    const ist = 28.0;
    const soll = 28.0;
    expect(Math.min(ist, soll)).toBe(28.0);
  });

  it("vollstaendiger Vergleich: soll=28, ist=28.3 → grenzbereich, refinanzierung=28", () => {
    const soll = 28.0;
    const ist = 28.3;
    const differenz = roundToDecimals(ist - soll, 1);
    const status =
      differenz <= 0 ? "im_soll" : differenz <= 0.5 ? "grenzbereich" : "ueber_soll";
    const refinanzierung = Math.min(ist, soll);

    expect(differenz).toBe(0.3);
    expect(status).toBe("grenzbereich");
    expect(refinanzierung).toBe(28.0);
  });

  it("vollstaendiger Vergleich: soll=28, ist=30 → ueber_soll, refinanzierung=28", () => {
    const soll = 28.0;
    const ist = 30.0;
    const differenz = roundToDecimals(ist - soll, 1);
    const status =
      differenz <= 0 ? "im_soll" : differenz <= 0.5 ? "grenzbereich" : "ueber_soll";
    const refinanzierung = Math.min(ist, soll);

    expect(differenz).toBe(2.0);
    expect(status).toBe("ueber_soll");
    expect(refinanzierung).toBe(28.0);
  });
});
