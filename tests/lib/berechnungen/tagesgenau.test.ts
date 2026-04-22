import { describe, it, expect } from "vitest";
import {
  berechneTagesgenauKorrekturen,
  type TagesgenauAenderung,
  type PauschalLehrerMonat,
} from "@/lib/berechnungen/tagesgenau";

function pauschal(
  entries: Array<[lehrerId: number, monat: number, gesamt: number, ges?: number, gym?: number, bk?: number]>
): Map<string, PauschalLehrerMonat> {
  const m = new Map<string, PauschalLehrerMonat>();
  for (const [lehrerId, monat, gesamt, ges = 0, gym = 0, bk = 0] of entries) {
    m.set(`${lehrerId}_${monat}`, {
      lehrerId,
      monat,
      deputatGesamt: gesamt,
      deputatGes: ges,
      deputatGym: gym,
      deputatBk: bk,
    });
  }
  return m;
}

describe("berechneTagesgenauKorrekturen — Bergen-Szenario", () => {
  it("Pauschal 20.5 (nicht 25.5), Aenderung 20.5→25.5 am 05.01. → Korrektur = 24.855 - 20.5 = 4.355", () => {
    const aenderungen: TagesgenauAenderung[] = [{
      lehrerId: 42,
      monat: 1,
      altGesamt: 20.5, altGes: 20.5, altGym: 0, altBk: 0,
      neuGesamt: 25.5, neuGes: 25.5, neuGym: 0, neuBk: 0,
      aenderungTag: 5,
      monatsTage: 31,
      stammschuleCode: "GES",
    }];
    const pauschaleWerte = pauschal([[42, 1, 20.5, 20.5, 0, 0]]);
    const korrekturen = berechneTagesgenauKorrekturen(aenderungen, "GES", 2026, pauschaleWerte);
    expect(korrekturen).toHaveLength(1);
    // gewichtet_ges = (20.5*4 + 25.5*27)/31 = 24.855
    // pauschal_ges  = 20.5 (aus deputat_monatlich)
    // delta         = 4.355 → wird auf Schul-Summe GES addiert
    expect(korrekturen[0].monat).toBe(1);
    expect(korrekturen[0].differenzSchulspezifisch).toBeCloseTo(4.355, 3);
  });

  it("Pauschal = Neu (klassischer Fall): Korrektur = gewichtet - neu", () => {
    const aenderungen: TagesgenauAenderung[] = [{
      lehrerId: 7,
      monat: 2,
      altGesamt: 23.5, altGes: 23.5, altGym: 0, altBk: 0,
      neuGesamt: 25.5, neuGes: 25.5, neuGym: 0, neuBk: 0,
      aenderungTag: 9,
      monatsTage: 28,
      stammschuleCode: "GES",
    }];
    const pauschaleWerte = pauschal([[7, 2, 25.5, 25.5, 0, 0]]);
    const korrekturen = berechneTagesgenauKorrekturen(aenderungen, "GES", 2026, pauschaleWerte);
    // gewichtet = (23.5*8 + 25.5*20)/28 = 24.929
    // pauschal  = 25.5
    // delta     = -0.571
    expect(korrekturen[0].differenzSchulspezifisch).toBeCloseTo(-0.571, 3);
  });
});

describe("berechneTagesgenauKorrekturen — 2-Schulen-Aufteilung", () => {
  it("GES und GYM werden jeweils einzeln korrigiert", () => {
    const aenderungen: TagesgenauAenderung[] = [{
      lehrerId: 10,
      monat: 3,
      altGesamt: 20, altGes: 10, altGym: 10, altBk: 0,
      neuGesamt: 25, neuGes: 12, neuGym: 13, neuBk: 0,
      aenderungTag: 16,
      monatsTage: 31,
      stammschuleCode: "GES",
    }];
    const pauschaleWerte = pauschal([[10, 3, 25, 12, 13, 0]]);

    const gesK = berechneTagesgenauKorrekturen(aenderungen, "GES", 2026, pauschaleWerte);
    const gymK = berechneTagesgenauKorrekturen(aenderungen, "GYM", 2026, pauschaleWerte);
    // Mar 2026: 15 Tage vor, 16 Tage nach
    // GES: (10*15 + 12*16) / 31 = 11.032; pauschal 12; delta = -0.968
    // GYM: (10*15 + 13*16) / 31 = 11.548; pauschal 13; delta = -1.452
    expect(gesK[0].differenzSchulspezifisch).toBeCloseTo(-0.968, 3);
    expect(gymK[0].differenzSchulspezifisch).toBeCloseTo(-1.452, 3);
  });
});

