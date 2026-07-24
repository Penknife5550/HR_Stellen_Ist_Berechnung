/**
 * Aufbereitung "Nachweis Bezirksregierung".
 *
 * Pure Aggregations-/Gruppierungslogik (kein DB-Zugriff, testbar). Die Route
 * laedt die Rohdaten ueber die bestehenden Query-Funktionen und ruft hier die
 * Gruppierung nach Beamte/Angestellte/Sonstige auf.
 *
 * Aufbau: Kalenderjahr Januar–Dezember, je Lehrkraft die tatsaechlich
 * geleisteten Wochenstunden pro Monat (wie in der Deputate-Uebersicht) und
 * summiert. Fachliche Trennung: Januar–Juli gehoert zum ALTEN Schuljahr,
 * August–Dezember zum NEUEN Schuljahr.
 *
 * Fachlich (§ 3 Abs. 1 FESchVO): Die Wochenstunden zaehlen bei der Schule, an
 * der sie erteilt werden — eine Lehrkraft kann daher bei mehreren Schulen mit
 * ihren dort erteilten Stunden erscheinen (Stammschule wird je Zeile ausgewiesen).
 */

import { gruppenSortRank, gruppenLabel } from "@/lib/statistikCode";

export const MONATE_JAN_JUL: readonly number[] = [1, 2, 3, 4, 5, 6, 7];
export const MONATE_AUG_DEZ: readonly number[] = [8, 9, 10, 11, 12];
export const ALLE_MONATE: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Normalisiert eine Statistik-Gruppe auf die drei Nachweis-Buckets. */
export function normalisiereGruppe(gruppe: string | null | undefined): "beamter" | "angestellter" | "sonstiges" {
  if (gruppe === "beamter") return "beamter";
  if (gruppe === "angestellter") return "angestellter";
  return "sonstiges";
}

export interface NachweisLehrerRow {
  lehrerId: number;
  vollname: string;
  stammschuleCode: string | null;
  /** Rohe Statistik-Gruppe aus statistik_codes.gruppe (oder null = ohne Code). */
  gruppe: string | null;
  /** Tatsaechliche Wochenstunden je Monat (1..12), tagesgenau, schulspezifisch. */
  stundenProMonat: Record<number, number>;
  /** Summe der Wochenstunden Jan–Jul (altes Schuljahr). */
  summeJanJul: number;
  /** Summe der Wochenstunden Aug–Dez (neues Schuljahr). */
  summeAugDez: number;
}

export interface NachweisGruppe {
  gruppe: "beamter" | "angestellter" | "sonstiges";
  label: string;
  lehrer: NachweisLehrerRow[];
  anzahl: number;
  /** Monatssummen (1..12) ueber alle Lehrer der Gruppe. */
  monatsSummen: Record<number, number>;
  summeJanJul: number;
  summeAugDez: number;
}

/** Summiert die Wochenstunden eines Monats-Bereichs. */
export function summeMonate(stundenProMonat: Record<number, number>, monate: readonly number[]): number {
  return monate.reduce((s, m) => s + (stundenProMonat[m] ?? 0), 0);
}

/**
 * Gruppiert Lehrer-Zeilen nach Status (Beamte vor Angestellten vor Sonstigen),
 * sortiert innerhalb alphabetisch und bildet Monats- und Halbjahres-Summen.
 * Leere Gruppen werden weggelassen.
 */
export function gruppiereNachStatus(rows: NachweisLehrerRow[]): NachweisGruppe[] {
  const buckets = new Map<"beamter" | "angestellter" | "sonstiges", NachweisLehrerRow[]>();
  for (const r of rows) {
    const key = normalisiereGruppe(r.gruppe);
    const arr = buckets.get(key);
    if (arr) arr.push(r);
    else buckets.set(key, [r]);
  }

  const gruppen: NachweisGruppe[] = [];
  for (const [gruppe, lehrer] of buckets) {
    lehrer.sort((a, b) => a.vollname.localeCompare(b.vollname, "de"));
    const monatsSummen: Record<number, number> = {};
    for (const m of ALLE_MONATE) {
      monatsSummen[m] = round3(lehrer.reduce((s, l) => s + (l.stundenProMonat[m] ?? 0), 0));
    }
    gruppen.push({
      gruppe,
      label: gruppenLabel(gruppe),
      lehrer,
      anzahl: lehrer.length,
      monatsSummen,
      summeJanJul: round3(lehrer.reduce((s, l) => s + l.summeJanJul, 0)),
      summeAugDez: round3(lehrer.reduce((s, l) => s + l.summeAugDez, 0)),
    });
  }

  return gruppen.sort((a, b) => gruppenSortRank(a.gruppe) - gruppenSortRank(b.gruppe));
}

