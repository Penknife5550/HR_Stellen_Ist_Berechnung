import { describe, it, expect } from "vitest";
import {
  klassifiziereWechsel,
  berechneNeuePeriodenWechsel,
  monthsInRange,
  wirksamMonat,
  baueMonatsBuckets,
  type PeriodenZeile,
} from "@/lib/berechnungen/periodenDiff";

const w = (gesamt: number, ges = 0, gym = 0, bk = 0) => ({ gesamt, ges, gym, bk });

function zeile(
  lehrerId: number,
  sy: number,
  termId: number,
  von: string,
  bis: string,
  werte: ReturnType<typeof w>,
): PeriodenZeile {
  return { lehrerId, sy, termId, gueltigVon: von, gueltigBis: bis, werte };
}

describe("klassifiziereWechsel", () => {
  it("Gesamt-Aenderung ist haupt", () => {
    expect(klassifiziereWechsel(w(25.5, 25.5), w(23, 23))).toBe("haupt");
  });
  it("nur Verteilung ist verteilung", () => {
    expect(klassifiziereWechsel(w(25.5, 25.5, 0), w(25.5, 21.5, 4))).toBe("verteilung");
  });
  it("unveraendert ist null", () => {
    expect(klassifiziereWechsel(w(25.5, 25.5), w(25.5, 25.5))).toBeNull();
  });
  it("Rundungsrauschen unter Schwelle ist null", () => {
    expect(klassifiziereWechsel(w(25.5, 25.5), w(25.5005, 25.5005))).toBeNull();
  });
  it("haupt hat Vorrang vor verteilung", () => {
    expect(klassifiziereWechsel(w(25.5, 25.5), w(24, 20, 4))).toBe("haupt");
  });
});

describe("berechneNeuePeriodenWechsel", () => {
  const heute = "2026-09-03";

  it("neue Periode mit anderem Wert gegen bestehenden Vorgaenger → haupt", () => {
    const bestehend = [zeile(1, 20252026, 18, "2026-05-25", "2026-07-18", w(25.5, 25.5))];
    const eingefuegt = [zeile(1, 20262027, 999, "2026-08-01", "2027-07-31", w(23, 23))];
    const res = berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      lehrerId: 1,
      sy: 20262027,
      termId: 999,
      dateFrom: "2026-08-01",
      type: "haupt",
      alt: w(25.5, 25.5),
      neu: w(23, 23),
      vorgaenger: { sy: 20252026, termId: 18 },
    });
  });

  it("unveraenderter Wert → kein Event", () => {
    const bestehend = [zeile(1, 20252026, 18, "2026-05-25", "2026-07-18", w(25.5, 25.5))];
    const eingefuegt = [zeile(1, 20262027, 999, "2026-08-01", "2027-07-31", w(25.5, 25.5))];
    expect(berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute })).toHaveLength(0);
  });

  it("erste Periode eines Lehrers ohne Vorgaenger → kein Event", () => {
    const eingefuegt = [zeile(7, 20262027, 999, "2026-08-01", "2027-07-31", w(20, 20))];
    expect(berechneNeuePeriodenWechsel({ bestehend: [], eingefuegt, heute })).toHaveLength(0);
  });

  it("Vorgaenger aus demselben Payload wird erkannt (Kette P1→P2→P3)", () => {
    const eingefuegt = [
      zeile(1, 20262027, 1, "2026-08-31", "2026-09-13", w(25.5, 25.5)),
      zeile(1, 20262027, 2, "2026-09-14", "2026-10-04", w(24, 24)),
      zeile(1, 20262027, 3, "2026-10-05", "2027-07-18", w(24, 20, 4)),
    ];
    const res = berechneNeuePeriodenWechsel({ bestehend: [], eingefuegt, heute });
    expect(res.map((r) => [r.termId, r.type])).toEqual([
      [2, "haupt"],
      [3, "verteilung"],
    ]);
  });

  it("Reihenfolge nach Datum, nicht nach termId (b-Periode mit hoeherer ID dazwischen)", () => {
    const bestehend = [
      zeile(1, 20252026, 12, "2026-03-02", "2026-03-15", w(25.5, 25.5)),
      zeile(1, 20252026, 14, "2026-04-13", "2026-04-19", w(25.5, 25.5)),
    ];
    // Periode12b (ID 13) liegt zeitlich zwischen 12 und 14 — erst jetzt neu.
    // Erwartet: Wechsel 12→13 (hinein) UND 13→14 (wieder zurueck auf 25.5).
    const eingefuegt = [zeile(1, 20252026, 13, "2026-03-16", "2026-04-12", w(24, 24))];
    const res = berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute: "2026-04-01" });
    expect(res.map((r) => [r.vorgaenger.termId, r.termId, r.type])).toEqual([
      [12, 13, "haupt"],
      [13, 14, "haupt"],
    ]);
  });

  it("eingeschobene Periode mit gleichem Wert wie Nachfolger → nur ein Wechsel", () => {
    const bestehend = [
      zeile(1, 20252026, 12, "2026-03-02", "2026-03-15", w(25.5, 25.5)),
      zeile(1, 20252026, 14, "2026-04-13", "2026-04-19", w(24, 24)),
    ];
    const eingefuegt = [zeile(1, 20252026, 13, "2026-03-16", "2026-04-12", w(24, 24))];
    const res = berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute: "2026-04-01" });
    expect(res.map((r) => [r.vorgaenger.termId, r.termId])).toEqual([[12, 13]]);
  });

  it("historischer Backfill (gueltigBis weit in der Vergangenheit) → kein Event", () => {
    const bestehend = [zeile(1, 20242025, 1, "2024-08-19", "2024-09-08", w(25.5, 25.5))];
    const eingefuegt = [zeile(1, 20242025, 2, "2024-09-09", "2024-09-29", w(23, 23))];
    expect(berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute })).toHaveLength(0);
  });

  it("Periode innerhalb der Karenz (60 Tage) → Event", () => {
    const bestehend = [zeile(1, 20252026, 17, "2026-05-04", "2026-05-24", w(25.5, 25.5))];
    const eingefuegt = [zeile(1, 20252026, 18, "2026-05-25", "2026-07-18", w(23, 23))];
    expect(berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute })).toHaveLength(1);
  });

  it("Pseudo-Periode 999 als Vorgaenger der echten Periode 1 (kein Duplikat bei gleichem Wert)", () => {
    const bestehend = [
      zeile(1, 20252026, 18, "2026-05-25", "2026-07-18", w(25.5, 25.5)),
      zeile(1, 20262027, 999, "2026-08-01", "2027-07-31", w(23, 23)),
    ];
    const eingefuegt = [
      zeile(1, 20262027, 1, "2026-08-31", "2026-09-13", w(23, 23)),
      zeile(1, 20262027, 2, "2026-09-14", "2027-07-18", w(22, 22)),
    ];
    const res = berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ termId: 2, vorgaenger: { termId: 1 }, type: "haupt" });
  });

  it("Lehrer werden getrennt betrachtet", () => {
    const bestehend = [zeile(1, 20252026, 18, "2026-05-25", "2026-07-18", w(25.5, 25.5))];
    const eingefuegt = [
      zeile(1, 20262027, 999, "2026-08-01", "2027-07-31", w(23, 23)),
      zeile(2, 20262027, 999, "2026-08-01", "2027-07-31", w(20, 20)),
    ];
    const res = berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute });
    expect(res).toHaveLength(1);
    expect(res[0].lehrerId).toBe(1);
  });
});