describe("berechneTagesgenauKorrekturen — Mehrfachaenderung", () => {
  it("Zwei Aenderungen im selben Monat pro Lehrer → segmentierte Korrektur", () => {
    // Apr 2026: 30 Tage. Lehrer hat zwei Aenderungen:
    //   10.04.: 20→25
    //   20.04.: 25→30
    // Erwartung: Segmente ergeben (20*9+25*10+30*11)/30 = 25.333
    const aenderungen: TagesgenauAenderung[] = [
      {
        lehrerId: 99, monat: 4,
        altGesamt: 20, altGes: 20, altGym: 0, altBk: 0,
        neuGesamt: 25, neuGes: 25, neuGym: 0, neuBk: 0,
        aenderungTag: 10, monatsTage: 30, stammschuleCode: "GES",
      },
      {
        lehrerId: 99, monat: 4,
        altGesamt: 25, altGes: 25, altGym: 0, altBk: 0,
        neuGesamt: 30, neuGes: 30, neuGym: 0, neuBk: 0,
        aenderungTag: 20, monatsTage: 30, stammschuleCode: "GES",
      },
    ];
    const pauschaleWerte = pauschal([[99, 4, 30, 30, 0, 0]]);
    const korrekturen = berechneTagesgenauKorrekturen(aenderungen, "GES", 2026, pauschaleWerte);
    // gewichtet = 25.333; pauschal = 30; delta = -4.667
    expect(korrekturen[0].differenzSchulspezifisch).toBeCloseTo(-4.667, 3);
  });
});

describe("berechneTagesgenauKorrekturen — Grundschule (Stammschule-Filter)", () => {
  it("Grundschul-Aenderung: nur wenn stammschuleCode matcht", () => {
    const aenderungen: TagesgenauAenderung[] = [{
      lehrerId: 50, monat: 5,
      altGesamt: 10, altGes: 0, altGym: 0, altBk: 0,
      neuGesamt: 12, neuGes: 0, neuGym: 0, neuBk: 0,
      aenderungTag: 10, monatsTage: 31, stammschuleCode: "GSH",
    }];
    const pauschaleWerte = pauschal([[50, 5, 12]]);
    // Fuer GSH (eigene Stammschule): greift ueber deputat_gesamt
    const gsh = berechneTagesgenauKorrekturen(aenderungen, "GSH", 2026, pauschaleWerte);
    // gewichtet = (10*9 + 12*22)/31 = 11.419; pauschal = 12; delta = -0.581
    expect(gsh).toHaveLength(1);
    expect(gsh[0].differenzSchulspezifisch).toBeCloseTo(-0.581, 3);
    // Fuer andere Grundschule (GSM): kein Match
    const gsm = berechneTagesgenauKorrekturen(aenderungen, "GSM", 2026, pauschaleWerte);
    expect(gsm).toHaveLength(0);
  });
});

describe("berechneTagesgenauKorrekturen — Pauschal == Gewichtet: keine Korrektur", () => {
  it("wenn DB-Pauschal mit dem gewichteten Wert uebereinstimmt, wird kein Delta erzeugt", () => {
    // Szenario: HR hat rueckwirkend Datum gesetzt, aber der DB-Wert ist schon
    // der korrekt gewichtete Wert (z.B. weil manuell). Dann keine Korrektur.
    const aenderungen: TagesgenauAenderung[] = [{
      lehrerId: 1, monat: 6,
      altGesamt: 20, altGes: 20, altGym: 0, altBk: 0,
      neuGesamt: 20, neuGes: 20, neuGym: 0, neuBk: 0,
      aenderungTag: 15, monatsTage: 30, stammschuleCode: "GES",
    }];
    const pauschaleWerte = pauschal([[1, 6, 20, 20, 0, 0]]);
    const korrekturen = berechneTagesgenauKorrekturen(aenderungen, "GES", 2026, pauschaleWerte);
    expect(korrekturen).toHaveLength(0);
  });
});
