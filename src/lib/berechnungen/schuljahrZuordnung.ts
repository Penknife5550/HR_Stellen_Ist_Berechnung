/**
 * Zuordnung Stichtag -> Schuljahr fuer die Stellensoll-Berechnung.
 *
 * Hintergrund (§ 3 FESchVO): Jan-Jul eines Haushaltsjahres liegt im Schuljahr
 * (HJ-1)/HJ und rechnet mit der Schuelerzahl vom 15.10. des Vorjahres; Aug-Dez
 * liegt im Schuljahr HJ/(HJ+1) und rechnet mit dem 15.10. des laufenden Jahres.
 * Der Stichtag liegt also immer im Schuljahr des Zeitraums — deshalb bestimmt
 * der Stichtag das Schuljahr und damit den SLR-Satz (§ 8 VO zu § 93 Abs. 2
 * SchulG, jaehrlich anpassbar). Das "aktiv"-Flag spielt hier keine Rolle.
 */

export interface SchuljahrRef {
  id: number;
  bezeichnung: string;
  startDatum: string; // ISO YYYY-MM-DD
  endDatum: string;   // ISO YYYY-MM-DD
}

/**
 * Liefert das Schuljahr, dessen Zeitraum den Stichtag einschliesst (Grenzen
 * inklusive). Ueberlappen sich Schuljahre, gewinnt das spaeter beginnende.
 * ISO-Daten lassen sich als Strings vergleichen.
 */
export function findeSchuljahrFuerStichtag<T extends SchuljahrRef>(
  schuljahre: T[],
  stichtag: string
): T | null {
  let treffer: T | null = null;
  for (const sj of schuljahre) {
    if (sj.startDatum <= stichtag && stichtag <= sj.endDatum) {
      if (!treffer || sj.startDatum > treffer.startDatum) treffer = sj;
    }
  }
  return treffer;
}

/**
 * Schulform-Typ ist auf beiden Seiten des Lookups Freitext (schul_stufen und
 * slr_werte). Fuehrende/abschliessende Leerzeichen duerfen keinen
 * "Fehlende SLR-Werte"-Fehler ausloesen.
 */
export function normalisiereSchulformTyp(typ: string): string {
  return typ.trim();
}

/**
 * Baut den Lookup schulformTyp -> Relation. Werte <= 0 werden nicht
 * uebernommen, damit sie in der Berechnung als "fehlend" erkannt werden.
 */
export function baueSlrLookup(
  slrWerte: Array<{ schulformTyp: string; relation: string | number }>
): Record<string, number> {
  const lookup: Record<string, number> = {};
  for (const slr of slrWerte) {
    const relation = Number(slr.relation);
    if (relation > 0) lookup[normalisiereSchulformTyp(slr.schulformTyp)] = relation;
  }
  return lookup;
}

