import { describe, it, expect } from "vitest";
import { renderNachweisPdf, renderNachweisExcel } from "@/lib/export/nachweis-render";
import type { NachweisDaten, NachweisSchule } from "@/lib/export/nachweis";

function schule(overrides: Partial<NachweisSchule> = {}): NachweisSchule {
  const monatsSummen: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) monatsSummen[m] = 24.5;
  return {
    schuleId: 1,
    kurzname: "GYM",
    name: "Freies Evangelisches Gymnasium Minden",
    farbe: "#FBC900",
    regeldeputat: 25.5,
    monatsSummen,
    summeJanJul: 171.5,
    summeAugDez: 122.5,
    stellenJanJul: 0.96,
    stellenAugDez: 0.96,
    gesamtStellenJanJul: 1.01,
    gesamtStellenAugDez: 0.96,
    jahreswertGewichtet: 0.99,
    mehrarbeit: {
      lehrer: [{ vollname: "Fröse Simon", janJulStunden: 5, augDezStunden: 0 }],
      schulweitJanJulStellen: 0.05,
      schulweitAugDezStellen: 0,
      stellenJanJul: 0.05,
      stellenAugDez: 0,
      hatDaten: true,
    },
    stellenanteile: [
      {
        bezeichnung: "Stellenzuschlag Ganztag",
        kuerzel: "GT",
        typ: "A",
        wert: 0.5,
        eurBetrag: null,
        zeitraum: "ganzjahr",
        status: "genehmigt",
        lehrerName: "Müller Anna",
        aktenzeichen: "AZ-2026-001",
      },
    ],
    gruppen: [
      {
        gruppe: "beamter",
        label: "Beamte",
        anzahl: 2,
        monatsSummen: { ...monatsSummen },
        summeJanJul: 140,
        summeAugDez: 100,
        lehrer: [
          {
            lehrerId: 1,
            vollname: "Adler Ada",
            stammschuleCode: "GYM",
            gruppe: "beamter",
            stundenProMonat: { 1: 24.5, 2: 24.5, 8: 20, 9: 20 },
            summeJanJul: 49,
            summeAugDez: 40,
          },
          {
            // abgeordnet: Stammschule BK, unterrichtet am GYM
            lehrerId: 2,
            vollname: "Fröse Simon",
            stammschuleCode: "BK",
            gruppe: "beamter",
            stundenProMonat: { 1: 20.5, 8: 20.5 },
            summeJanJul: 20.5,
            summeAugDez: 20.5,
          },
        ],
      },
      {
        gruppe: "angestellter",
        label: "Angestellte",
        anzahl: 1,
        monatsSummen: {},
        summeJanJul: 31.5,
        summeAugDez: 22.5,
        lehrer: [
          {
            lehrerId: 3,
            vollname: "Weber Cem",
            stammschuleCode: "GYM",
            gruppe: "angestellter",
            stundenProMonat: { 1: 4.5, 8: 4.5 },
            summeJanJul: 31.5,
            summeAugDez: 22.5,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function daten(): NachweisDaten {
  return {
    haushaltsjahr: 2026,
    altesSchuljahr: "2025/2026",
    neuesSchuljahr: "2026/2027",
    erstelltAm: "2026-07-24T00:00:00.000Z",
    schulen: [
      schule(),
      schule({ schuleId: 4, kurzname: "GSS", name: "Grundschule Stemwede", farbe: "#6BAA24", stellenanteile: [] }),
    ],
    gesamt: { janJul: 2.02, augDez: 1.92, jahreswert: 1.98 },
  };
}

describe("renderNachweisPdf", () => {
  it("erzeugt ein gueltiges Querformat-PDF (Magic Bytes %PDF) ohne Fehler", () => {
    const buf = renderNachweisPdf(daten());
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("kommt mit einer Schule ohne Mehrarbeit/Stellenanteile klar", () => {
    const d = daten();
    d.schulen[0].mehrarbeit = {
      lehrer: [],
      schulweitJanJulStellen: 0,
      schulweitAugDezStellen: 0,
      stellenJanJul: 0,
      stellenAugDez: 0,
      hatDaten: false,
    };
    d.schulen[0].stellenanteile = [];
    expect(() => renderNachweisPdf(d)).not.toThrow();
  });
});

describe("renderNachweisExcel", () => {
  it("erzeugt eine gueltige XLSX (ZIP-Signatur PK) ohne Fehler", async () => {
    const buf = await renderNachweisExcel(daten());
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
