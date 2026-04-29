/**
 * Taggenaue Deputatsberechnung pro Lehrer.
 *
 * Wenn HR fuer eine `deputat_aenderungen`-Zeile ein `tatsaechlichesDatum`
 * eintraegt, wird das Monatsdeputat tagesgewichtet — die pauschale
 * Angabe in `deputat_monatlich` wird NICHT als Basis verwendet.
 *
 * Formel (Einfachfall, eine Aenderung im Monat):
 *
 *   effektiv = (alt / monatsTage * tageVor) + (neu / monatsTage * tageNach)
 *
 * Beispiel Bergen Eduard, Jan 2026 (31 Tage), Aenderung am 05.01. von 20.5 -> 25.5:
 *   (20.5 × 4 / 31) + (25.5 × 27 / 31) = 2.645 + 22.210 = 24.855
 *
 * Bei mehreren Aenderungen im selben Monat wird der Monat in Zeitsegmente
 * zerlegt (Tag 1 bis Aenderung_1, Aenderung_1 bis Aenderung_2, …, letzte
 * Aenderung bis Monatsende). Jedes Segment traegt seinen Wert × Tage /
 * monatsTage bei.
 *
 * Kontextfrei zu `pauschal`: Der pauschale DB-Wert kann der alte ODER
 * der neue Wert aus der Aenderungszeile sein (abhaengig von der Untis-
 * Coverage-Regel, siehe v0.4.0 / periodCoverage.ts). Die frueher genutzte
 * Formel `effektiv = pauschal + (gewichtet - neu)` ist daher nicht mehr
 * zulaessig und wurde durch die direkte gewichtete Berechnung ersetzt.
 *
 * Rechtsgrundlage: § 3 Abs. 1 FESchVO — tagesgenaue Erfassung.
 */

/** Tage im Monat (28/29/30/31) */
function tageImMonat(jahr: number, monat: number): number {
  return new Date(jahr, monat, 0).getDate();
}

export interface MonatsDeputatInput {
  monat: number;
  deputatGesamt: number | string | null;
  deputatGes: number | string | null;
  deputatGym: number | string | null;
  deputatBk: number | string | null;
}

export interface AenderungInput {
  monat: number;
  deputatGesamtAlt: number | string | null;
  deputatGesAlt: number | string | null;
  deputatGymAlt: number | string | null;
  deputatBkAlt: number | string | null;
  deputatGesamtNeu: number | string | null;
  deputatGesNeu: number | string | null;
  deputatGymNeu: number | string | null;
  deputatBkNeu: number | string | null;
  /** ISO-Datum (YYYY-MM-DD) oder null */
  tatsaechlichesDatum: string | null;
}

export interface DeputatWerte {
  gesamt: number;
  ges: number;
  gym: number;
  bk: number;
}

export interface KorrekturAnteil {
  /** Tag (1-31) im Monat an dem diese Aenderung wirksam wurde */
  tag: number;
  /** ISO-Datum fuer Anzeige */
  datum: string;
  alt: DeputatWerte;
  neu: DeputatWerte;
  /** Tage vor der Aenderung (Tag 1 bis tag-1) */
  tageVor: number;
  /** Tage ab der Aenderung (tag bis monatsEnde) */
  tageNach: number;
  /** Beitrag der "Alt"-Werte zum effektiven Monatswert (alt / monatsTage * tageVor). Nur bei Einzelaenderung mathematisch exakt — bei Mehrfachaenderungen dient es nur der Anzeige. */
  anteilAlt: DeputatWerte;
  /** Beitrag der "Neu"-Werte zum effektiven Monatswert (neu / monatsTage * tageNach). Wie anteilAlt: bei Mehrfachaenderungen nur Anzeige-Helfer. */
  anteilNeu: DeputatWerte;
}

export interface MonatsDeputatErgebnis {
  monat: number;
  monatsTage: number;
  pauschal: DeputatWerte;
  effektiv: DeputatWerte;
  /** Differenz effektiv - pauschal pro Spalte (informativ — Abweichung der DB-Pauschale zum taggenauen Wert). */
  korrektur: DeputatWerte;
  hatKorrektur: boolean;
  /** Einzelne Aenderungen (meist 1, in seltenen Faellen mehrere pro Monat) */
  aenderungen: KorrekturAnteil[];
}

function n(x: number | string | null | undefined): number {
  if (x === null || x === undefined) return 0;
  const v = typeof x === "string" ? Number(x) : x;
  return Number.isFinite(v) ? v : 0;
}

function tagFromIsoDate(iso: string): number {
  // YYYY-MM-DD -> Tag, robust gegen Zeitzonen
  const [, , dd] = iso.split("-");
  return parseInt(dd, 10);
}

/** Einzelnes Zeitsegment im Monat mit konstantem Deputat. */
interface Segment {
  startTag: number;   // inklusiv
  endeTag: number;    // inklusiv
  werte: DeputatWerte;
}

