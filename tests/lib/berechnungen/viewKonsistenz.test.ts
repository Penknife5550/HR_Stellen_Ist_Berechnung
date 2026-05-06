/**
 * Konsistenz-Test: v_deputat_pro_tag (SQL, Migration 0014) ↔ Segment-Code
 * (lib/berechnungen/deputatEffektiv.ts).
 *
 * Hintergrund: Der "Pauschal"-Wert auf der Detail-Seite kommt aus dem
 * taggenauen View (AVG ueber v_deputat_pro_tag). Die Detail-Card rechnet
 * die Werte segmentbasiert. Beide muessen fuer korrekturbehaftete Monate
 * dasselbe Ergebnis liefern, sonst klafft die Anzeige auseinander UND die
 * Refinanzierung wird falsch.
 *
 * Migration 0012 hatte einen Bug: bei "nach hinten" verschobenem
 * Korrektur-Datum entstand eine Luecke (alte Periode endete an Untis-
 * gueltig_bis, neue Periode begann erst am korrigierten Datum). Migration
 * 0014 fuellt diese Luecke, indem die Vorgaenger-Periode bis zum Tag vor
 * der Korrektur verlaengert wird.
 *
 * Da Vitest ohne DB laeuft, bilden wir die SQL-Logik in TS nach
 * (`simuliereTaggenauenView`) und vergleichen gegen `berechneLehrerDeputatEffektiv`.
 */

import { describe, it, expect } from "vitest";
import { berechneLehrerDeputatEffektiv } from "@/lib/berechnungen/deputatEffektiv";

interface PeriodeInput {
  gueltigVon: string;     // ISO YYYY-MM-DD
  gueltigBis: string;
  deputatGesamt: number;
  /** Korrekturwert aus deputat_aenderung_korrekturen.tatsaechliches_datum */
  korrekturDatum?: string | null;
}

/** ISO-Datum minus 1 Tag, Zeitzonen-sicher. */
function tagFruherIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Bildet die Logik aus Migration 0014 (v_deputat_pro_tag → AVG in
 * v_deputat_monat_tagesgenau) fuer einen Lehrer/Monat in TS nach.
 *
 * Returnt den AVG-Wert fuer den Monat (analog
 * `deputat_gesamt_tagesgenau`) und die Anzahl Tage mit Eintrag (`tage_im_monat`).
 */
function simuliereTaggenauenView(
  perioden: PeriodeInput[],
  jahr: number,
  monat: number,
): { gesamt: number; tageImMonat: number } {
  const sortiert = [...perioden].sort((a, b) =>
    a.gueltigVon.localeCompare(b.gueltigVon),
  );

  // dpp_effektiv: effektiv_von + effektiv_bis (CASE WHEN aus 0014)
  const effektiv = sortiert.map((p, i) => {
    const naechste = sortiert[i + 1];
    const folgerKorrektur = naechste?.korrekturDatum ?? null;
    const effektivVon = p.korrekturDatum ?? p.gueltigVon;
    let effektivBis = p.gueltigBis;
    if (folgerKorrektur && folgerKorrektur > p.gueltigBis) {
      effektivBis = tagFruherIso(folgerKorrektur);
    }
    return { ...p, effektivVon, effektivBis };
  });

  const monatsTage = new Date(jahr, monat, 0).getDate();
  let summe = 0;
  let count = 0;
  for (let tag = 1; tag <= monatsTage; tag++) {
    const isoTag = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
    const matches = effektiv.filter(
      (e) => e.effektivVon <= isoTag && isoTag <= e.effektivBis,
    );
    if (matches.length === 0) continue;
    // ORDER BY effektiv_von DESC, gueltig_von DESC LIMIT 1
    matches.sort((a, b) =>
      a.effektivVon !== b.effektivVon
        ? b.effektivVon.localeCompare(a.effektivVon)
        : b.gueltigVon.localeCompare(a.gueltigVon),
    );
    summe += matches[0].deputatGesamt;
    count++;
  }
  return { gesamt: count > 0 ? summe / count : 0, tageImMonat: count };
}

/** Hilfsfunktion: Segment-Code mit View-AVG als Pauschal-Input rechnen. */
function segmentEffektiv(
  jahr: number,
  monat: number,
  pauschalAusView: number,
  alt: number,
  neu: number,
  tatsaechlichesDatum: string,
): number {
  const result = berechneLehrerDeputatEffektiv(
    [{ monat, deputatGesamt: pauschalAusView, deputatGes: pauschalAusView, deputatGym: 0, deputatBk: 0 }],
    [{
      monat,
      deputatGesamtAlt: alt, deputatGesAlt: alt, deputatGymAlt: 0, deputatBkAlt: 0,
      deputatGesamtNeu: neu, deputatGesNeu: neu, deputatGymNeu: 0, deputatBkNeu: 0,
      tatsaechlichesDatum,
    }],
    jahr,
  );
  return result.get(monat)!.effektiv.gesamt;
}

