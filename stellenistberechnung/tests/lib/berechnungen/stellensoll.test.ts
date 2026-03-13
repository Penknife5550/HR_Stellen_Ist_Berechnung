import { describe, it, expect } from "vitest";
import { berechneStellensoll } from "@/lib/berechnungen/stellensoll";

describe("berechneStellensoll", () => {
  it("berechnet Stellensoll fuer GES mit Zuschlaegen - aus Excel", () => {
    const result = berechneStellensoll({
      stufen: [
        { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 530, slr: 18.63 },
      ],
      zuschlaege: [
        { bezeichnung: "Leitungszeit (Schulleitung)", wert: 0.2 },
        { bezeichnung: "KAoA", wert: 0.24 },
        { bezeichnung: "Digitalisierungsbeauftragter", wert: 0.04 },
      ],
    });

    // Grundstellen: 530 / 18.63 = 28.44... → trunc → 28.44 → round → 28.4
    expect(result.grundstellen.grundstellenzahl).toBe(28.4);
    // Zuschlaege: 0.2 + 0.24 + 0.04 = 0.48
    expect(result.zuschlaegeSumme).toBeCloseTo(0.48, 4);
    // Stellensoll: 28.4 + 0.48 = 28.88 → round(1) → 28.9
    expect(result.stellensoll).toBe(28.9);
  });

  it("berechnet Stellensoll fuer GYM mit Sek I + II + Zuschlaegen", () => {
    const result = berechneStellensoll({
      stufen: [
        { stufe: "Sek I", schulformTyp: "Gymnasium Sek I (G9)", schueler: 600, slr: 19.87 },
        { stufe: "Sek II", schulformTyp: "Gymnasium Sek II", schueler: 200, slr: 12.70 },
      ],
      zuschlaege: [
        { bezeichnung: "Leitungszeit", wert: 0.3 },
      ],
    });

    // Grundstellen: 45.9 (aus Doku-Beispiel)
    expect(result.grundstellen.grundstellenzahl).toBe(45.9);
    // Stellensoll: 45.9 + 0.3 = 46.2
    expect(result.stellensoll).toBe(46.2);
  });

  it("berechnet Stellensoll ohne Zuschlaege", () => {
    const result = berechneStellensoll({
      stufen: [
        { stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", schueler: 569, slr: 18.63 },
      ],
      zuschlaege: [],
    });

    // Ohne Zuschlaege = Grundstellen
    expect(result.stellensoll).toBe(30.5);
  });
});