/** Schulform-Typen der Schulstufen: normalisiert, ohne Leere, dedupliziert, sortiert (de). */
function sammleSchulformTypen(schulStufen: Array<{ schulformTyp: string }>): string[] {
  const typen = new Set<string>();
  for (const st of schulStufen) {
    const typ = normalisiereSchulformTyp(st.schulformTyp);
    if (typ) typen.add(typ);
  }
  return [...typen].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Schulform-Typen, die die Berechnung sicher als SLR-Lookup-Schluessel braucht:
 * nur aktive Schulstufen (aktiv !== false). Der Aufrufer uebergibt nur Stufen
 * aktiver Schulen (getBenoetigteSchulStufen). Quelle fuer den Luecken-Hinweis
 * und die Vorjahres-Uebernahme in der SLR-Konfiguration.
 */
export function ermittleBenoetigteSchulformTypen(
  schulStufen: Array<{ schulformTyp: string; aktiv?: boolean }>
): string[] {
  return sammleSchulformTypen(schulStufen.filter((st) => st.aktiv !== false));
}

/**
 * Schulform-Typen ALLER uebergebenen Schulstufen — auch inaktive und die inaktiver
 * Schulen. Quelle fuer die Typ-Auswahl und die Server-Validierung beim Anlegen:
 * eine deaktivierte Stufe kann am Stichtag noch Schuelerzahlen haben und braucht
 * dann trotzdem einen SLR-Wert.
 */
export function ermittleZulaessigeSchulformTypen(
  schulStufen: Array<{ schulformTyp: string }>
): string[] {
  return sammleSchulformTypen(schulStufen);
}

/**
 * Benoetigte Typen, fuer die kein SLR-Wert > 0 vorliegt — genau die Typen, an
 * denen die Stellensoll-Berechnung mit "Fehlende SLR-Werte" scheitern wuerde.
 */
export function ermittleFehlendeSlrTypen(
  benoetigteTypen: string[],
  slrWerte: Array<{ schulformTyp: string; relation: string | number }>
): string[] {
  const lookup = baueSlrLookup(slrWerte);
  return benoetigteTypen.filter((typ) => lookup[normalisiereSchulformTyp(typ)] === undefined);
}

/**
 * SLR-Typen, die zu keiner der uebergebenen Schulstufen-Typen gehoeren (z.B.
 * Tippfehler wie "Gesamtschule SEK I"). Die Berechnung findet sie nie.
 */
export function ermittleVerwaisteSlrTypen(
  zulaessigeTypen: string[],
  slrWerte: Array<{ schulformTyp: string }>
): string[] {
  const zulaessig = new Set(zulaessigeTypen.map(normalisiereSchulformTyp));
  const verwaist = new Set<string>();
  for (const slr of slrWerte) {
    const typ = normalisiereSchulformTyp(slr.schulformTyp);
    if (!zulaessig.has(typ)) verwaist.add(typ);
  }
  return [...verwaist];
}

/**
 * Zuletzt begonnenes Schuljahr vor dem gegebenen Startdatum — dieselbe Logik
 * wie getVorgaengerSchuljahr in queries.ts, nur ohne DB.
 */
export function findeVorgaengerSchuljahr<T extends SchuljahrRef>(
  schuljahre: T[],
  startDatum: string
): T | null {
  let treffer: T | null = null;
  for (const sj of schuljahre) {
    if (sj.startDatum < startDatum && (!treffer || sj.startDatum > treffer.startDatum)) treffer = sj;
  }
  return treffer;
}

/**
 * Vorlagen (SLR-Werte des Vorgaengers), die ins Ziel-Schuljahr uebernommen
 * werden duerfen: Typ wird von einer aktiven Schulstufe benoetigt UND fehlt im
 * Ziel (normalisiert). Vorhandene Werte werden nie ueberschrieben. Faellt eine
 * zweite Vorlage auf denselben normalisierten Typ, gewinnt die erste. Vorlagen
 * mit Relation <= 0 werden nicht kopiert — sie waeren im Ziel sofort wieder
 * "fehlend" (baueSlrLookup), der Typ aber belegt.
 */
export function filterUebernehmbareSlrWerte<T extends { schulformTyp: string; relation: string | number }>(
  vorlagen: T[],
  vorhandene: Array<{ schulformTyp: string }>,
  benoetigteTypen: string[]
): T[] {
  const benoetigt = new Set(benoetigteTypen.map(normalisiereSchulformTyp));
  const vorhanden = new Set(vorhandene.map((v) => normalisiereSchulformTyp(v.schulformTyp)));
  const gesehen = new Set<string>();
  return vorlagen.filter((v) => {
    const typ = normalisiereSchulformTyp(v.schulformTyp);
    if (!(Number(v.relation) > 0)) return false;
    if (!benoetigt.has(typ) || vorhanden.has(typ) || gesehen.has(typ)) return false;
    gesehen.add(typ);
    return true;
  });
}

/**
 * Quelle-Vermerk fuer uebernommene SLR-Werte. Der Pruef-Vermerk steht vorn und
 * ueberlebt die Kuerzung; die Originalquelle wird auf die Spaltenlaenge (200) gekuerzt.
 */
export function baueUebernahmeQuelle(vonBezeichnung: string, originalQuelle: string | null): string {
  const zusatz = `uebernommen aus ${vonBezeichnung} — pruefen`;
  const restLaenge = 200 - zusatz.length - 3;
  // Traegt die Originalquelle selbst schon einen Uebernahme-Vermerk (Wert wurde im Vorjahr
  // uebernommen), faellt er weg — sonst waechst die Quelle mit jedem Schuljahreswechsel
  // um ein weiteres "uebernommen aus … | ".
  const kern = originalQuelle?.replace(UEBERNAHME_VERMERK_PREFIX, "").trim() || null;
  return kern ? `${zusatz} | ${kern.slice(0, restLaenge)}` : zusatz;
}

/** Ein oder mehrere fuehrende "uebernommen aus … — pruefen | "-Vermerke, auch ohne folgenden Trenner. */
const UEBERNAHME_VERMERK_PREFIX = /^(?:uebernommen aus .+? — pruefen(?:\s*\|\s*|$))+/;

/**
 * Relation fuer das Eingabefeld: zwei Nachkommastellen, Komma als Dezimaltrenner.
 * Bewusst ohne toLocaleString — das Ergebnis muss auf Server und Client identisch sein.
 */
export function formatiereRelationDE(relation: string | number): string {
  return Number(relation).toFixed(2).replace(".", ",");
}

export type SlrVorschlag = {
  relation: string;
  quelle: string;
  herkunft: "vorjahr" | "standard" | null;
};

/**
 * Vorbelegung fuer "Schueler je Stelle" + Quelle beim Anlegen eines SLR-Werts:
 * 1. Wert des Vorgaenger-Schuljahres fuer den Typ (normalisiert, Relation > 0),
 *    Quelle mit demselben Uebernahme-Vermerk wie die Server-Uebernahme;
 * 2. sonst der Standardwert (SLR_DEFAULTS_2025_2026) mit dessen Quelle;
 * 3. sonst leer. Die Felder bleiben im Formular frei editierbar.
 */
export function ermittleSlrVorschlag(
  typ: string,
  vorgaenger: {
    bezeichnung: string;
    werte: Array<{ schulformTyp: string; relation: string | number; quelle: string | null }>;
  } | null,
  defaults: Record<string, number>,
  defaultsQuelle: string
): SlrVorschlag {
  const key = normalisiereSchulformTyp(typ);

  const vorjahr = vorgaenger?.werte.find(
    (w) => normalisiereSchulformTyp(w.schulformTyp) === key && Number(w.relation) > 0
  );
  if (vorgaenger && vorjahr) {
    return {
      relation: formatiereRelationDE(vorjahr.relation),
      quelle: baueUebernahmeQuelle(vorgaenger.bezeichnung, vorjahr.quelle),
      herkunft: "vorjahr",
    };
  }

  const standardKey = Object.keys(defaults).find((k) => normalisiereSchulformTyp(k) === key);
  if (standardKey !== undefined && defaults[standardKey] > 0) {
    return {
      relation: formatiereRelationDE(defaults[standardKey]),
      quelle: defaultsQuelle,
      herkunft: "standard",
    };
  }

  return { relation: "", quelle: "", herkunft: null };
}

/**
 * Schulform-Typen, die nach Normalisierung auf denselben Schluessel fallen, aber
 * verschiedene Relationen tragen (z.B. "Gymnasium Sek II" und "Gymnasium Sek II ").
 * Die Berechnung meldet das als Fehler, statt still einen der Werte zu waehlen.
 */
export function findeSlrKonflikte(
  slrWerte: Array<{ schulformTyp: string; relation: string | number }>
): string[] {
  const gesehen = new Map<string, number>();
  const konflikte = new Set<string>();
  for (const slr of slrWerte) {
    const key = normalisiereSchulformTyp(slr.schulformTyp);
    const relation = Number(slr.relation);
    const vorher = gesehen.get(key);
    if (vorher !== undefined && vorher !== relation) konflikte.add(key);
    gesehen.set(key, relation);
  }
  return [...konflikte];
}