/**
 * Zerlegt einen Monat in Zeitsegmente entlang der Aenderungs-Tage.
 *
 * - Vor der 1. Aenderung: `alt` der 1. Aenderung
 * - Zwischen Aenderung i und i+1: `neu` der i-ten Aenderung
 * - Nach der letzten Aenderung: `neu` der letzten
 */
function bildeSegmente(
  aenderungen: Array<AenderungInput & { tag: number }>,
  monatsTage: number
): Segment[] {
  if (aenderungen.length === 0) return [];

  const sortiert = [...aenderungen].sort((a, b) => a.tag - b.tag);
  const segmente: Segment[] = [];

  // Segment vor der ersten Aenderung
  const erste = sortiert[0];
  if (erste.tag > 1) {
    segmente.push({
      startTag: 1,
      endeTag: Math.min(monatsTage, erste.tag - 1),
      werte: {
        gesamt: n(erste.deputatGesamtAlt),
        ges: n(erste.deputatGesAlt),
        gym: n(erste.deputatGymAlt),
        bk: n(erste.deputatBkAlt),
      },
    });
  }

  // Segmente zwischen und nach Aenderungen
  for (let i = 0; i < sortiert.length; i++) {
    const a = sortiert[i];
    const naechste = sortiert[i + 1];
    const startTag = Math.max(1, Math.min(monatsTage, a.tag));
    const endeTag = naechste
      ? Math.min(monatsTage, naechste.tag - 1)
      : monatsTage;
    if (endeTag < startTag) continue;
    segmente.push({
      startTag,
      endeTag,
      werte: {
        gesamt: n(a.deputatGesamtNeu),
        ges: n(a.deputatGesNeu),
        gym: n(a.deputatGymNeu),
        bk: n(a.deputatBkNeu),
      },
    });
  }

  return segmente;
}

/** Gewichteter Monatswert aus Segmenten: Σ (wert × tage) / monatsTage */
function effektivAusSegmenten(segmente: Segment[], monatsTage: number): DeputatWerte {
  const sum: DeputatWerte = { gesamt: 0, ges: 0, gym: 0, bk: 0 };
  for (const s of segmente) {
    const tage = s.endeTag - s.startTag + 1;
    const w = tage / monatsTage;
    sum.gesamt += s.werte.gesamt * w;
    sum.ges += s.werte.ges * w;
    sum.gym += s.werte.gym * w;
    sum.bk += s.werte.bk * w;
  }
  return sum;
}

/**
 * Berechnet fuer einen Lehrer pro Monat den effektiven Deputatswert.
 *
 * @param monatsDaten  Pauschale Monatswerte (aus `deputat_monatlich`)
 * @param aenderungen  Zeilen aus `deputat_aenderungen` — nur solche mit
 *                     gesetztem `tatsaechlichesDatum` wirken taggenau.
 * @param jahr         Kalenderjahr (wichtig fuer Monatstage/Schaltjahr)
 */
