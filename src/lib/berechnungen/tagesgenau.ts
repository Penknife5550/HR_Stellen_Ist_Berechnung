/**
 * Tagesgenaue Deputats-Korrektur fuer die Stellenist-Berechnung.
 *
 * Wenn HR in der Aenderungshistorie ein tatsaechliches Datum eintraegt,
 * wird der Monatswert nicht pauschal (aus `deputat_monatlich`) genommen,
 * sondern tagesgewichtet aus den Aenderungen rekonstruiert.
 *
 * Formel (Einfachfall, eine Aenderung im Monat):
 *   gewichtet = (alt / monatsTage * tageVor) + (neu / monatsTage * tageNach)
 *   korrektur = gewichtet - pauschal   (delta, wird auf Schul-Summe addiert)
 *
 * Mehrfachaenderungen im selben Monat: Zeitsegmente von Tag 1 bis zur
 * naechsten Aenderung tragen jeweils ihren Wert bei (siehe deputatEffektiv).
 *
 * WICHTIG: Der pauschale DB-Wert ist NICHT zwingend gleich dem `neu`-Wert
 * der letzten Aenderung — die Coverage-Logik (v0.4.0) entscheidet, welche
 * Untis-Periode einen Monat dominiert. Deshalb muss die Korrekturformel
 * gegen den tatsaechlichen pauschalen Lehrer-Schul-Wert aus `deputat_
 * monatlich` vergleichen, NICHT gegen `neu`.
 *
 * Rechtsgrundlage: § 3 Abs. 1 FESchVO — tagesgenaue Erfassung.
 */

function tageImMonat(jahr: number, monat: number): number {
  return new Date(jahr, monat, 0).getDate();
}

export interface TagesgenauAenderung {
  lehrerId: number;
  monat: number;
  /** Altes Deputat (vor der Aenderung) */
  altGesamt: number;
  altGes: number;
  altGym: number;
  altBk: number;
  /** Neues Deputat (nach der Aenderung) */
  neuGesamt: number;
  neuGes: number;
  neuGym: number;
  neuBk: number;
  /** Tag im Monat an dem die Aenderung stattfand (1-31) */
  aenderungTag: number;
  /** Gesamttage im Monat */
  monatsTage: number;
  stammschuleCode: string | null;
}

export interface TagesgenauKorrektur {
  monat: number;
  /** Differenz zur pauschalen Summe fuer die Schule (kann positiv oder negativ sein) */
  differenzSchulspezifisch: number;
}

/** Pauschaler Lehrer-Wert fuer einen Monat aus `deputat_monatlich`. */
export interface PauschalLehrerMonat {
  lehrerId: number;
  monat: number;
  deputatGesamt: number;
  deputatGes: number;
  deputatGym: number;
  deputatBk: number;
}

type Spalte = "gesamt" | "ges" | "gym" | "bk";

function werteFuerSpalte(a: TagesgenauAenderung, spalte: Spalte, seite: "alt" | "neu"): number {
  if (seite === "alt") {
    return spalte === "gesamt" ? a.altGesamt
      : spalte === "ges" ? a.altGes
      : spalte === "gym" ? a.altGym
      : a.altBk;
  }
  return spalte === "gesamt" ? a.neuGesamt
    : spalte === "ges" ? a.neuGes
    : spalte === "gym" ? a.neuGym
    : a.neuBk;
}

/**
 * Gewichteter Monatswert aus einer oder mehreren Aenderungen fuer eine Spalte.
 * Bildet Zeitsegmente (Tag 1 bis Aenderung_1, Aenderung_1 bis Aenderung_2, …)
 * und summiert pro Segment wert × tage / monatsTage.
 */
