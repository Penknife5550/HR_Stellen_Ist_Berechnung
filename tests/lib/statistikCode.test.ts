import { describe, it, expect } from "vitest";
import {
  normalizeStatistikCode,
  buildPersonalstruktur,
  summePersonalstruktur,
} from "@/lib/statistikCode";

describe("normalizeStatistikCode", () => {
  const valid = new Set(["L", "LT", "U", "UT", "B", "BT", "P", "PT"]);

  it("akzeptiert gueltigen Code", () => {
    const r = normalizeStatistikCode("L", valid, null);
    expect(r.incomingValid).toBe("L");
    expect(r.valueForUpdate).toBe("L");
  });

  it("normalisiert lowercase + Whitespace", () => {
    const r = normalizeStatistikCode("  lt  ", valid, null);
    expect(r.incomingValid).toBe("LT");
    expect(r.valueForUpdate).toBe("LT");
  });

  it("verwirft unbekannten Code, behaelt Existing bei Update", () => {
    const r = normalizeStatistikCode("XYZ", valid, "L");
    expect(r.incomingValid).toBeNull();
    expect(r.valueForUpdate).toBe("L");
  });

  it("verwirft unbekannten Code, liefert null bei Insert (kein Existing)", () => {
    const r = normalizeStatistikCode("XYZ", valid, null);
    expect(r.incomingValid).toBeNull();
    expect(r.valueForUpdate).toBeNull();
  });

  it("leerer String wird zu null behandelt", () => {
    const r = normalizeStatistikCode("", valid, "U");
    expect(r.incomingValid).toBeNull();
    expect(r.valueForUpdate).toBe("U");
  });

  it("undefined wird zu null behandelt", () => {
    const r = normalizeStatistikCode(undefined, valid, null);
    expect(r.incomingValid).toBeNull();
    expect(r.valueForUpdate).toBeNull();
  });

  it("nur Whitespace wird zu null behandelt", () => {
    const r = normalizeStatistikCode("   ", valid, "B");
    expect(r.incomingValid).toBeNull();
    expect(r.valueForUpdate).toBe("B");
  });

  it("gueltiger Incoming ueberschreibt Existing", () => {
    const r = normalizeStatistikCode("UT", valid, "L");
    expect(r.incomingValid).toBe("UT");
    expect(r.valueForUpdate).toBe("UT");
  });

  it("Datenverlust-Schutz: leerer Sync ueberschreibt nicht", () => {
    // Untis liefert leeres Feld → Lehrer behaelt seinen Code
    const r = normalizeStatistikCode(null, valid, "LT");
    expect(r.valueForUpdate).toBe("LT");
  });
});

