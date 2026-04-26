/**
 * Hilfsfunktionen rund um NRW-Statistik-Codes.
 *
 * Diese Funktionen sind als reine Funktionen ausgelegt damit sie
 * unabhaengig von DB / Request-Kontext getestet werden koennen.
 */

export type StatistikGruppe = "beamter" | "angestellter" | "sonstiges";

export interface StatistikCodeInfo {
  code: string;
  bezeichnung: string;
  gruppe: string;
  istTeilzeit: boolean;
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