export function berechneLehrerDeputatEffektiv(
  monatsDaten: MonatsDeputatInput[],
  aenderungen: AenderungInput[],
  jahr: number
): Map<number, MonatsDeputatErgebnis> {
  const result = new Map<number, MonatsDeputatErgebnis>();

  const relevanteAenderungen = aenderungen
    .filter((a) => !!a.tatsaechlichesDatum)
    .map((a) => ({
      ...a,
      tag: tagFromIsoDate(a.tatsaechlichesDatum!),
    }))
    .sort((a, b) => (a.monat - b.monat) || (a.tag - b.tag));

  const aenderungenByMonat = new Map<number, typeof relevanteAenderungen>();
  for (const a of relevanteAenderungen) {
    const arr = aenderungenByMonat.get(a.monat) ?? [];
    arr.push(a);
    aenderungenByMonat.set(a.monat, arr);
  }

  for (const md of monatsDaten) {
    const monatsTage = tageImMonat(jahr, md.monat);
    const pauschal: DeputatWerte = {
      gesamt: n(md.deputatGesamt),
      ges: n(md.deputatGes),
      gym: n(md.deputatGym),
      bk: n(md.deputatBk),
    };

    const monatsAenderungen = aenderungenByMonat.get(md.monat) ?? [];

    if (monatsAenderungen.length === 0) {
      result.set(md.monat, {
        monat: md.monat,
        monatsTage,
        pauschal,
        effektiv: { ...pauschal },
        korrektur: { gesamt: 0, ges: 0, gym: 0, bk: 0 },
        hatKorrektur: false,
        aenderungen: [],
      });
      continue;
    }

    // Segmentierter effektiver Wert (direkt aus Aenderungen, NICHT pauschal+Korrektur)
    const segmente = bildeSegmente(monatsAenderungen, monatsTage);
    const effektiv = effektivAusSegmenten(segmente, monatsTage);

    // Korrektur = nur noch Anzeige: Abweichung DB-Pauschal vs. taggenauem Wert
    const korrektur: DeputatWerte = {
      gesamt: effektiv.gesamt - pauschal.gesamt,
      ges: effektiv.ges - pauschal.ges,
      gym: effektiv.gym - pauschal.gym,
      bk: effektiv.bk - pauschal.bk,
    };

    // Anteile pro Aenderung fuer UI (Tooltip/Herleitung) — bei Einzeländerung
    // exakt, bei Mehrfachaenderung nur eine vereinfachte Einzelansicht.
    const anteile: KorrekturAnteil[] = monatsAenderungen.map((a) => {
      const tageVor = Math.max(0, Math.min(monatsTage, a.tag - 1));
      const tageNach = Math.max(0, monatsTage - tageVor);
      const alt: DeputatWerte = {
        gesamt: n(a.deputatGesamtAlt),
        ges: n(a.deputatGesAlt),
        gym: n(a.deputatGymAlt),
        bk: n(a.deputatBkAlt),
      };
      const neu: DeputatWerte = {
        gesamt: n(a.deputatGesamtNeu),
        ges: n(a.deputatGesNeu),
        gym: n(a.deputatGymNeu),
        bk: n(a.deputatBkNeu),
      };
      return {
        tag: a.tag,
        datum: a.tatsaechlichesDatum!,
        alt,
        neu,
        tageVor,
        tageNach,
        anteilAlt: {
          gesamt: (alt.gesamt / monatsTage) * tageVor,
          ges: (alt.ges / monatsTage) * tageVor,
          gym: (alt.gym / monatsTage) * tageVor,
          bk: (alt.bk / monatsTage) * tageVor,
        },
        anteilNeu: {
          gesamt: (neu.gesamt / monatsTage) * tageNach,
          ges: (neu.ges / monatsTage) * tageNach,
          gym: (neu.gym / monatsTage) * tageNach,
          bk: (neu.bk / monatsTage) * tageNach,
        },
      };
    });

    const hatKorrektur =
      Math.abs(korrektur.gesamt) > 0.001 ||
      Math.abs(korrektur.ges) > 0.001 ||
      Math.abs(korrektur.gym) > 0.001 ||
      Math.abs(korrektur.bk) > 0.001;

    result.set(md.monat, {
      monat: md.monat,
      monatsTage,
      pauschal,
      effektiv,
      korrektur,
      hatKorrektur,
      aenderungen: anteile,
    });
  }

  return result;
}

/** Rundung auf 3 Nachkommastellen (sichere Repraesentation in Decimal-Feldern) */
export function rundeDeputat(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// ============================================================
// ADAPTER FUER PERIODENMODELL (v0.7+)
// ============================================================

/**
 * Eine Zeile aus v_deputat_aenderungen (View ueber das Periodenmodell + Korrektur-Layer).
 *
 * Untis liefert Periodenwechsel immer am Montag (`wirksam_ab`). Wenn der echte
 * Stichtag im Personalbestand abweicht, ueberschreibt der Korrektur-Layer den
 * Wert in `tatsaechliches_datum`. `effektiv_wirksam_ab` ist das Datum, das die
 * tagesgenaue Berechnung tatsaechlich verwendet.
 */
export interface EchterWertwechselInput {
  effektiv_wirksam_ab: string; // ISO YYYY-MM-DD — Untis-Montag oder Korrektur
  gesamt_alt: number | string | null;
  ges_alt: number | string | null;
  gym_alt: number | string | null;
  bk_alt: number | string | null;
  gesamt_neu: number | string | null;
  ges_neu: number | string | null;
  gym_neu: number | string | null;
  bk_neu: number | string | null;
}

/**
 * Konvertiert View-Zeilen (v_deputat_aenderungen) zu AenderungInput[] fuer
 * `berechneLehrerDeputatEffektiv`. Im Periodenmodell ist JEDER Wertwechsel
 * tagesgenau verortet (entweder Untis-Montag oder Sachbearbeiter-Korrektur),
 * daher wird `tatsaechlichesDatum` immer aus `effektiv_wirksam_ab` gesetzt.
 */
export function adaptiereEchteAenderungen(
  echte: EchterWertwechselInput[],
  filterJahr?: number,
): AenderungInput[] {
  const result: AenderungInput[] = [];
  for (const a of echte) {
    if (!a.effektiv_wirksam_ab) continue;
    const [yearStr, monthStr] = a.effektiv_wirksam_ab.split("-");
    const jahr = parseInt(yearStr, 10);
    const monat = parseInt(monthStr, 10);
    if (filterJahr !== undefined && jahr !== filterJahr) continue;
    result.push({
      monat,
      deputatGesamtAlt: a.gesamt_alt,
      deputatGesAlt: a.ges_alt,
      deputatGymAlt: a.gym_alt,
      deputatBkAlt: a.bk_alt,
      deputatGesamtNeu: a.gesamt_neu,
      deputatGesNeu: a.ges_neu,
      deputatGymNeu: a.gym_neu,
      deputatBkNeu: a.bk_neu,
      tatsaechlichesDatum: a.effektiv_wirksam_ab,
    });
  }
  return result;
}