describe("View v_deputat_pro_tag (Migration 0014) ↔ Segment-Code", () => {
  it("Sanity: keine Korrektur, lueckenlose Untis-Perioden", () => {
    // Mai 2025, Lehrer hatte 1.-25. = 10, ab 26. = 0
    const perioden: PeriodeInput[] = [
      { gueltigVon: "2025-04-28", gueltigBis: "2025-05-25", deputatGesamt: 10 },
      { gueltigVon: "2025-05-26", gueltigBis: "2025-06-30", deputatGesamt: 0 },
    ];
    const { gesamt, tageImMonat } = simuliereTaggenauenView(perioden, 2025, 5);
    expect(tageImMonat).toBe(31);
    expect(gesamt).toBeCloseTo((25 * 10 + 6 * 0) / 31, 3);
  });

  it("Fall A — Korrektur VORGEZOGEN (Untis-Mo 26.05., Korrektur 21.05.)", () => {
    const perioden: PeriodeInput[] = [
      { gueltigVon: "2025-04-28", gueltigBis: "2025-05-25", deputatGesamt: 10 },
      {
        gueltigVon: "2025-05-26",
        gueltigBis: "2025-06-30",
        deputatGesamt: 0,
        korrekturDatum: "2025-05-21",
      },
    ];
    const { gesamt, tageImMonat } = simuliereTaggenauenView(perioden, 2025, 5);
    // Tage 1-20: alt (20). Tage 21-31: neu via Ueberlappung + ORDER BY (11).
    expect(tageImMonat).toBe(31);
    const erwartet = (20 * 10 + 11 * 0) / 31; // 6.4516...
    expect(gesamt).toBeCloseTo(erwartet, 3);

    const segm = segmentEffektiv(2025, 5, gesamt, 10, 0, "2025-05-21");
    expect(segm).toBeCloseTo(erwartet, 3);
    expect(Math.abs(segm - gesamt)).toBeLessThan(0.001);
  });

  it("Fall B — Korrektur NACH HINTEN (Untis-Mo 19.05., Korrektur 21.05.) — Luecke MUSS geschlossen sein", () => {
    const perioden: PeriodeInput[] = [
      { gueltigVon: "2025-04-28", gueltigBis: "2025-05-18", deputatGesamt: 10 },
      {
        gueltigVon: "2025-05-19",
        gueltigBis: "2025-06-30",
        deputatGesamt: 0,
        korrekturDatum: "2025-05-21",
      },
    ];
    const { gesamt, tageImMonat } = simuliereTaggenauenView(perioden, 2025, 5);
    // Vor Migration 0014: 29 Tage (Luecke 19./20.05.), gesamt = 180/29 = 6.207
    // Nach 0014: 31 Tage, gesamt = 200/31 = 6.452
    expect(tageImMonat).toBe(31);
    const erwartet = (20 * 10 + 11 * 0) / 31;
    expect(gesamt).toBeCloseTo(erwartet, 3);

    const segm = segmentEffektiv(2025, 5, gesamt, 10, 0, "2025-05-21");
    expect(segm).toBeCloseTo(erwartet, 3);
    // Konsistenz View ↔ Segment
    expect(Math.abs(segm - gesamt)).toBeLessThan(0.001);
  });

  it("Echte Untis-Pause (kein Korrektur): View laesst die Luecke bestehen", () => {
    // Lehrkraft pausiert 19.-25.05. (z.B. Beurlaubung) — KEIN korrekturDatum
    const perioden: PeriodeInput[] = [
      { gueltigVon: "2025-04-28", gueltigBis: "2025-05-18", deputatGesamt: 10 },
      { gueltigVon: "2025-05-26", gueltigBis: "2025-06-30", deputatGesamt: 10 },
    ];
    const { gesamt, tageImMonat } = simuliereTaggenauenView(perioden, 2025, 5);
    // 18 Tage Vor + 6 Tage Nach = 24 Tage; 7 Tage Luecke (19.-25.05.)
    expect(tageImMonat).toBe(24);
    expect(gesamt).toBeCloseTo(10, 3);
  });

  it("Korrektur am Periodenanfang (Stichtag = gueltig_von): View == ohne Korrektur", () => {
    // Korrektur die genau auf den Untis-Mo zeigt → effektiv_von = gueltig_von
    const perioden: PeriodeInput[] = [
      { gueltigVon: "2025-04-28", gueltigBis: "2025-05-25", deputatGesamt: 10 },
      {
        gueltigVon: "2025-05-26",
        gueltigBis: "2025-06-30",
        deputatGesamt: 0,
        korrekturDatum: "2025-05-26",
      },
    ];
    const { gesamt, tageImMonat } = simuliereTaggenauenView(perioden, 2025, 5);
    expect(tageImMonat).toBe(31);
    expect(gesamt).toBeCloseTo((25 * 10 + 6 * 0) / 31, 3);
  });
});
