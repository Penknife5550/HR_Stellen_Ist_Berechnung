/**
 * Regressionstest Schuljahreswechsel — echte Untis-Daten.
 *
 * Grundlage ist ein anonymisierter Auszug des Sync-Outputs vom 03.09.2026
 * (n8n-Flow #223 v0.8, Untis-Mandant 1): 22 echte Perioden 2025/26 plus die
 * synthetische Pseudo-Periode fuer 2026/27, das Untis zu diesem Zeitpunkt noch
 * ohne Perioden fuehrt. Die Deputatswerte sind echt, Namen und Personalnummern
 * sind Platzhalter.
 *
 * Der Test deckt die Strecke ab, an der der Fehler lag: n8n-Code-Node baut die
 * Payloads, periodenDiff erkennt die Wertwechsel zum neuen Schuljahr. Der
 * Schuljahreswechsel wiederholt sich jaehrlich — hier faellt auf, wenn eine
 * Aenderung ihn wieder bricht.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  berechneNeuePeriodenWechsel,
  baueMonatsBuckets,
  wirksamMonat,
  type BucketInput,
  type PeriodenZeile,
} from "@/lib/berechnungen/periodenDiff";
import { UNTIS_PSEUDO_TERM_ID } from "@/lib/constants";

type UntisZeile = {
  SCHOOL_ID: number;
  TEACHER_ID: number;
  SCHOOLYEAR_ID: number;
  TERM_ID: number;
  Name: string;
  Vollname: string;
  Personalnummer: string;
  Stammschule: string;
  Statistik_Code: string | null;
  Deputat: number;
  Schuljahr_Text: string;
  Term_Name: string;
  DateFrom_Formatted: string;
  DateTo_Formatted: string;
  IsBPeriode: number;
  IsPseudo: number;
  Deputat_GES: number;
  Deputat_GYM: number;
  Deputat_BK: number;
};

const ROOT = process.cwd();
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/fixtures/untis-schuljahreswechsel-2026-27.json"), "utf8"),
) as { zeilen: UntisZeile[] };
const zeilen = fixture.zeilen;

/** "TT.MM.JJJJ" → "JJJJ-MM-TT" */
function iso(deutsch: string): string {
  const [t, m, j] = deutsch.split(".");
  return `${j}-${m}-${t}`;
}

function alsPeriodenZeile(r: UntisZeile): PeriodenZeile {
  return {
    lehrerId: r.TEACHER_ID,
    sy: r.SCHOOLYEAR_ID,
    termId: r.TERM_ID,
    gueltigVon: iso(r.DateFrom_Formatted),
    gueltigBis: iso(r.DateTo_Formatted),
    werte: {
      gesamt: r.Deputat,
      ges: r.Deputat_GES,
      gym: r.Deputat_GYM,
      bk: r.Deputat_BK,
    },
  };
}

const NAMEN = new Map(zeilen.map((r) => [r.TEACHER_ID, r.Vollname]));

/** Simuliert den ersten Sync-Lauf: 2025/26 liegt in der DB, 2026/27 kommt neu dazu. */
function ersterLauf() {
  const bestehend = zeilen.filter((r) => r.SCHOOLYEAR_ID === 20252026).map(alsPeriodenZeile);
  const eingefuegt = zeilen.filter((r) => r.IsPseudo === 1).map(alsPeriodenZeile);
  const wechsel = berechneNeuePeriodenWechsel({ bestehend, eingefuegt, heute: "2026-09-03" });
  const buckets = baueMonatsBuckets(
    wechsel.map<BucketInput>((w) => ({
      ...w,
      teacherId: w.lehrerId,
      vollname: NAMEN.get(w.lehrerId) ?? "",
      monate: [wirksamMonat(w.dateFrom)],
    })),
  );
  return { wechsel, buckets };
}

function bucketVon(vollname: string) {
  return ersterLauf().buckets.find((b) => b.vollname === vollname);
}

describe("n8n-Code-Node #223 v0.8", () => {
  const flowDatei = path.join(
    ROOT,
    "docs/n8n/#223_v08 - Stellenist Periodenmodell-Sync (Untis - sync-v2).json",
  );
  const flow = JSON.parse(fs.readFileSync(flowDatei, "utf8")) as {
    nodes: Array<{ type: string; parameters: { jsCode?: string } }>;
  };
  const jsCode = flow.nodes.find((n) => n.type === "n8n-nodes-base.code")?.parameters.jsCode;

  function aufbereiten(rows: UntisZeile[]) {
    // Der Code-Node laeuft in n8n gegen $input.all(); hier gegen dieselbe Struktur.
    return new Function("$input", jsCode!)({ all: () => rows.map((json) => ({ json })) }) as Array<{
      json: Record<string, unknown>;
    }>;
  }

  it("liefert Terms inklusive Pseudo-Periode und die Lehrer-Eintraege", () => {
    expect(jsCode).toBeTruthy();
    const out = aufbereiten(zeilen);
    const terms = out[0].json as { kind: string; terms: Array<Record<string, unknown>> };
    expect(terms.kind).toBe("terms");
    // 22 echte Perioden 2025/26 + 1 Pseudo-Periode 2026/27
    expect(terms.terms).toHaveLength(23);
    expect(terms.terms.at(-1)).toMatchObject({
      school_year_id: 20262027,
      term_id: UNTIS_PSEUDO_TERM_ID,
      term_name: "Schuljahr ohne Perioden",
      date_from: "01.08.2026",
      date_to: "31.07.2027",
      is_b_period: false,
    });

    const eintraege = out
      .slice(1)
      .flatMap((o) => (o.json as { eintraege: Array<Record<string, unknown>> }).eintraege);
    expect(eintraege).toHaveLength(zeilen.length);
    const pseudo = eintraege.filter((e) => e.term_id === UNTIS_PSEUDO_TERM_ID);
    expect(pseudo).toHaveLength(zeilen.filter((r) => r.IsPseudo === 1).length);
    expect(pseudo[0]).toMatchObject({ school_year_id: 20262027, stammschule: expect.any(String) });
  });

  it("setzt schuljahr_text je Chunk aus dem Chunk-Inhalt", () => {
    const nur2627 = zeilen.filter((r) => r.IsPseudo === 1);
    const out = aufbereiten(nur2627);
    expect((out[1].json as { schuljahr_text: string }).schuljahr_text).toBe("2026/2027");
  });
});