describe("buildPersonalstruktur", () => {
  const codes = [
    { code: "L", bezeichnung: "Beamter Lebenszeit", gruppe: "beamter", istTeilzeit: false },
    { code: "LT", bezeichnung: "Beamter Lebenszeit (TZ)", gruppe: "beamter", istTeilzeit: true },
    { code: "U", bezeichnung: "Angestellter unbefristet", gruppe: "angestellter", istTeilzeit: false },
    { code: "UT", bezeichnung: "Angestellter unbefristet (TZ)", gruppe: "angestellter", istTeilzeit: true },
  ];

  it("aggregiert pro Schule + Gruppe korrekt", () => {
    const result = buildPersonalstruktur({
      codes,
      schulen: ["GES", "GYM"],
      perCodeSchule: [
        { code: "L", schule: "GES", anzahl: 3 },
        { code: "LT", schule: "GES", anzahl: 2 },
        { code: "U", schule: "GES", anzahl: 4 },
        { code: "L", schule: "GYM", anzahl: 5 },
        { code: "UT", schule: "GYM", anzahl: 1 },
      ],
    });

    const ges = result.find((r) => r.schulKurzname === "GES")!;
    expect(ges.beamteVollzeit).toBe(3);
    expect(ges.beamteTeilzeit).toBe(2);
    expect(ges.beamteGesamt).toBe(5);
    expect(ges.angestellteVollzeit).toBe(4);
    expect(ges.angestellteTeilzeit).toBe(0);
    expect(ges.angestellteGesamt).toBe(4);
    expect(ges.ohne).toBe(0);
    expect(ges.gesamt).toBe(9);

    const gym = result.find((r) => r.schulKurzname === "GYM")!;
    expect(gym.beamteVollzeit).toBe(5);
    expect(gym.angestellteTeilzeit).toBe(1);
    expect(gym.gesamt).toBe(6);
  });

  it("zaehlt fehlenden Code zu 'Ohne'", () => {
    const result = buildPersonalstruktur({
      codes,
      schulen: ["GES"],
      perCodeSchule: [
        { code: null, schule: "GES", anzahl: 3 },
        { code: "L", schule: "GES", anzahl: 1 },
      ],
    });
    expect(result[0].ohne).toBe(3);
    expect(result[0].beamteGesamt).toBe(1);
    expect(result[0].gesamt).toBe(4);
  });

  it("zaehlt unbekannten Code zu 'Ohne' (defensiv)", () => {
    const result = buildPersonalstruktur({
      codes,
      schulen: ["GES"],
      perCodeSchule: [{ code: "XYZ", schule: "GES", anzahl: 2 }],
    });
    expect(result[0].ohne).toBe(2);
    expect(result[0].gesamt).toBe(2);
  });

  it("ignoriert Eintraege mit null-Schule", () => {
    const result = buildPersonalstruktur({
      codes,
      schulen: ["GES"],
      perCodeSchule: [
        { code: "L", schule: null, anzahl: 5 },
        { code: "L", schule: "GES", anzahl: 2 },
      ],
    });
    expect(result[0].beamteGesamt).toBe(2);
    expect(result[0].gesamt).toBe(2);
  });

  it("liefert Schulen ohne Lehrer mit Nullen", () => {
    const result = buildPersonalstruktur({
      codes,
      schulen: ["GES", "BK"],
      perCodeSchule: [{ code: "L", schule: "GES", anzahl: 1 }],
    });
    const bk = result.find((r) => r.schulKurzname === "BK")!;
    expect(bk.gesamt).toBe(0);
    expect(bk.beamteGesamt).toBe(0);
  });

  it("sortiert Schulen alphabetisch (de-DE)", () => {
    const result = buildPersonalstruktur({
      codes,
      schulen: ["GYM", "ABC", "BK"],
      perCodeSchule: [],
    });
    expect(result.map((r) => r.schulKurzname)).toEqual(["ABC", "BK", "GYM"]);
  });

  it("Gruppe 'sonstiges' faellt in 'Ohne'", () => {
    const result = buildPersonalstruktur({
      codes: [{ code: "X", bezeichnung: "Sonstiges", gruppe: "sonstiges", istTeilzeit: false }],
      schulen: ["GES"],
      perCodeSchule: [{ code: "X", schule: "GES", anzahl: 3 }],
    });
    expect(result[0].ohne).toBe(3);
    expect(result[0].beamteGesamt).toBe(0);
  });
});

describe("summePersonalstruktur", () => {
  it("summiert ueber alle Schulen", () => {
    const rows = [
      {
        schulKurzname: "GES",
        beamteVollzeit: 3, beamteTeilzeit: 2, beamteGesamt: 5,
        angestellteVollzeit: 4, angestellteTeilzeit: 0, angestellteGesamt: 4,
        ohne: 1, gesamt: 10,
      },
      {
        schulKurzname: "GYM",
        beamteVollzeit: 5, beamteTeilzeit: 0, beamteGesamt: 5,
        angestellteVollzeit: 0, angestellteTeilzeit: 1, angestellteGesamt: 1,
        ohne: 0, gesamt: 6,
      },
    ];
    const sum = summePersonalstruktur(rows);
    expect(sum.schulKurzname).toBe("Gesamt");
    expect(sum.beamteGesamt).toBe(10);
    expect(sum.angestellteGesamt).toBe(5);
    expect(sum.ohne).toBe(1);
    expect(sum.gesamt).toBe(16);
  });

  it("liefert Nullzeile bei leerer Liste", () => {
    const sum = summePersonalstruktur([]);
    expect(sum.gesamt).toBe(0);
    expect(sum.beamteGesamt).toBe(0);
    expect(sum.angestellteGesamt).toBe(0);
    expect(sum.ohne).toBe(0);
  });
});
