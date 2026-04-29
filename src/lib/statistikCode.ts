/**
 * Hilfsfunktionen + Konstanten rund um NRW-Statistik-Codes.
 *
 * Single Source of Truth: Type-Definitionen, Konstanten und Pure Helpers
 * fuer Beamte/Angestellte/Sonstiges-Aufschluesselung.
 */

export const STATISTIK_GRUPPEN = ["beamter", "angestellter", "sonstiges"] as const;
export type StatistikGruppe = (typeof STATISTIK_GRUPPEN)[number];

export const GRUPPE_LABEL: Record<StatistikGruppe, string> = {
  beamter: "Beamte",
  angestellter: "Angestellte",
  sonstiges: "Sonstiges",
};

/**
 * CREDO-Farbpalette fuer Gruppen-Visualisierung (Bars, Badges, Tiles).
 * Werte spiegeln die CSS-Variablen aus globals.css:
 * - beamter.bg  = var(--color-credo-blau)  = #009AC6
 * - angestellter.bg = var(--color-credo-gym) = #FBC900
 * Hex-Werte werden hier wiederholt, weil Tailwind 4 in dynamischen
 * style={{...}}-Props keine var()-Referenzen aufloest.
 */
export const GRUPPE_FARBEN: Record<"beamter" | "angestellter" | "ohne", { bg: string; soft: string; text: string }> = {
  beamter: { bg: "#009AC6", soft: "#E0F2FB", text: "white" },
  angestellter: { bg: "#FBC900", soft: "#FEF7CC", text: "#1A1A1A" },
  ohne: { bg: "#9CA3AF", soft: "#F3F4F6", text: "white" },
};

export interface StatistikCodeInfo {
  code: string;
  bezeichnung: string;
  gruppe: StatistikGruppe | string;
  istTeilzeit: boolean;
}

/** Type Guard: ist der Wert eine bekannte Statistik-Gruppe? */
export function isStatistikGruppe(value: unknown): value is StatistikGruppe {
  return typeof value === "string" && (STATISTIK_GRUPPEN as readonly string[]).includes(value);
}

export interface PersonalstrukturInput {
  codes: StatistikCodeInfo[];
  schulen: string[];
  perCodeSchule: { code: string | null; schule: string | null; anzahl: number }[];
}

export interface PersonalstrukturRow {
  schulKurzname: string;
  beamteVollzeit: number;
  beamteTeilzeit: number;
  beamteGesamt: number;
  angestellteVollzeit: number;
  angestellteTeilzeit: number;
  angestellteGesamt: number;
  ohne: number;
  gesamt: number;
}

/**
 * Erkennt ob sich der Statistik-Code zwischen DB-Bestand und Sync-Resultat
 * geaendert hat. Liefert true wenn ein Audit-Eintrag geschrieben werden soll.
 *
 * Behandelt undefined/null konsistent (beides = "kein Code").
 */
export function detectStatistikCodeChange(
  existing: string | null | undefined,
  resolved: string | null | undefined,
): boolean {
  return (existing ?? null) !== (resolved ?? null);
}

/**
 * Normalisiert einen vom Sync (z.B. Untis) gelieferten Statistik-Code:
 * - trimmt + uppercase
 * - prueft gegen Whitelist gueltiger Codes
 * - faellt bei Update auf den bestehenden Code zurueck (kein Datenverlust)
 *
 * Rueckgabe: Code der in lehrer.statistik_code geschrieben werden darf,
 * oder null wenn kein gueltiger Code vorliegt.
 */
export function normalizeStatistikCode(
  rawIncoming: string | null | undefined,
  validCodes: Set<string>,
  existing: string | null | undefined,
): { incomingValid: string | null; valueForUpdate: string | null } {
  const trimmed = rawIncoming?.trim().toUpperCase() || null;
  const incomingValid = trimmed && validCodes.has(trimmed) ? trimmed : null;
  const valueForUpdate = incomingValid ?? existing ?? null;
  return { incomingValid, valueForUpdate };
}

/**
 * Sortier-Rang einer Statistik-Gruppe fuer Listen-/Export-Sortierung:
 *   0 = Beamte (zuerst)
 *   1 = Angestellte
 *   2 = Sonstiges / null / unbekannt (zuletzt)
 */
export function gruppenSortRank(gruppe: string | null | undefined): number {
  if (gruppe === "beamter") return 0;
  if (gruppe === "angestellter") return 1;
  return 2;
}

