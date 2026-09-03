/**
 * Periodenmodell — Diff-Logik fuer ausgehende Webhook-Events
 * (hauptdeputat.changed / verteilung.changed).
 *
 * Hintergrund: Untis bildet Deputatsaenderungen fast immer durch das ANLEGEN
 * EINER NEUEN PERIODE ab (nicht durch Aendern einer bestehenden). Der Sync
 * muss deshalb auch fuer neu eingefuegte Perioden-Zeilen erkennen, ob sich
 * der Wert gegenueber der chronologisch vorhergehenden Periode geaendert hat.
 * Gleiche Semantik wie die DB-View v_deputat_aenderungen (LEAD ueber
 * gueltig_von), nur im Sync-Moment und ohne DB-Roundtrip.
 *
 * Alle Funktionen sind pure (kein DB-Zugriff) und per Vitest getestet.
 */

import { GEHALTSRELEVANT_DELTA } from "@/lib/constants";

export type PeriodenWerte = { gesamt: number; ges: number; gym: number; bk: number };

export type PeriodenZeile = {
  lehrerId: number;
  sy: number;
  termId: number;
  /** ISO YYYY-MM-DD */
  gueltigVon: string;
  /** ISO YYYY-MM-DD */
  gueltigBis: string;
  werte: PeriodenWerte;
};

export type WechselTyp = "haupt" | "verteilung";

export type PeriodenWechsel = {
  lehrerId: number;
  sy: number;
  termId: number;
  dateFrom: string;
  dateTo: string;
  vorgaenger: { sy: number; termId: number; dateFrom: string; dateTo: string };
  alt: PeriodenWerte;
  neu: PeriodenWerte;
  type: WechselTyp;
};

/** Standard: Perioden, die laenger als 60 Tage vor "heute" enden, loesen kein Event aus (Backfill-Schutz). */
export const NOTIFY_MAX_ALTER_TAGE = 60;

/**
 * Klassifiziert einen Wertwechsel: "haupt" = Gesamt-Wochenstunden aendern sich
 * (gehaltsrelevant), "verteilung" = nur GES/GYM/BK-Aufteilung, null = kein Wechsel.
 */
export function klassifiziereWechsel(
  alt: PeriodenWerte,
  neu: PeriodenWerte,
  delta: number = GEHALTSRELEVANT_DELTA,
): WechselTyp | null {
  if (Math.abs(alt.gesamt - neu.gesamt) > delta) return "haupt";
  if (
    Math.abs(alt.ges - neu.ges) > delta ||
    Math.abs(alt.gym - neu.gym) > delta ||
    Math.abs(alt.bk - neu.bk) > delta
  ) {
    return "verteilung";
  }
  return null;
}

/** ISO-Datum um n Tage verschieben (UTC-neutral, nur Kalendertage). */
function isoPlusTage(iso: string, tage: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + tage));
  return dt.toISOString().slice(0, 10);
}

/**
 * Ermittelt fuer jede in diesem Sync NEU eingefuegte Perioden-Zeile den
 * chronologischen Vorgaenger (bestehende Zeile ODER frueher im selben Payload
 * eingefuegte Zeile) und liefert die echten Wertwechsel.
 *
 * - Sortierung je Lehrer nach gueltigVon; bei gleichem Datum zuerst die
 *   bestehende Zeile, dann nach termId.
 * - Zeilen ohne Vorgaenger (erste Periode eines Lehrers) erzeugen kein Event.
 * - Zeilen, deren gueltigBis aelter als `maxAlterTage` vor `heute` ist, werden
 *   uebersprungen (historischer Backfill soll keine Mail-Flut ausloesen).
 */
