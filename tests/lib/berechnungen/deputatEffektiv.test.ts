import { describe, it, expect } from "vitest";
import { berechneLehrerDeputatEffektiv } from "@/lib/berechnungen/deputatEffektiv";

describe("berechneLehrerDeputatEffektiv — Einfachfall (eine Aenderung)", () => {
  it("Bergen Eduard Jan 2026: pauschal 20.5, Aenderung 20.5→25.5 am 05.01. → effektiv 24.855", () => {
    const monatsDaten = [{
      monat: 1,
      deputatGesamt: "20.500",  // pauschal (aus deputat_monatlich — der alte Wert nach Coverage-Fix)
      deputatGes: "20.500",
      deputatGym: "0",
      deputatBk: "0",
    }];
    const aenderungen = [{
      monat: 1,
      deputatGesamtAlt: "20.500",
      deputatGesAlt: "20.500",
      deputatGymAlt: "0",
      deputatBkAlt: "0",
      deputatGesamtNeu: "25.500",
      deputatGesNeu: "25.500",
      deputatGymNeu: "0",
      deputatBkNeu: "0",
      tatsaechlichesDatum: "2026-01-05",
    }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    const jan = result.get(1)!;
    expect(jan.pauschal.gesamt).toBe(20.5);
    // (20.5 * 4 + 25.5 * 27) / 31 = 24.855
    expect(jan.effektiv.gesamt).toBeCloseTo(24.855, 3);
    expect(jan.effektiv.ges).toBeCloseTo(24.855, 3);
    expect(jan.korrektur.gesamt).toBeCloseTo(4.355, 3); // effektiv - pauschal = 24.855 - 20.5
    expect(jan.hatKorrektur).toBe(true);
  });

  it("Pauschal == Neu (klassischer Fall): effektiv wird korrekt taggenau", () => {
    // Wenn letzter Sync den neuen Wert speichert (alte Annahme)
    const monatsDaten = [{
      monat: 2,
      deputatGesamt: "25.500",
      deputatGes: "25.500",
      deputatGym: "0",
      deputatBk: "0",
    }];
    const aenderungen = [{
      monat: 2,
      deputatGesamtAlt: "23.500",
      deputatGesAlt: "23.500",
      deputatGymAlt: "0",
      deputatBkAlt: "0",
      deputatGesamtNeu: "25.500",
      deputatGesNeu: "25.500",
      deputatGymNeu: "0",
      deputatBkNeu: "0",
      tatsaechlichesDatum: "2026-02-09",
    }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    // (23.5 * 8 + 25.5 * 20) / 28 = 24.929
    expect(result.get(2)!.effektiv.gesamt).toBeCloseTo(24.929, 3);
  });

  it("Keine Aenderung im Monat: effektiv = pauschal", () => {
    const monatsDaten = [{ monat: 3, deputatGesamt: 20, deputatGes: 20, deputatGym: 0, deputatBk: 0 }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, [], 2026);
    const mar = result.get(3)!;
    expect(mar.effektiv).toEqual(mar.pauschal);
    expect(mar.hatKorrektur).toBe(false);
    expect(mar.korrektur.gesamt).toBe(0);
  });

  it("Aenderung ohne tatsaechlichesDatum wird ignoriert", () => {
    const monatsDaten = [{ monat: 4, deputatGesamt: 20, deputatGes: 20, deputatGym: 0, deputatBk: 0 }];
    const aenderungen = [{
      monat: 4,
      deputatGesamtAlt: 18,
      deputatGesAlt: 18,
      deputatGymAlt: 0,
      deputatBkAlt: 0,
      deputatGesamtNeu: 20,
      deputatGesNeu: 20,
      deputatGymNeu: 0,
      deputatBkNeu: 0,
      tatsaechlichesDatum: null,
    }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    expect(result.get(4)!.hatKorrektur).toBe(false);
    expect(result.get(4)!.effektiv.gesamt).toBe(20);
  });
});

describe("berechneLehrerDeputatEffektiv — 2-Schulen-Aufteilung", () => {
  it("Aufteilung GES+GYM, Aenderung ges 10→12, gym 10→13", () => {
    const monatsDaten = [{
      monat: 3,
      deputatGesamt: "22",
      deputatGes: "10",
      deputatGym: "10",
      deputatBk: "0",
    }];
    const aenderungen = [{
      monat: 3,
      deputatGesamtAlt: 20, deputatGesAlt: 10, deputatGymAlt: 10, deputatBkAlt: 0,
      deputatGesamtNeu: 25, deputatGesNeu: 12, deputatGymNeu: 13, deputatBkNeu: 0,
      tatsaechlichesDatum: "2026-03-16",
    }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    const mar = result.get(3)!;
    // Mar 2026: 31 Tage, Tag 16 → 15 Tage vor, 16 Tage nach
    // GES: (10*15 + 12*16) / 31 = (150+192)/31 = 11.032
    // GYM: (10*15 + 13*16) / 31 = (150+208)/31 = 11.548
    // Gesamt: (20*15 + 25*16) / 31 = 22.581
    expect(mar.effektiv.ges).toBeCloseTo(11.032, 3);
    expect(mar.effektiv.gym).toBeCloseTo(11.548, 3);
    expect(mar.effektiv.gesamt).toBeCloseTo(22.581, 3);
    // Konsistenz: gesamt ≈ ges + gym (bei kleinen Rundungsfehlern)
    expect(Math.abs(mar.effektiv.ges + mar.effektiv.gym - mar.effektiv.gesamt)).toBeLessThan(0.001);
  });

  it("Reine Verteilungsaenderung: Gesamt bleibt, Splittung aendert sich", () => {
    const monatsDaten = [{
      monat: 3,
      deputatGesamt: "20",
      deputatGes: "10",
      deputatGym: "10",
      deputatBk: "0",
    }];
    const aenderungen = [{
      monat: 3,
      deputatGesamtAlt: 20, deputatGesAlt: 20, deputatGymAlt: 0, deputatBkAlt: 0,
      deputatGesamtNeu: 20, deputatGesNeu: 10, deputatGymNeu: 10, deputatBkNeu: 0,
      tatsaechlichesDatum: "2026-03-05",
    }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    const mar = result.get(3)!;
    // Gesamt bleibt 20 konstant (alt=neu=20)
    expect(mar.effektiv.gesamt).toBeCloseTo(20, 3);
    // GES: (20*4 + 10*27) / 31 = 350/31 = 11.29
    expect(mar.effektiv.ges).toBeCloseTo(11.290, 2);
    // GYM: (0*4 + 10*27) / 31 = 270/31 = 8.71
    expect(mar.effektiv.gym).toBeCloseTo(8.710, 2);
  });
});

describe("berechneLehrerDeputatEffektiv — Mehrfachaenderung im Monat", () => {
  it("Zwei Aenderungen: Segmentierung in drei Zeitabschnitte", () => {
    const monatsDaten = [{
      monat: 4,
      deputatGesamt: "25",
      deputatGes: "25",
      deputatGym: "0",
      deputatBk: "0",
    }];
    // Apr 2026: 30 Tage
    // Aenderung 1 am 10.04.: 20 → 25
    // Aenderung 2 am 20.04.: 25 → 30
    const aenderungen = [
      {
        monat: 4,
        deputatGesamtAlt: 20, deputatGesAlt: 20, deputatGymAlt: 0, deputatBkAlt: 0,
        deputatGesamtNeu: 25, deputatGesNeu: 25, deputatGymNeu: 0, deputatBkNeu: 0,
        tatsaechlichesDatum: "2026-04-10",
      },
      {
        monat: 4,
        deputatGesamtAlt: 25, deputatGesAlt: 25, deputatGymAlt: 0, deputatBkAlt: 0,
        deputatGesamtNeu: 30, deputatGesNeu: 30, deputatGymNeu: 0, deputatBkNeu: 0,
        tatsaechlichesDatum: "2026-04-20",
      },
    ];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    const apr = result.get(4)!;
    // Segmente:
    //  Tag 1-9  (9 Tage):   Wert = 20 (alt der 1. Aenderung)
    //  Tag 10-19 (10 Tage): Wert = 25 (neu der 1. Aenderung)
    //  Tag 20-30 (11 Tage): Wert = 30 (neu der 2. Aenderung)
    // Effektiv = (20*9 + 25*10 + 30*11) / 30 = (180+250+330) / 30 = 25.333
    expect(apr.effektiv.gesamt).toBeCloseTo(25.333, 3);
  });

  it("Aenderung am Tag 1 ergibt kein Vor-Segment", () => {
    const monatsDaten = [{ monat: 5, deputatGesamt: "30", deputatGes: "30", deputatGym: "0", deputatBk: "0" }];
    const aenderungen = [{
      monat: 5,
      deputatGesamtAlt: 20, deputatGesAlt: 20, deputatGymAlt: 0, deputatBkAlt: 0,
      deputatGesamtNeu: 30, deputatGesNeu: 30, deputatGymNeu: 0, deputatBkNeu: 0,
      tatsaechlichesDatum: "2026-05-01",
    }];
    const result = berechneLehrerDeputatEffektiv(monatsDaten, aenderungen, 2026);
    // Komplett 31 Tage bei 30 → effektiv 30, Korrektur 0
    expect(result.get(5)!.effektiv.gesamt).toBeCloseTo(30, 3);
  });
});
