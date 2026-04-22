/**
 * Regression-Szenarien fuer die Sync-Coverage-Logik.
 *
 * Simuliert die tatsaechliche Reihenfolge der n8n-Calls (ein Call pro
 * Untis-Periode, aufsteigend nach term_id) und prueft, dass die
 * Coverage-Regel den richtigen Endzustand erzeugt — ohne Flip-Flop.
 *
 * Daten: Echte Untis-Werte vom 22.04.2026 fuer Lehrer "Bergen Eduard".
 */

import { describe, it, expect } from "vitest";
import { neuePeriodeGewinnt } from "@/lib/periodCoverage";

type MonatEintrag = {
  deputat: number;
  schoolyearId: number;
  termId: number;
  dateFrom: string;
  dateTo: string;
};

type Periode = {
  schoolyearId: number;
  termId: number;
  dateFrom: string;
  dateTo: string;
  deputat: number;
};

/** Simuliert den Sync fuer einen einzelnen Monat: alle Perioden der
 *  Reihe nach, jede entscheidet per Coverage-Regel ob sie schreibt. */
function simuliereSyncLauf(
  jahr: number,
  monat: number,
  perioden: Periode[],
  startZustand: MonatEintrag | null
): { endZustand: MonatEintrag | null; writes: number } {
  let zustand = startZustand;
  let writes = 0;

  for (const p of perioden) {
    if (zustand) {
      const samePeriode =
        zustand.schoolyearId === p.schoolyearId &&
        zustand.termId === p.termId;
      if (!samePeriode) {
        const gewinnt = neuePeriodeGewinnt({
          jahr,
          monat,
          neueDateFrom: p.dateFrom,
          neueDateTo: p.dateTo,
          bestehendeDateFrom: zustand.dateFrom,
          bestehendeDateTo: zustand.dateTo,
        });
        if (!gewinnt) continue;
      }
    }
    zustand = {
      deputat: p.deputat,
      schoolyearId: p.schoolyearId,
      termId: p.termId,
      dateFrom: p.dateFrom,
      dateTo: p.dateTo,
    };
    writes++;
  }
  return { endZustand: zustand, writes };
}

describe("Sync-Szenario: Bergen Eduard, Maerz 2026", () => {
  // Drei Perioden beruehren Maerz, alle aus SJ 2025/2026:
  const maerzPerioden: Periode[] = [
    { schoolyearId: 20252026, termId: 11, dateFrom: "2026-02-09", dateTo: "2026-03-01", deputat: 25.5 }, // 1 Tag
    { schoolyearId: 20252026, termId: 12, dateFrom: "2026-03-02", dateTo: "2026-03-15", deputat: 24.5 }, // 14 Tage
    { schoolyearId: 20252026, termId: 13, dateFrom: "2026-03-16", dateTo: "2026-04-12", deputat: 24.5 }, // 16 Tage ← gewinnt
  ];

  it("Erstlauf schreibt 3x (jede Periode besser als vorherige)", () => {
    const r = simuliereSyncLauf(2026, 3, maerzPerioden, null);
    expect(r.writes).toBe(3);
    expect(r.endZustand?.deputat).toBe(24.5);
    expect(r.endZustand?.termId).toBe(13);
  });

  it("Zweiter Lauf schreibt nur 1x (gleiche Periode, kein Flip-Flop)", () => {
    const nach1Lauf = simuliereSyncLauf(2026, 3, maerzPerioden, null).endZustand;
    expect(nach1Lauf).not.toBeNull();

    const r = simuliereSyncLauf(2026, 3, maerzPerioden, nach1Lauf);
    // Nur TERM 13 (samePeriode) darf durch; TERM 11 und 12 werden verworfen.
    expect(r.writes).toBe(1);
    expect(r.endZustand?.termId).toBe(13);
    expect(r.endZustand?.deputat).toBe(24.5);
  });

  it("Vor dem Fix: naive last-write-wins wuerde TERM 13 schreiben (zufaellig korrekt) ", () => {
    // Kontrollbeispiel: In der alten Logik schreiben alle drei Perioden
    // unvermeidlich. Hier nur zur Dokumentation, dass bei gleichem
    // Endwert kein Flip-Flop sichtbar war — das Drama startet erst
    // wenn Werte zwischen Perioden variieren (siehe Januar-Szenario).
    const simplelastwins: MonatEintrag = {
      deputat: maerzPerioden[maerzPerioden.length - 1].deputat,
      schoolyearId: maerzPerioden[maerzPerioden.length - 1].schoolyearId,
      termId: maerzPerioden[maerzPerioden.length - 1].termId,
      dateFrom: maerzPerioden[maerzPerioden.length - 1].dateFrom,
      dateTo: maerzPerioden[maerzPerioden.length - 1].dateTo,
    };
    expect(simplelastwins.deputat).toBe(24.5);
  });
});

