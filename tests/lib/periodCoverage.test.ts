import { describe, it, expect } from "vitest";
import { tageImMonat, neuePeriodeGewinnt, germanDateToIso } from "@/lib/periodCoverage";

describe("tageImMonat", () => {
  it("voller Monat", () => {
    expect(tageImMonat("2026-03-01", "2026-03-31", 2026, 3)).toBe(31);
  });

  it("Periode beginnt im Monat, endet spaeter", () => {
    // 16.03.-12.04. → Maerz-Anteil: 16 Tage (16.-31.)
    expect(tageImMonat("2026-03-16", "2026-04-12", 2026, 3)).toBe(16);
  });

  it("Periode endet im Monat, beginnt frueher", () => {
    // 16.03.-12.04. → April-Anteil: 12 Tage (1.-12.)
    expect(tageImMonat("2026-03-16", "2026-04-12", 2026, 4)).toBe(12);
  });

  it("Periode liegt komplett im Monat", () => {
    expect(tageImMonat("2026-04-13", "2026-04-19", 2026, 4)).toBe(7);
  });

  it("Periode beruehrt Monat nicht", () => {
    expect(tageImMonat("2026-02-09", "2026-03-01", 2026, 4)).toBe(0);
  });

  it("Periode endet am 1. des Monats (1 Tag)", () => {
    // 09.02.-01.03. → Maerz-Anteil: 1 Tag
    expect(tageImMonat("2026-02-09", "2026-03-01", 2026, 3)).toBe(1);
  });

  it("Schaltjahr Februar", () => {
    expect(tageImMonat("2024-02-01", "2024-02-29", 2024, 2)).toBe(29);
  });

  it("Nicht-Schaltjahr Februar", () => {
    expect(tageImMonat("2025-02-01", "2025-03-15", 2025, 2)).toBe(28);
  });

  it("akzeptiert Date-Objekte", () => {
    expect(tageImMonat(new Date("2026-03-01"), new Date("2026-03-31"), 2026, 3)).toBe(31);
  });

  it("ungueltiges Datum gibt 0", () => {
    expect(tageImMonat("kein-datum", "2026-03-31", 2026, 3)).toBe(0);
  });

  it("end vor start gibt 0", () => {
    expect(tageImMonat("2026-03-31", "2026-03-01", 2026, 3)).toBe(0);
  });
});

describe("neuePeriodeGewinnt", () => {
  // Szenario Maerz 2026 bei Eduard Bergen:
  //   TERM 11: 09.02.-01.03. (1 Tag Maerz)
  //   TERM 12: 02.03.-15.03. (14 Tage Maerz)
  //   TERM 13: 16.03.-12.04. (16 Tage Maerz) ← soll gewinnen

  it("neue Periode gewinnt bei mehr Tagen", () => {
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 3,
        neueDateFrom: "2026-03-16", // TERM 13
        neueDateTo: "2026-04-12",
        bestehendeDateFrom: "2026-03-02", // TERM 12
        bestehendeDateTo: "2026-03-15",
      })
    ).toBe(true);
  });

  it("neue Periode verliert bei weniger Tagen", () => {
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 3,
        neueDateFrom: "2026-02-09", // TERM 11 (1 Tag)
        neueDateTo: "2026-03-01",
        bestehendeDateFrom: "2026-03-16", // TERM 13 (16 Tage)
        bestehendeDateTo: "2026-04-12",
      })
    ).toBe(false);
  });

  it("bei Gleichstand gewinnt spaetere Periode", () => {
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 4,
        neueDateFrom: "2026-04-20", // spaeter
        neueDateTo: "2026-04-26",
        bestehendeDateFrom: "2026-04-13",
        bestehendeDateTo: "2026-04-19",
      })
    ).toBe(true);
  });

  it("bei Gleichstand verliert fruehere Periode", () => {
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 4,
        neueDateFrom: "2026-04-13",
        neueDateTo: "2026-04-19",
        bestehendeDateFrom: "2026-04-20",
        bestehendeDateTo: "2026-04-26",
      })
    ).toBe(false);
  });

  it("Altdaten ohne Coverage werden ueberschrieben", () => {
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 3,
        neueDateFrom: "2026-02-09",
        neueDateTo: "2026-03-01",
        bestehendeDateFrom: null,
        bestehendeDateTo: null,
      })
    ).toBe(true);
  });

  it("HJ-Wechsel Januar: neue SJ Periode mit mehr Tagen gewinnt", () => {
    // Altes SJ TERM X: Dez–08.01. (8 Jan-Tage)
    // Neues SJ TERM 9: 09.01.–Feb (23 Jan-Tage)
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 1,
        neueDateFrom: "2026-01-09",
        neueDateTo: "2026-02-08",
        bestehendeDateFrom: "2025-12-15",
        bestehendeDateTo: "2026-01-08",
      })
    ).toBe(true);
  });

  it("schwache Periode verliert trotz spaeteren Sync-Reihenfolge", () => {
    // TERM 16 (27.04.–03.05.) mit 4 April-Tagen
    // darf TERM 13 (16.03.–12.04.) mit 12 April-Tagen NICHT ueberschreiben
    expect(
      neuePeriodeGewinnt({
        jahr: 2026,
        monat: 4,
        neueDateFrom: "2026-04-27",
        neueDateTo: "2026-05-03",
        bestehendeDateFrom: "2026-03-16",
        bestehendeDateTo: "2026-04-12",
      })
    ).toBe(false);
  });
});

describe("germanDateToIso", () => {
  it("einstellige Tage und Monate", () => {
    expect(germanDateToIso("5.3.2026")).toBe("2026-03-05");
  });

  it("zweistellige Werte", () => {
    expect(germanDateToIso("16.03.2026")).toBe("2026-03-16");
  });

  it("ungueltig", () => {
    expect(germanDateToIso("kein-datum")).toBeNull();
    expect(germanDateToIso("16.03")).toBeNull();
  });
});
