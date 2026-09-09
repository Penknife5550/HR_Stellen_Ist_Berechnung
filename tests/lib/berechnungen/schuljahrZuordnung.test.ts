import { describe, it, expect } from "vitest";
import {
  findeSchuljahrFuerStichtag,
  baueSlrLookup,
  normalisiereSchulformTyp,
  findeSlrKonflikte,
} from "@/lib/berechnungen/schuljahrZuordnung";

const schuljahre = [
  { id: 1, bezeichnung: "2024/2025", startDatum: "2024-08-01", endDatum: "2025-07-31" },
  { id: 2, bezeichnung: "2025/2026", startDatum: "2025-08-01", endDatum: "2026-07-31" },
  { id: 3, bezeichnung: "2026/2027", startDatum: "2026-08-01", endDatum: "2027-07-31" },
];

describe("findeSchuljahrFuerStichtag", () => {
  it("ordnet den Vorjahres-Stichtag (Jan-Jul HJ 2026) dem Schuljahr 2025/2026 zu", () => {
    expect(findeSchuljahrFuerStichtag(schuljahre, "2025-10-15")?.bezeichnung).toBe("2025/2026");
  });

  it("ordnet den laufenden Stichtag (Aug-Dez HJ 2026) dem Schuljahr 2026/2027 zu", () => {
    expect(findeSchuljahrFuerStichtag(schuljahre, "2026-10-15")?.bezeichnung).toBe("2026/2027");
  });

  it("behandelt die Grenzen inklusive (01.08. und 31.07.)", () => {
    expect(findeSchuljahrFuerStichtag(schuljahre, "2026-08-01")?.bezeichnung).toBe("2026/2027");
    expect(findeSchuljahrFuerStichtag(schuljahre, "2026-07-31")?.bezeichnung).toBe("2025/2026");
  });

  it("liefert null, wenn kein Schuljahr den Stichtag abdeckt (nicht angelegt)", () => {
    const ohne2627 = schuljahre.filter((sj) => sj.id !== 3);
    expect(findeSchuljahrFuerStichtag(ohne2627, "2026-10-15")).toBeNull();
  });

  it("nimmt bei Ueberlappung das spaeter beginnende Schuljahr", () => {
    const ueberlappend = [
      ...schuljahre,
      { id: 9, bezeichnung: "2026/2027 alt", startDatum: "2026-07-01", endDatum: "2027-07-31" },
    ];
    expect(findeSchuljahrFuerStichtag(ueberlappend, "2026-10-15")?.id).toBe(3);
  });

  it("ist unabhaengig von der Reihenfolge der Eingabe", () => {
    const rueckwaerts = [...schuljahre].reverse();
    expect(findeSchuljahrFuerStichtag(rueckwaerts, "2025-10-15")?.id).toBe(2);
  });
});

describe("baueSlrLookup", () => {
  it("baut den Lookup aus numeric-Strings der DB", () => {
    const lookup = baueSlrLookup([
      { schulformTyp: "Gymnasium Sek I (G9)", relation: "19.87" },
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
    ]);
    expect(lookup["Gymnasium Sek I (G9)"]).toBe(19.87);
    expect(lookup["Gymnasium Sek II"]).toBe(12.7);
  });

  it("trimmt Leerzeichen im Schulform-Typ (Freitext-Eingabe)", () => {
    const lookup = baueSlrLookup([{ schulformTyp: "  Gesamtschule Sek I ", relation: "18.63" }]);
    expect(lookup["Gesamtschule Sek I"]).toBe(18.63);
    expect(lookup[normalisiereSchulformTyp(" Gesamtschule Sek I")]).toBe(18.63);
  });

  it("uebernimmt Werte <= 0 nicht, damit sie als fehlend erkannt werden", () => {
    const lookup = baueSlrLookup([
      { schulformTyp: "Grundschule", relation: "0" },
      { schulformTyp: "Hauptschule", relation: "17.86" },
    ]);
    expect(lookup["Grundschule"]).toBeUndefined();
    expect(lookup["Hauptschule"]).toBe(17.86);
  });
});

describe("findeSlrKonflikte", () => {
  it("meldet Typen, die nur durch Leerzeichen abweichen und verschiedene Relationen tragen", () => {
    const konflikte = findeSlrKonflikte([
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
      { schulformTyp: "Gymnasium Sek II ", relation: "13.00" },
      { schulformTyp: "Grundschule", relation: "21.95" },
    ]);
    expect(konflikte).toEqual(["Gymnasium Sek II"]);
  });

  it("wertet gleiche Relation nicht als Konflikt", () => {
    expect(
      findeSlrKonflikte([
        { schulformTyp: "Grundschule", relation: "21.95" },
        { schulformTyp: " Grundschule", relation: 21.95 },
      ])
    ).toEqual([]);
  });

  it("liefert eine leere Liste ohne Duplikate", () => {
    expect(findeSlrKonflikte([{ schulformTyp: "Gesamtschule Sek I", relation: "18.63" }])).toEqual([]);
  });
});
