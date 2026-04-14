/**
 * Taggenaue Deputatsberechnung pro Lehrer.
 *
 * Wenn HR fuer eine `deputat_aenderungen`-Zeile ein `tatsaechlichesDatum`
 * eintraegt, wird das Monatsdeputat tagesgewichtet:
 *
 *   effektiv = (alt / monatsTage * tageVor) + (neu / monatsTage * tageNach)
 *
 * Beispiel Oskar Dyck, Feb 2026 (28 Tage), Aenderung am 09.02. von 23,5 -> 25,5:
 *   (23,5 / 28 * 8) + (25,5 / 28 * 20) = 6,71 + 18,21 = 24,93
 *
 * Diese Funktion liefert pro Monat den pauschalen DB-Wert, den effektiven
 * Wert und eine vollstaendige Herleitung fuer die UI.
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
  /** Beitrag der "Alt"-Werte zum effektiven Monatswert (alt / monatsTage * tageVor) */
  anteilAlt: DeputatWerte;
  /** Beitrag der "Neu"-Werte zum effektiven Monatswert (neu / monatsTage * tageNach) */
  anteilNeu: DeputatWerte;
}

export interface MonatsDeputatErgebnis {
  monat: number;
  monatsTage: number;
  pauschal: DeputatWerte;
  effektiv: DeputatWerte;
  /** Differenz effektiv - pauschal pro Spalte (negativ wenn effektiv kleiner) */
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

  // Aenderungen mit tatsaechlichemDatum nach Monat+Tag sortieren
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

    // Pro Aenderung: Korrektur berechnen (gewichtet - pauschaler neu-Wert)
    // Bei mehreren Aenderungen im selben Monat werden Korrekturen summiert.
    // Das ist mathematisch korrekt solange Aenderungen nicht-ueberlappend sind
    // (d.h. jeweils eine klare "neu ab Tag X" Semantik haben).
    let korrGesamt = 0, korrGes = 0, korrGym = 0, korrBk = 0;
    const anteile: KorrekturAnteil[] = [];

    for (const a of monatsAenderungen) {
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

      const anteilAlt: DeputatWerte = {
        gesamt: (alt.gesamt / monatsTage) * tageVor,
        ges: (alt.ges / monatsTage) * tageVor,
        gym: (alt.gym / monatsTage) * tageVor,
        bk: (alt.bk / monatsTage) * tageVor,
      };
      const anteilNeu: DeputatWerte = {
        gesamt: (neu.gesamt / monatsTage) * tageNach,
        ges: (neu.ges / monatsTage) * tageNach,
        gym: (neu.gym / monatsTage) * tageNach,
        bk: (neu.bk / monatsTage) * tageNach,
      };

      // Gewichteter Gesamt-Monatswert fuer diese Aenderung
      const gewGesamt = anteilAlt.gesamt + anteilNeu.gesamt;
      const gewGes = anteilAlt.ges + anteilNeu.ges;
      const gewGym = anteilAlt.gym + anteilNeu.gym;
      const gewBk = anteilAlt.bk + anteilNeu.bk;

      // Korrektur = gewichteterWert - pauschal(neu)  (pauschal in DB = letzter neu-Wert)
      korrGesamt += gewGesamt - neu.gesamt;
      korrGes += gewGes - neu.ges;
      korrGym += gewGym - neu.gym;
      korrBk += gewBk - neu.bk;

      anteile.push({
        tag: a.tag,
        datum: a.tatsaechlichesDatum!,
        alt, neu,
        tageVor, tageNach,
        anteilAlt, anteilNeu,
      });
    }

    const korrektur: DeputatWerte = {
      gesamt: korrGesamt, ges: korrGes, gym: korrGym, bk: korrBk,
    };
    const effektiv: DeputatWerte = {
      gesamt: pauschal.gesamt + korrGesamt,
      ges: pauschal.ges + korrGes,
      gym: pauschal.gym + korrGym,
      bk: pauschal.bk + korrBk,
    };
    const hatKorrektur =
      Math.abs(korrGesamt) > 0.001 ||
      Math.abs(korrGes) > 0.001 ||
      Math.abs(korrGym) > 0.001 ||
      Math.abs(korrBk) > 0.001;

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