/** Lesbare Bezeichnung fuer Sub-Header in Listen/Exports. */
export function gruppenLabel(gruppe: string | null | undefined): string {
  if (gruppe === "beamter") return "Beamte";
  if (gruppe === "angestellter") return "Angestellte";
  return "Sonstige / Ohne Code";
}

/**
 * Sortiert eine Lehrerliste nach Schule -> Gruppe (Beamte vor Angestellten
 * vor Sonstigen) -> Name. Pure Helper, in Ueberblick und Excel/PDF-Export
 * gleichermassen verwendet.
 */
export function vergleicheLehrerNachSchuleGruppeName<
  T extends { stammschule: string | null; gruppe: string | null; name: string }
>(a: T, b: T): number {
  const sa = (a.stammschule ?? "").toUpperCase();
  const sb = (b.stammschule ?? "").toUpperCase();
  if (sa !== sb) return sa.localeCompare(sb, "de");
  const ga = gruppenSortRank(a.gruppe);
  const gb = gruppenSortRank(b.gruppe);
  if (ga !== gb) return ga - gb;
  return a.name.localeCompare(b.name, "de");
}

/**
 * Aggregiert Lehrer-pro-Code-und-Schule zu einer Personalstruktur-Tabelle.
 * Eine Zeile pro Schule mit Gruppe-Aufschluesselung (Beamte / Angestellte / Ohne).
 * Sortiert alphabetisch nach Schul-Kurzname (de-DE).
 */
export function buildPersonalstruktur(data: PersonalstrukturInput): PersonalstrukturRow[] {
  const codeMap = new Map(data.codes.map((c) => [c.code, c]));
  const bySchule = new Map<string, PersonalstrukturRow>();

  for (const s of data.schulen) {
    bySchule.set(s, {
      schulKurzname: s,
      beamteVollzeit: 0,
      beamteTeilzeit: 0,
      beamteGesamt: 0,
      angestellteVollzeit: 0,
      angestellteTeilzeit: 0,
      angestellteGesamt: 0,
      ohne: 0,
      gesamt: 0,
    });
  }

  for (const r of data.perCodeSchule) {
    if (!r.schule) continue;
    const row = bySchule.get(r.schule);
    if (!row) continue;

    if (!r.code) {
      row.ohne += r.anzahl;
    } else {
      const info = codeMap.get(r.code);
      if (!info) {
        row.ohne += r.anzahl;
      } else if (info.gruppe === "beamter") {
        row.beamteGesamt += r.anzahl;
        if (info.istTeilzeit) row.beamteTeilzeit += r.anzahl;
        else row.beamteVollzeit += r.anzahl;
      } else if (info.gruppe === "angestellter") {
        row.angestellteGesamt += r.anzahl;
        if (info.istTeilzeit) row.angestellteTeilzeit += r.anzahl;
        else row.angestellteVollzeit += r.anzahl;
      } else {
        row.ohne += r.anzahl;
      }
    }
    row.gesamt += r.anzahl;
  }

  return Array.from(bySchule.values()).sort((a, b) =>
    a.schulKurzname.localeCompare(b.schulKurzname, "de"),
  );
}

export function summePersonalstruktur(rows: PersonalstrukturRow[]): PersonalstrukturRow {
  return rows.reduce<PersonalstrukturRow>(
    (acc, r) => ({
      schulKurzname: "Gesamt",
      beamteVollzeit: acc.beamteVollzeit + r.beamteVollzeit,
      beamteTeilzeit: acc.beamteTeilzeit + r.beamteTeilzeit,
      beamteGesamt: acc.beamteGesamt + r.beamteGesamt,
      angestellteVollzeit: acc.angestellteVollzeit + r.angestellteVollzeit,
      angestellteTeilzeit: acc.angestellteTeilzeit + r.angestellteTeilzeit,
      angestellteGesamt: acc.angestellteGesamt + r.angestellteGesamt,
      ohne: acc.ohne + r.ohne,
      gesamt: acc.gesamt + r.gesamt,
    }),
    {
      schulKurzname: "Gesamt",
      beamteVollzeit: 0,
      beamteTeilzeit: 0,
      beamteGesamt: 0,
      angestellteVollzeit: 0,
      angestellteTeilzeit: 0,
      angestellteGesamt: 0,
      ohne: 0,
      gesamt: 0,
    },
  );
}