export function berechneNeuePeriodenWechsel(params: {
  bestehend: PeriodenZeile[];
  eingefuegt: PeriodenZeile[];
  /** ISO YYYY-MM-DD */
  heute: string;
  maxAlterTage?: number;
}): PeriodenWechsel[] {
  const maxAlter = params.maxAlterTage ?? NOTIFY_MAX_ALTER_TAGE;
  const grenze = isoPlusTage(params.heute, -maxAlter);

  type Eintrag = PeriodenZeile & { neu: boolean };
  const proLehrer = new Map<number, Eintrag[]>();
  const push = (z: PeriodenZeile, neu: boolean) => {
    const list = proLehrer.get(z.lehrerId) ?? [];
    list.push({ ...z, neu });
    proLehrer.set(z.lehrerId, list);
  };
  for (const z of params.bestehend) push(z, false);
  for (const z of params.eingefuegt) push(z, true);

  const result: PeriodenWechsel[] = [];
  const wechsel = (vorher: Eintrag, aktuell: Eintrag) => {
    if (aktuell.gueltigBis < grenze) return;
    const typ = klassifiziereWechsel(vorher.werte, aktuell.werte);
    if (!typ) return;
    result.push({
      lehrerId: aktuell.lehrerId,
      sy: aktuell.sy,
      termId: aktuell.termId,
      dateFrom: aktuell.gueltigVon,
      dateTo: aktuell.gueltigBis,
      vorgaenger: {
        sy: vorher.sy,
        termId: vorher.termId,
        dateFrom: vorher.gueltigVon,
        dateTo: vorher.gueltigBis,
      },
      alt: { ...vorher.werte },
      neu: { ...aktuell.werte },
      type: typ,
    });
  };

  for (const list of proLehrer.values()) {
    list.sort((a, b) => {
      if (a.gueltigVon !== b.gueltigVon) return a.gueltigVon < b.gueltigVon ? -1 : 1;
      if (a.neu !== b.neu) return a.neu ? 1 : -1; // bestehend vor neu
      if (a.sy !== b.sy) return a.sy - b.sy;
      return a.termId - b.termId;
    });
    for (let i = 1; i < list.length; i++) {
      const aktuell = list[i];
      const vorher = list[i - 1];
      // Uebergang in eine NEUE Periode hinein
      if (aktuell.neu) wechsel(vorher, aktuell);
      // Uebergang aus einer NEUEN Periode in einen BESTEHENDEN Nachfolger:
      // eine rueckwirkend eingeschobene Periode (z.B. "12b" zwischen 12 und 13)
      // aendert auch den Wechsel am Anfang von 13 — sonst bliebe er stumm.
      else if (vorher.neu) wechsel(vorher, aktuell);
    }
  }
  return result;
}

/** Liefert alle (jahr, monat)-Buckets, die ein [dateFrom, dateTo]-Intervall beruehrt. */
export function monthsInRange(
  dateFromIso: string,
  dateToIso: string,
): Array<{ jahr: number; monat: number }> {
  const yF = Number(dateFromIso.slice(0, 4));
  const mF = Number(dateFromIso.slice(5, 7));
  const yT = Number(dateToIso.slice(0, 4));
  const mT = Number(dateToIso.slice(5, 7));
  const out: Array<{ jahr: number; monat: number }> = [];
  let y = yF;
  let m = mF;
  while (y < yT || (y === yT && m <= mT)) {
    out.push({ jahr: y, monat: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Wirksamkeitsmonat einer Periode = Monat ihres Starts. */
export function wirksamMonat(dateFromIso: string): { jahr: number; monat: number } {
  return { jahr: Number(dateFromIso.slice(0, 4)), monat: Number(dateFromIso.slice(5, 7)) };
}

export type BucketPeriode = {
  sy: number;
  termId: number;
  dateFrom: string;
  dateTo: string;
  alt: PeriodenWerte;
  neu: PeriodenWerte;
};

export type MonthBucket = {
  lehrerId: number;
  teacherId: number;
  vollname: string;
  jahr: number;
  monat: number;
  type: WechselTyp;
  perioden: BucketPeriode[];
};

export type BucketInput = BucketPeriode & {
  lehrerId: number;
  teacherId: number;
  vollname: string;
  type: WechselTyp;
  /** Monate, denen dieser Wechsel zugeordnet wird. */
  monate: Array<{ jahr: number; monat: number }>;
};

/**
 * Aggregiert Wechsel auf (lehrer x jahr x monat). Pro Bucket maximal ein
 * Event; enthaelt ein Monat mindestens einen Hauptwert-Wechsel, gilt der
 * Bucket als "haupt" (gehaltsrelevant uebersteuert reine Verteilung).
 */
export function baueMonatsBuckets(inputs: BucketInput[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const ch of inputs) {
    for (const { jahr, monat } of ch.monate) {
      const key = `${ch.lehrerId}_${jahr}_${monat}`;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          lehrerId: ch.lehrerId,
          teacherId: ch.teacherId,
          vollname: ch.vollname,
          jahr,
          monat,
          type: ch.type,
          perioden: [],
        };
        map.set(key, bucket);
      } else if (ch.type === "haupt" && bucket.type === "verteilung") {
        bucket.type = "haupt";
      }
      bucket.perioden.push({
        sy: ch.sy,
        termId: ch.termId,
        dateFrom: ch.dateFrom,
        dateTo: ch.dateTo,
        alt: ch.alt,
        neu: ch.neu,
      });
    }
  }
  return [...map.values()];
}