function gewichteterSpaltenWert(
  aenderungenSortiert: TagesgenauAenderung[],
  spalte: Spalte,
  monatsTage: number
): number {
  if (aenderungenSortiert.length === 0) return 0;

  let summe = 0;

  // Segment vor der ersten Aenderung
  const erste = aenderungenSortiert[0];
  if (erste.aenderungTag > 1) {
    const tage = Math.min(monatsTage, erste.aenderungTag - 1);
    summe += (werteFuerSpalte(erste, spalte, "alt") * tage) / monatsTage;
  }

  // Segmente ab jeder Aenderung bis zur naechsten (oder Monatsende)
  for (let i = 0; i < aenderungenSortiert.length; i++) {
    const a = aenderungenSortiert[i];
    const naechste = aenderungenSortiert[i + 1];
    const startTag = Math.max(1, Math.min(monatsTage, a.aenderungTag));
    const endeTag = naechste
      ? Math.min(monatsTage, naechste.aenderungTag - 1)
      : monatsTage;
    if (endeTag < startTag) continue;
    const tage = endeTag - startTag + 1;
    summe += (werteFuerSpalte(a, spalte, "neu") * tage) / monatsTage;
  }

  return summe;
}

/**
 * Berechnet die tagesgewichteten Korrekturen fuer eine Schule.
 *
 * @param aenderungen             Alle Aenderungen mit tatsaechlichem Datum
 * @param schulKurzname           GES, GYM, BK, GSH, GSM, GSS etc.
 * @param jahr                    Kalenderjahr (fuer Tage-im-Monat Berechnung)
 * @param pauschaleLehrerWerte    Map von (lehrerId + monat) auf die pauschalen
 *                                Werte aus `deputat_monatlich` (notwendig, da
 *                                der pauschale Wert nicht zwingend gleich dem
 *                                `neu`-Wert einer Aenderung ist — Coverage-
 *                                Regel v0.4.0).
 * @returns Array von Korrekturen pro Monat (Delta auf die Schul-Summe)
 */
export function berechneTagesgenauKorrekturen(
  aenderungen: TagesgenauAenderung[],
  schulKurzname: string,
  jahr: number,
  pauschaleLehrerWerte: Map<string, PauschalLehrerMonat>
): TagesgenauKorrektur[] {
  const korrekturen: TagesgenauKorrektur[] = [];

  const spalteMap: Record<string, Spalte> = {
    GES: "ges",
    GYM: "gym",
    BK: "bk",
  };
  const spalte: Spalte | undefined = spalteMap[schulKurzname];

  // Gruppieren nach (lehrerId, monat) — Mehrfachaenderungen korrekt segmentieren
  const byLehrerMonat = new Map<string, TagesgenauAenderung[]>();
  for (const a of aenderungen) {
    const key = `${a.lehrerId}_${a.monat}`;
    const arr = byLehrerMonat.get(key) ?? [];
    arr.push(a);
    byLehrerMonat.set(key, arr);
  }

  const deltaByMonat = new Map<number, number>();

  for (const [, gruppe] of byLehrerMonat) {
    const erste = gruppe[0];
    const monat = erste.monat;
    const monatsTage = erste.monatsTage || tageImMonat(jahr, monat);

    // Schul-Spalte bestimmen
    let verwendeteSpalte: Spalte;
    if (spalte) {
      verwendeteSpalte = spalte;
    } else {
      // Grundschulen: nur wenn Stammschule passt
      if (erste.stammschuleCode !== schulKurzname) continue;
      verwendeteSpalte = "gesamt";
    }

    const sortiert = [...gruppe].sort((a, b) => a.aenderungTag - b.aenderungTag);
    const gewichtet = gewichteterSpaltenWert(sortiert, verwendeteSpalte, monatsTage);

    // Pauschaler Lehrer-Wert fuer diese Spalte aus deputat_monatlich
    const pauschalEintrag = pauschaleLehrerWerte.get(`${erste.lehrerId}_${monat}`);
    const pauschalWert = pauschalEintrag
      ? (verwendeteSpalte === "gesamt" ? pauschalEintrag.deputatGesamt
        : verwendeteSpalte === "ges" ? pauschalEintrag.deputatGes
        : verwendeteSpalte === "gym" ? pauschalEintrag.deputatGym
        : pauschalEintrag.deputatBk)
      : 0;

    // Wenn Gewichtet und Pauschal praktisch gleich sind → keine Korrektur
    const delta = gewichtet - pauschalWert;
    if (Math.abs(delta) < 0.001) continue;

    deltaByMonat.set(monat, (deltaByMonat.get(monat) ?? 0) + delta);
  }

  for (const [monat, delta] of deltaByMonat) {
    korrekturen.push({ monat, differenzSchulspezifisch: delta });
  }

  return korrekturen.sort((a, b) => a.monat - b.monat);
}