describe("monthsInRange / wirksamMonat", () => {
  it("Intervall ueber Jahreswechsel", () => {
    expect(monthsInRange("2025-11-24", "2026-01-04")).toEqual([
      { jahr: 2025, monat: 11 },
      { jahr: 2025, monat: 12 },
      { jahr: 2026, monat: 1 },
    ]);
  });
  it("ein Monat", () => {
    expect(monthsInRange("2026-03-02", "2026-03-15")).toEqual([{ jahr: 2026, monat: 3 }]);
  });
  it("wirksamMonat nimmt den Startmonat", () => {
    expect(wirksamMonat("2026-08-01")).toEqual({ jahr: 2026, monat: 8 });
  });
});

describe("baueMonatsBuckets", () => {
  const base = {
    lehrerId: 1,
    teacherId: 100,
    vollname: "Test Lehrer",
    dateFrom: "2026-08-01",
    dateTo: "2027-07-31",
    alt: w(25.5, 25.5),
    neu: w(23, 23),
  };

  it("ein Bucket je (lehrer, jahr, monat)", () => {
    const res = baueMonatsBuckets([
      { ...base, sy: 20262027, termId: 999, type: "haupt", monate: [{ jahr: 2026, monat: 8 }] },
    ]);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ jahr: 2026, monat: 8, type: "haupt" });
    expect(res[0].perioden).toHaveLength(1);
  });

  it("haupt uebersteuert verteilung im selben Monat", () => {
    const res = baueMonatsBuckets([
      { ...base, sy: 20252026, termId: 12, type: "verteilung", monate: [{ jahr: 2026, monat: 3 }] },
      { ...base, sy: 20252026, termId: 13, type: "haupt", monate: [{ jahr: 2026, monat: 3 }] },
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].type).toBe("haupt");
    expect(res[0].perioden).toHaveLength(2);
  });

  it("mehrere Monate → mehrere Buckets", () => {
    const res = baueMonatsBuckets([
      { ...base, sy: 20252026, termId: 9, type: "haupt", monate: monthsInRange("2025-11-24", "2026-01-04") },
    ]);
    expect(res.map((b) => `${b.jahr}-${b.monat}`)).toEqual(["2025-11", "2025-12", "2026-1"]);
  });
});