// ============================================================
// DEPUTAT-STRUKTUR (Stunden-Aggregation pro Schule x Gruppe)
// ============================================================

export interface DeputatStrukturRow {
  schuleId: number;
  schulKurzname: string;
  schulFarbe: string;
  beamteAnzahl: number;
  beamteStunden: number;
  angestellteAnzahl: number;
  angestellteStunden: number;
  ohneAnzahl: number;
  ohneStunden: number;
  gesamtAnzahl: number;
  gesamtStunden: number;
}

export interface DeputatStrukturInput {
  schulen: { id: number; kurzname: string; farbe: string }[];
  /** Pro Lehrer: Stammschule, Gruppe, durchschnittliche Wochenstunden (avg ueber positive Monate). */
  lehrer: {
    lehrerId: number;
    stammschuleId: number | null;
    gruppe: string | null;
    avgStunden: number;
  }[];
}

/**
 * Aggregiert Lehrer-Deputate pro Schule und Statistik-Gruppe.
 * Schulen ohne Lehrer werden aus der Liste gefiltert.
 * Stunden auf 1 Dezimalstelle gerundet.
 */
export function buildDeputatStruktur(input: DeputatStrukturInput): DeputatStrukturRow[] {
  const map = new Map<number, DeputatStrukturRow>();
  for (const s of input.schulen) {
    map.set(s.id, {
      schuleId: s.id,
      schulKurzname: s.kurzname,
      schulFarbe: s.farbe,
      beamteAnzahl: 0,
      beamteStunden: 0,
      angestellteAnzahl: 0,
      angestellteStunden: 0,
      ohneAnzahl: 0,
      ohneStunden: 0,
      gesamtAnzahl: 0,
      gesamtStunden: 0,
    });
  }

  for (const l of input.lehrer) {
    if (l.stammschuleId == null) continue;
    const target = map.get(l.stammschuleId);
    if (!target) continue;
    if (l.avgStunden <= 0) continue;

    if (l.gruppe === "beamter") {
      target.beamteAnzahl += 1;
      target.beamteStunden += l.avgStunden;
    } else if (l.gruppe === "angestellter") {
      target.angestellteAnzahl += 1;
      target.angestellteStunden += l.avgStunden;
    } else {
      target.ohneAnzahl += 1;
      target.ohneStunden += l.avgStunden;
    }
    target.gesamtAnzahl += 1;
    target.gesamtStunden += l.avgStunden;
  }

  const round = (n: number) => Math.round(n * 10) / 10;
  return Array.from(map.values())
    .filter((r) => r.gesamtAnzahl > 0)
    .map((r) => ({
      ...r,
      beamteStunden: round(r.beamteStunden),
      angestellteStunden: round(r.angestellteStunden),
      ohneStunden: round(r.ohneStunden),
      gesamtStunden: round(r.gesamtStunden),
    }))
    .sort((a, b) => a.schulKurzname.localeCompare(b.schulKurzname, "de"));
}

export function summeDeputatStruktur(rows: DeputatStrukturRow[]): DeputatStrukturRow {
  return rows.reduce<DeputatStrukturRow>(
    (acc, r) => ({
      schuleId: 0,
      schulKurzname: "Gesamt",
      schulFarbe: "#575756",
      beamteAnzahl: acc.beamteAnzahl + r.beamteAnzahl,
      beamteStunden: acc.beamteStunden + r.beamteStunden,
      angestellteAnzahl: acc.angestellteAnzahl + r.angestellteAnzahl,
      angestellteStunden: acc.angestellteStunden + r.angestellteStunden,
      ohneAnzahl: acc.ohneAnzahl + r.ohneAnzahl,
      ohneStunden: acc.ohneStunden + r.ohneStunden,
      gesamtAnzahl: acc.gesamtAnzahl + r.gesamtAnzahl,
      gesamtStunden: acc.gesamtStunden + r.gesamtStunden,
    }),
    {
      schuleId: 0,
      schulKurzname: "Gesamt",
      schulFarbe: "#575756",
      beamteAnzahl: 0, beamteStunden: 0,
      angestellteAnzahl: 0, angestellteStunden: 0,
      ohneAnzahl: 0, ohneStunden: 0,
      gesamtAnzahl: 0, gesamtStunden: 0,
    },
  );
}