export interface NachweisMehrarbeitLehrer {
  vollname: string;
  janJulStunden: number;
  augDezStunden: number;
}

export interface NachweisMehrarbeit {
  lehrer: NachweisMehrarbeitLehrer[];
  /** Schulweite Mehrarbeit als Stellenanteil-Summe je Halbjahr. */
  schulweitJanJulStellen: number;
  schulweitAugDezStellen: number;
  /** Resultierende Mehrarbeit-Stellen (aus berechneStellenist), je Halbjahr. */
  stellenJanJul: number;
  stellenAugDez: number;
  hatDaten: boolean;
}

export interface NachweisStellenanteil {
  bezeichnung: string;
  kuerzel: string | null;
  typ: string;
  wert: number;
  eurBetrag: number | null;
  zeitraum: string;
  status: string;
  lehrerName: string | null;
  aktenzeichen: string | null;
}

export interface NachweisSchule {
  schuleId: number;
  kurzname: string;
  name: string;
  farbe: string;
  regeldeputat: number;
  gruppen: NachweisGruppe[];
  /** Monatssummen (1..12) ueber ALLE Lehrer der Schule. */
  monatsSummen: Record<number, number>;
  summeJanJul: number;
  summeAugDez: number;
  /** Stellenist ohne Mehrarbeit, je Halbjahr. */
  stellenJanJul: number;
  stellenAugDez: number;
  mehrarbeit: NachweisMehrarbeit;
  /** Gesamt = Stellenist + Mehrarbeit, je Halbjahr. */
  gesamtStellenJanJul: number;
  gesamtStellenAugDez: number;
  /** Gewichteter Jahreswert (janJul*7 + augDez*5)/12 der Gesamt-Stellen. */
  jahreswertGewichtet: number;
  stellenanteile: NachweisStellenanteil[];
}

export interface NachweisGesamt {
  janJul: number;
  augDez: number;
  jahreswert: number;
}

export interface NachweisDaten {
  haushaltsjahr: number;
  /** SJ-Bezeichnung fuer Jan–Jul (altes Schuljahr), z.B. "2025/2026". */
  altesSchuljahr: string;
  /** SJ-Bezeichnung fuer Aug–Dez (neues Schuljahr), z.B. "2026/2027". */
  neuesSchuljahr: string;
  erstelltAm: string;
  schulen: NachweisSchule[];
  gesamt: NachweisGesamt;
}

/** Gewichteter Jahresdurchschnitt (Jan-Jul zaehlt 7, Aug-Dez zaehlt 5 Monate). */
export function gewichteterJahreswert(janJul: number, augDez: number): number {
  return round4((janJul * 7 + augDez * 5) / 12);
}

/** Schuljahr-Bezeichnung fuer ein Kalenderjahr: altes SJ = (Y-1)/Y, neues SJ = Y/(Y+1). */
export function schuljahreFuerKalenderjahr(jahr: number): { altes: string; neues: string } {
  return { altes: `${jahr - 1}/${jahr}`, neues: `${jahr}/${jahr + 1}` };
}

/** Summiert die Schul-Ergebnisse zur Gesamtzeile ueber alle Schulen. */
export function summeNachweis(schulen: NachweisSchule[]): NachweisGesamt {
  let janJul = 0;
  let augDez = 0;
  for (const s of schulen) {
    janJul += s.gesamtStellenJanJul;
    augDez += s.gesamtStellenAugDez;
  }
  return {
    janJul: round4(janJul),
    augDez: round4(augDez),
    jahreswert: gewichteterJahreswert(janJul, augDez),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