describe("Wertwechsel zum Schuljahr 2026/27", () => {
  it("meldet jede Lehrkraft hoechstens einmal, wirksam im August", () => {
    const { buckets } = ersterLauf();
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((b) => b.jahr === 2026 && b.monat === 8)).toBe(true);
    expect(new Set(buckets.map((b) => b.lehrerId)).size).toBe(buckets.length);
  });

  it("Deputat auf 0 ist gehaltsrelevant", () => {
    const b = bucketVon("Lehrkraft A");
    expect(b?.type).toBe("haupt");
    expect(b?.perioden[0]).toMatchObject({ alt: { gesamt: 25.5 }, neu: { gesamt: 0 } });
  });

  it("Deputat von 0 auf einen Wert ist gehaltsrelevant", () => {
    const b = bucketVon("Lehrkraft B");
    expect(b?.type).toBe("haupt");
    expect(b?.perioden[0].neu.gesamt).toBeGreaterThan(0);
  });

  it("Erhoehung und Senkung sind gehaltsrelevant", () => {
    expect(bucketVon("Lehrkraft C")?.type).toBe("haupt");
    expect(bucketVon("Lehrkraft D")?.type).toBe("haupt");
  });

  it("verschobene Verteilung bei gleichem Gesamtwert ist nicht gehaltsrelevant", () => {
    const b = bucketVon("Lehrkraft E");
    expect(b?.type).toBe("verteilung");
    const p = b!.perioden[0];
    expect(p.alt.gesamt).toBeCloseTo(p.neu.gesamt, 3);
  });

  it("unveraendertes Deputat erzeugt kein Event", () => {
    expect(bucketVon("Lehrkraft F")).toBeUndefined();
  });

  it("Lehrkraft ohne Vorjahres-Periode erzeugt keinen Wertwechsel", () => {
    // Die Anlage meldet der Sync separat als lehrer.created.
    expect(bucketVon("Lehrkraft G")).toBeUndefined();
  });

  it("Lehrkraft ohne Wert im neuen Schuljahr erzeugt keinen Wertwechsel", () => {
    expect(bucketVon("Lehrkraft H")).toBeUndefined();
  });

  it("Vorgaenger ist die letzte Periode des Vorjahres, nicht die erste", () => {
    const { wechsel } = ersterLauf();
    expect(wechsel.length).toBeGreaterThan(0);
    for (const w of wechsel) {
      expect(w.sy).toBe(20262027);
      expect(w.termId).toBe(UNTIS_PSEUDO_TERM_ID);
      expect(w.vorgaenger.sy).toBe(20252026);
      // Periode 22 (Periode18) ist die chronologisch letzte des Schuljahres
      expect(w.vorgaenger.termId).toBe(22);
    }
  });
});

describe("Wiederholter Sync", () => {
  it("erzeugt ohne neue Perioden keine Events", () => {
    const alle = zeilen.map(alsPeriodenZeile);
    expect(
      berechneNeuePeriodenWechsel({ bestehend: alle, eingefuegt: [], heute: "2026-09-03" }),
    ).toHaveLength(0);
  });

  it("meldet Wertwechsel innerhalb des Schuljahres beim Nachziehen einer Periode", () => {
    // Lehrkraft I hat mehrere Wechsel im Schuljahr. Wird die spaeteste Periode
    // erst jetzt synchronisiert, muss der Wechsel dorthin gemeldet werden.
    const eigene = zeilen
      .filter((r) => r.Vollname === "Lehrkraft I" && r.SCHOOLYEAR_ID === 20252026)
      .sort((a, b) => a.TERM_ID - b.TERM_ID)
      .map(alsPeriodenZeile);
    const letzte = eigene.at(-1)!;
    const wechsel = berechneNeuePeriodenWechsel({
      bestehend: eigene.slice(0, -1),
      eingefuegt: [letzte],
      // innerhalb der 60-Tage-Karenz nach Periodenende
      heute: "2026-08-01",
    });
    const erwartet =
      Math.abs(eigene.at(-2)!.werte.gesamt - letzte.werte.gesamt) > 0.001 ||
      Math.abs(eigene.at(-2)!.werte.ges - letzte.werte.ges) > 0.001 ||
      Math.abs(eigene.at(-2)!.werte.gym - letzte.werte.gym) > 0.001 ||
      Math.abs(eigene.at(-2)!.werte.bk - letzte.werte.bk) > 0.001;
    expect(wechsel).toHaveLength(erwartet ? 1 : 0);
  });
});
