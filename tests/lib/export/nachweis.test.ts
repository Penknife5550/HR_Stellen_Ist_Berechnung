import { describe, it, expect } from "vitest";
import {
  gruppiereNachStatus,
  normalisiereGruppe,
  gewichteterJahreswert,
  schuljahreFuerKalenderjahr,
  summeMonate,
  summeNachweis,
  type NachweisLehrerRow,
  type NachweisSchule,
  type NachweisMehrarbeit,
} from "@/lib/export/nachweis";

let idCounter = 1;
function lehrer(
  partial: Partial<NachweisLehrerRow> & { vollname: string; stundenProMonat: Record<number, number> },
): NachweisLehrerRow {
  const stundenProMonat = partial.stundenProMonat;
  return {
    lehrerId: idCounter++,
    stammschuleCode: "GES",
    gruppe: null,
    summeJanJul: summeMonate(stundenProMonat, [1, 2, 3, 4, 5, 6, 7]),
    summeAugDez: summeMonate(stundenProMonat, [8, 9, 10, 11, 12]),
    ...partial,
  };
}

const leereMehrarbeit: NachweisMehrarbeit = {
  lehrer: [],
  schulweitJanJulStellen: 0,
  schulweitAugDezStellen: 0,
  stellenJanJul: 0,
  stellenAugDez: 0,
  hatDaten: false,
};

describe("normalisiereGruppe", () => {
  it("mappt bekannte Gruppen, alles andere auf sonstiges", () => {
    expect(normalisiereGruppe("beamter")).toBe("beamter");
    expect(normalisiereGruppe("angestellter")).toBe("angestellter");
    expect(normalisiereGruppe(null)).toBe("sonstiges");
    expect(normalisiereGruppe("irgendwas")).toBe("sonstiges");
  });
});

describe("summeMonate", () => {
  it("summiert nur die angegebenen Monate", () => {
    const std = { 1: 10, 2: 10, 8: 5, 9: 5 };
    expect(summeMonate(std, [1, 2, 3, 4, 5, 6, 7])).toBe(20);
    expect(summeMonate(std, [8, 9, 10, 11, 12])).toBe(10);
  });
});

describe("schuljahreFuerKalenderjahr", () => {
  it("Jan-Jul gehoert zum alten SJ (Y-1/Y), Aug-Dez zum neuen (Y/Y+1)", () => {
    expect(schuljahreFuerKalenderjahr(2026)).toEqual({ altes: "2025/2026", neues: "2026/2027" });
  });
});

describe("gruppiereNachStatus", () => {
  it("gruppiert Beamte vor Angestellte, bildet Monats- und Halbjahres-Summen", () => {
    const rows: NachweisLehrerRow[] = [
      lehrer({ vollname: "Zander Zoe", gruppe: "angestellter", stundenProMonat: { 1: 10, 8: 10 } }),
      lehrer({ vollname: "Bauer Ben", gruppe: "beamter", stundenProMonat: { 1: 20, 2: 20 } }),
      lehrer({ vollname: "Adler Ada", gruppe: "beamter", stundenProMonat: { 8: 25, 9: 25 } }),
    ];
    const gruppen = gruppiereNachStatus(rows);

    expect(gruppen.map((g) => g.gruppe)).toEqual(["beamter", "angestellter"]);
    // Beamte alphabetisch: Adler vor Bauer
    expect(gruppen[0].lehrer.map((l) => l.vollname)).toEqual(["Adler Ada", "Bauer Ben"]);
    // Monatssummen Beamte: Jan = 20 (Bauer), Feb = 20 (Bauer), Aug = 25, Sep = 25 (Adler)
    expect(gruppen[0].monatsSummen[1]).toBe(20);
    expect(gruppen[0].monatsSummen[8]).toBe(25);
    expect(gruppen[0].summeJanJul).toBe(40); // Bauer 20+20
    expect(gruppen[0].summeAugDez).toBe(50); // Adler 25+25
  });

  it("laesst leere Gruppen weg und liefert [] bei keinen Lehrern", () => {
    expect(gruppiereNachStatus([])).toEqual([]);
    const g = gruppiereNachStatus([lehrer({ vollname: "X", gruppe: "beamter", stundenProMonat: { 1: 5 } })]);
    expect(g).toHaveLength(1);
  });
});

describe("gewichteterJahreswert", () => {
  it("gewichtet Jan-Jul mit 7 und Aug-Dez mit 5 Monaten", () => {
    expect(gewichteterJahreswert(12, 12)).toBeCloseTo(12, 4);
    expect(gewichteterJahreswert(7, 5)).toBeCloseTo(6.1667, 3);
  });
});

describe("summeNachweis", () => {
  it("summiert Gesamt-Stellen je Halbjahr ueber alle Schulen", () => {
    const mk = (janJul: number, augDez: number): NachweisSchule => ({
      schuleId: idCounter++,
      kurzname: "X",
      name: "X",
      farbe: "#000000",
      regeldeputat: 25.5,
      gruppen: [],
      monatsSummen: {},
      summeJanJul: 0,
      summeAugDez: 0,
      stellenJanJul: 0,
      stellenAugDez: 0,
      mehrarbeit: leereMehrarbeit,
      gesamtStellenJanJul: janJul,
      gesamtStellenAugDez: augDez,
      jahreswertGewichtet: 0,
      stellenanteile: [],
    });
    const gesamt = summeNachweis([mk(10, 12), mk(5, 8)]);
    expect(gesamt.janJul).toBeCloseTo(15, 4);
    expect(gesamt.augDez).toBeCloseTo(20, 4);
    expect(gesamt.jahreswert).toBeCloseTo(17.0833, 3);
  });
});
