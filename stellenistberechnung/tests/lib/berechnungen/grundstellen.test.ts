import { describe, it, expect } from "vitest";
import { berechneGrundstellen } from "@/lib/berechnungen/grundstellen";

describe("berechneGrundstellen", () => {
  it("berechnet GES Sek I korrekt (530 Schueler, SLR 18.63) - aus Excel", () => {
    const result = berechneGrundstellen([
      { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 530, slr: 18.63 },
    ]);

    // 530 / 18.63 = 28.4487... → abschneiden → 28.44
    expect(result.teilErgebnisse[0].ergebnisTrunc).toBe(28.44);
    // Nur eine Stufe → 28.44 → runden auf 1 Dez → 28.4
    expect(result.grundstellenzahl).toBe(28.4);
  });

  it("berechnet GES Sek I korrekt (569 Schueler, SLR 18.63) - Aug-Dez 2024", () => {
    const result = berechneGrundstellen([
      { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 569, slr: 18.63 },
    ]);

    // 569 / 18.63 = 30.5421... → abschneiden → 30.54
    expect(result.teilErgebnisse[0].ergebnisTrunc).toBe(30.54);
    // 30.54 → runden → 30.5
    expect(result.grundstellenzahl).toBe(30.5);
  });

  it("berechnet Gymnasium mit Sek I + Sek II korrekt - aus Dokumentation", () => {
    const result = berechneGrundstellen([
      { stufe: "Sek I", schulformTyp: "Gymnasium Sek I (G9)", schueler: 600, slr: 19.87 },
      { stufe: "Sek II", schulformTyp: "Gymnasium Sek II", schueler: 200, slr: 12.70 },
    ]);

    // 600 / 19.87 = 30.196... → abschneiden → 30.19
    expect(result.teilErgebnisse[0].ergebnisTrunc).toBe(30.19);
    // 200 / 12.70 = 15.748... → abschneiden → 15.74
    expect(result.teilErgebnisse[1].ergebnisTrunc).toBe(15.74);
    // Summe: 30.19 + 15.74 = 45.93 → runden → 45.9
    expect(result.summeTrunc).toBeCloseTo(45.93, 2);
    expect(result.grundstellenzahl).toBe(45.9);
  });

  it("berechnet eine einzelne Stufe ohne Fehler", () => {
    const result = berechneGrundstellen([
      { stufe: "Primarstufe", schulformTyp: "Grundschule", schueler: 200, slr: 21.95 },
    ]);

    // 200 / 21.95 = 9.1116... → abschneiden → 9.11
    expect(result.teilErgebnisse[0].ergebnisTrunc).toBe(9.11);
    // 9.11 → runden → 9.1
    expect(result.grundstellenzahl).toBe(9.1);
  });

  it("behandelt leere Stufen-Liste", () => {
    const result = berechneGrundstellen([]);
    expect(result.teilErgebnisse).toHaveLength(0);
    expect(result.grundstellenzahl).toBe(0);
  });

  it("wirft Fehler bei SLR = 0 (Division durch Null)", () => {
    expect(() =>
      berechneGrundstellen([
        { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 500, slr: 0 },
      ])
    ).toThrow("SLR fuer \"Gesamtschule Sek I\" ist 0");
  });

  it("wirft Fehler bei negativem SLR", () => {
    expect(() =>
      berechneGrundstellen([
        { stufe: "Sek I", schulformTyp: "Test", schueler: 100, slr: -5 },
      ])
    ).toThrow("SLR muss groesser als 0 sein");
  });

  it("behandelt drei Stufen (Gesamtschule mit Sek I + II + Aufbau)", () => {
    const result = berechneGrundstellen([
      { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 400, slr: 18.63 },
      { stufe: "Sek II", schulformTyp: "Gesamtschule Sek II", schueler: 100, slr: 12.70 },
    ]);

    // 400 / 18.63 = 21.4707... → trunc → 21.47
    expect(result.teilErgebnisse[0].ergebnisTrunc).toBe(21.47);
    // 100 / 12.70 = 7.8740... → trunc → 7.87
    expect(result.teilErgebnisse[1].ergebnisTrunc).toBe(7.87);
    // Summe: 21.47 + 7.87 = 29.34 → runden → 29.3
    expect(result.grundstellenzahl).toBe(29.3);
  });
});