describe("Sync-Szenario: Bergen Eduard, April 2026", () => {
  // Vier Perioden beruehren April, TERM 13 hat die meisten Tage (12)
  const aprilPerioden: Periode[] = [
    { schoolyearId: 20252026, termId: 13, dateFrom: "2026-03-16", dateTo: "2026-04-12", deputat: 24.5 }, // 12 Tage ← gewinnt
    { schoolyearId: 20252026, termId: 14, dateFrom: "2026-04-13", dateTo: "2026-04-19", deputat: 24.5 }, // 7 Tage
    { schoolyearId: 20252026, termId: 15, dateFrom: "2026-04-20", dateTo: "2026-04-26", deputat: 24.5 }, // 7 Tage
    { schoolyearId: 20252026, termId: 16, dateFrom: "2026-04-27", dateTo: "2026-05-03", deputat: 24.5 }, // 4 Tage
  ];

  it("Nach Fix gewinnt TERM 13 (nicht last-write TERM 16)", () => {
    const r = simuliereSyncLauf(2026, 4, aprilPerioden, null);
    expect(r.endZustand?.termId).toBe(13);
    expect(r.writes).toBe(1); // Nur TERM 13 schreibt, alle folgenden verlieren Coverage-Duell
  });

  it("Folgelauf schreibt nichts Neues", () => {
    const nachErstLauf = simuliereSyncLauf(2026, 4, aprilPerioden, null).endZustand;
    const r = simuliereSyncLauf(2026, 4, aprilPerioden, nachErstLauf);
    expect(r.writes).toBe(1); // Nur TERM 13 (samePeriode) schreibt — kein Flip-Flop
    expect(r.endZustand?.termId).toBe(13);
  });
});

describe("Sync-Szenario: HJ-Wechsel Januar 2026 (altes vs. neues Schuljahr)", () => {
  // Januar wird von zwei Schuljahren beruehrt:
  //   Altes SJ 2024/2025 TERM 10: z.B. 15.12.-08.01. → 8 Jan-Tage, Wert 25.5
  //   Neues SJ 2025/2026 TERM 9:  09.01.-08.02.     → 23 Jan-Tage, Wert 20.5
  //
  // n8n sortiert lexikografisch: "20242025_10" kommt VOR "20252026_9"
  // (String-Vergleich). Aber Coverage-Regel macht die Reihenfolge egal.

  const altesSj: Periode = {
    schoolyearId: 20242025, termId: 10, dateFrom: "2025-12-15", dateTo: "2026-01-08", deputat: 25.5,
  };
  const neuesSj: Periode = {
    schoolyearId: 20252026, termId: 9, dateFrom: "2026-01-09", dateTo: "2026-02-08", deputat: 20.5,
  };

  it("Neue SJ-Periode gewinnt mit mehr Tagen, auch wenn sie spaeter aufgerufen wird", () => {
    const r = simuliereSyncLauf(2026, 1, [altesSj, neuesSj], null);
    expect(r.endZustand?.schoolyearId).toBe(20252026);
    expect(r.endZustand?.termId).toBe(9);
    expect(r.endZustand?.deputat).toBe(20.5);
  });

  it("Alte SJ-Periode in Folgelauf verliert (kein Flip-Flop)", () => {
    const nach1 = simuliereSyncLauf(2026, 1, [altesSj, neuesSj], null).endZustand;
    const r = simuliereSyncLauf(2026, 1, [altesSj, neuesSj], nach1);
    // Nur neueSj (samePeriode) schreibt durch
    expect(r.writes).toBe(1);
    expect(r.endZustand?.deputat).toBe(20.5);
  });

  it("Term-ID-Kollision ueber Schuljahre hinweg fuehrt nicht zu Verwechslung", () => {
    // TERM 9 im alten SJ != TERM 9 im neuen SJ — muss als verschiedene
    // Perioden behandelt werden.
    const altTerm9: Periode = {
      schoolyearId: 20242025, termId: 9, dateFrom: "2025-11-15", dateTo: "2025-12-14", deputat: 99,
    };
    const neuTerm9: Periode = {
      schoolyearId: 20252026, termId: 9, dateFrom: "2026-01-09", dateTo: "2026-02-08", deputat: 20.5,
    };

    // Jan 2026: altTerm9 beruehrt Jan nicht, neuTerm9 deckt Jan ab
    const r = simuliereSyncLauf(2026, 1, [altTerm9, neuTerm9], null);
    expect(r.endZustand?.schoolyearId).toBe(20252026);
    expect(r.endZustand?.deputat).toBe(20.5);
  });
});

describe("Sync-Szenario: Altdaten ohne Coverage werden genau einmal aktualisiert", () => {
  it("Bestehender Eintrag ohne Coverage-Info wird vom ersten Call ueberschrieben", () => {
    // Szenario: DB hat Altdaten (vor der Migration), dateFrom/dateTo=null
    const altdaten: MonatEintrag = {
      deputat: 20,
      schoolyearId: 20252026,
      termId: 9, // aber ohne Coverage-Info
      dateFrom: null as unknown as string, // wie in DB: NULL
      dateTo: null as unknown as string,
    };
    const periode: Periode = {
      schoolyearId: 20252026, termId: 11, dateFrom: "2026-02-09", dateTo: "2026-03-01", deputat: 25.5,
    };

    const r = simuliereSyncLauf(2026, 2, [periode], altdaten);
    expect(r.writes).toBe(1);
    expect(r.endZustand?.dateFrom).toBe("2026-02-09"); // Coverage-Info jetzt gesetzt
  });
});
