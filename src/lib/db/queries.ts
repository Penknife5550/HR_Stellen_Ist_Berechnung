/**
 * Zentrale Datenzugriffs-Schicht.
 * Alle DB-Queries an einem Ort, klar getrennt nach Entitaet.
 */

import { db } from "@/db";
import {
  schulen,
  schulStufen,
  schuljahre,
  haushaltsjahre,
  schuelerzahlen,
  slrWerte,
  slrHistorie,
  zuschlagArten,
  zuschlaege,
  lehrer,
  deputatMonatlich,
  deputatAenderungen,
  mehrarbeit,
  deputatSyncLog,
  berechnungStellensoll,
  berechnungStellenist,
  berechnungVergleich,
  benutzer,
  regeldeputate,
  stellenartTypen,
  stellenanteile,
} from "@/db/schema";
import { eq, and, desc, asc, sql, inArray, gte, lte } from "drizzle-orm";

// ============================================================
// SCHULEN
// ============================================================

export async function getSchulen() {
  return db.select().from(schulen).where(eq(schulen.aktiv, true)).orderBy(asc(schulen.kurzname));
}

export async function getSchuleById(id: number) {
  const [result] = await db.select().from(schulen).where(eq(schulen.id, id));
  return result ?? null;
}

export async function getSchuleByKurzname(kurzname: string) {
  const [result] = await db.select().from(schulen).where(eq(schulen.kurzname, kurzname));
  return result ?? null;
}

export async function getAlleSchulen() {
  return db.select().from(schulen).orderBy(asc(schulen.kurzname));
}

export async function getSchuleBySchulnummer(schulnummer: string) {
  const [result] = await db.select().from(schulen).where(eq(schulen.schulnummer, schulnummer));
  return result ?? null;
}

export async function createSchule(data: {
  schulnummer: string;
  name: string;
  kurzname: string;
  schulform: string;
  farbe?: string;
  untisCode?: string;
  adresse?: string;
  plz?: string;
  ort?: string;
  istImAufbau?: boolean;
}) {
  const [result] = await db
    .insert(schulen)
    .values(data)
    .returning();
  return result;
}

export async function updateSchule(
  id: number,
  data: {
    schulnummer?: string;
    name?: string;
    kurzname?: string;
    schulform?: string;
    farbe?: string;
    untisCode?: string | null;
    adresse?: string | null;
    plz?: string | null;
    ort?: string | null;
    istImAufbau?: boolean;
  }
) {
  const [result] = await db
    .update(schulen)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(schulen.id, id))
    .returning();
  return result;
}

export async function toggleSchuleAktiv(id: number, aktiv: boolean) {
  const [result] = await db
    .update(schulen)
    .set({ aktiv, updatedAt: sql`now()` })
    .where(eq(schulen.id, id))
    .returning();
  return result;
}

// ============================================================
// REGELDEPUTATE
// ============================================================

/** Nur Regeldeputate fuer Schulen die in Einstellungen angelegt sind */
export async function getAlleRegeldeputate() {
  return db
    .select({
      id: regeldeputate.id,
      schulformCode: regeldeputate.schulformCode,
      schulformName: regeldeputate.schulformName,
      regeldeputat: regeldeputate.regeldeputat,
      rechtsgrundlage: regeldeputate.rechtsgrundlage,
      bassFundstelle: regeldeputate.bassFundstelle,
      gueltigAb: regeldeputate.gueltigAb,
      bemerkung: regeldeputate.bemerkung,
      aktiv: regeldeputate.aktiv,
      createdAt: regeldeputate.createdAt,
      updatedAt: regeldeputate.updatedAt,
    })
    .from(regeldeputate)
    .innerJoin(schulen, eq(regeldeputate.schulformCode, schulen.kurzname))
    .where(and(eq(regeldeputate.aktiv, true), eq(schulen.aktiv, true)))
    .orderBy(asc(regeldeputate.schulformCode));
}

/** Map: schulformCode -> regeldeputat (z.B. "GES" -> 25.5) */
export async function getRegeldeputateMap(): Promise<Map<string, number>> {
  const rows = await getAlleRegeldeputate();
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.schulformCode, Number(row.regeldeputat));
  }
  return map;
}

export async function updateRegeldeputat(
  id: number,
  data: {
    regeldeputat?: string;
    rechtsgrundlage?: string | null;
    bassFundstelle?: string | null;
    gueltigAb?: string | null;
    bemerkung?: string | null;
  }
) {
  const [result] = await db
    .update(regeldeputate)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(regeldeputate.id, id))
    .returning();
  return result;
}

export async function createRegeldeputat(data: {
  schulformCode: string;
  schulformName: string;
  regeldeputat: string;
  rechtsgrundlage?: string | null;
  bassFundstelle?: string | null;
  gueltigAb?: string | null;
  bemerkung?: string | null;
}) {
  const [result] = await db
    .insert(regeldeputate)
    .values(data)
    .returning();
  return result;
}

// ============================================================
// SCHUL-STUFEN
// ============================================================

export async function getSchulStufenBySchule(schuleId: number) {
  return db
    .select()
    .from(schulStufen)
    .where(and(eq(schulStufen.schuleId, schuleId), eq(schulStufen.aktiv, true)))
    .orderBy(asc(schulStufen.stufe));
}

export async function getAllSchulStufen() {
  return db
    .select({
      id: schulStufen.id,
      schuleId: schulStufen.schuleId,
      stufe: schulStufen.stufe,
      schulformTyp: schulStufen.schulformTyp,
      aktiv: schulStufen.aktiv,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(schulStufen)
    .innerJoin(schulen, eq(schulStufen.schuleId, schulen.id))
    .where(eq(schulStufen.aktiv, true))
    .orderBy(asc(schulen.kurzname), asc(schulStufen.stufe));
}

export async function getAlleSchulStufenAdmin() {
  return db
    .select({
      id: schulStufen.id,
      schuleId: schulStufen.schuleId,
      stufe: schulStufen.stufe,
      schulformTyp: schulStufen.schulformTyp,
      aktiv: schulStufen.aktiv,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(schulStufen)
    .innerJoin(schulen, eq(schulStufen.schuleId, schulen.id))
    .orderBy(asc(schulen.kurzname), asc(schulStufen.stufe));
}

export async function getSchulStufeBySchuleUndStufe(schuleId: number, stufe: string) {
  const [result] = await db
    .select()
    .from(schulStufen)
    .where(and(eq(schulStufen.schuleId, schuleId), eq(schulStufen.stufe, stufe)));
  return result ?? null;
}

export async function createSchulStufe(data: {
  schuleId: number;
  stufe: string;
  schulformTyp: string;
}) {
  const [result] = await db
    .insert(schulStufen)
    .values(data)
    .returning();
  return result;
}

export async function updateSchulStufe(
  id: number,
  data: { stufe?: string; schulformTyp?: string }
) {
  const [result] = await db
    .update(schulStufen)
    .set(data)
    .where(eq(schulStufen.id, id))
    .returning();
  return result;
}

export async function toggleSchulStufeAktiv(id: number, aktiv: boolean) {
  const [result] = await db
    .update(schulStufen)
    .set({ aktiv })
    .where(eq(schulStufen.id, id))
    .returning();
  return result;
}

export async function getSchulStufeById(id: number) {
  const [result] = await db
    .select()
    .from(schulStufen)
    .where(eq(schulStufen.id, id));
  return result ?? null;
}

/** Alle aktiven Schulstufen auf einmal laden (Batch statt N+1) */
export async function getAlleAktivenSchulStufen() {
  return db
    .select()
    .from(schulStufen)
    .where(eq(schulStufen.aktiv, true))
    .orderBy(asc(schulStufen.schuleId), asc(schulStufen.stufe));
}

// ============================================================
// SCHULJAHRE
// ============================================================

export async function getSchuljahre() {
  return db.select().from(schuljahre).orderBy(desc(schuljahre.bezeichnung));
}

export async function getAktuellesSchuljahr() {
  const [result] = await db
    .select()
    .from(schuljahre)
    .where(eq(schuljahre.aktiv, true))
    .orderBy(desc(schuljahre.bezeichnung))
    .limit(1);
  return result ?? null;
}

export async function createSchuljahr(data: {
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
}) {
  const [result] = await db
    .insert(schuljahre)
    .values(data)
    .returning();
  return result;
}

export async function updateSchuljahrAktiv(id: number, aktiv: boolean) {
  // Wenn aktiv=true gesetzt wird → alle anderen auf false setzen (nur ein aktives SJ)
  if (aktiv) {
    await db.update(schuljahre).set({ aktiv: false });
  }
  const [result] = await db
    .update(schuljahre)
    .set({ aktiv })
    .where(eq(schuljahre.id, id))
    .returning();
  return result;
}

// ============================================================
// HAUSHALTSJAHRE
// ============================================================

export async function getHaushaltsjahre() {
  return db.select().from(haushaltsjahre).orderBy(desc(haushaltsjahre.jahr));
}

export async function getHaushaltsjahrByJahr(jahr: number) {
  const [result] = await db.select().from(haushaltsjahre).where(eq(haushaltsjahre.jahr, jahr));
  return result ?? null;
}

export async function getAktuellesHaushaltsjahr() {
  const currentYear = new Date().getFullYear();
  return getHaushaltsjahrByJahr(currentYear);
}

/** Alle Haushaltsjahre, absteigend sortiert (neuestes zuerst) */
export async function getAlleHaushaltsjahre() {
  return db
    .select()
    .from(haushaltsjahre)
    .orderBy(desc(haushaltsjahre.jahr));
}

export async function createHaushaltsjahr(data: {
  jahr: number;
  stichtagVorjahr: string;
  stichtagLaufend: string;
}) {
  const [result] = await db
    .insert(haushaltsjahre)
    .values(data)
    .returning();
  return result;
}

export async function updateHaushaltsjahrGesperrt(id: number, gesperrt: boolean) {
  const [result] = await db
    .update(haushaltsjahre)
    .set({ gesperrt })
    .where(eq(haushaltsjahre.id, id))
    .returning();
  return result;
}

// ============================================================
// SCHUELERZAHLEN
// ============================================================

export async function getSchuelerzahlenBySchule(schuleId: number) {
  return db
    .select({
      id: schuelerzahlen.id,
      schuleId: schuelerzahlen.schuleId,
      schulStufeId: schuelerzahlen.schulStufeId,
      stichtag: schuelerzahlen.stichtag,
      anzahl: schuelerzahlen.anzahl,
      bemerkung: schuelerzahlen.bemerkung,
      erfasstVon: schuelerzahlen.erfasstVon,
      createdAt: schuelerzahlen.createdAt,
      stufe: schulStufen.stufe,
      schulformTyp: schulStufen.schulformTyp,
    })
    .from(schuelerzahlen)
    .innerJoin(schulStufen, eq(schuelerzahlen.schulStufeId, schulStufen.id))
    .where(eq(schuelerzahlen.schuleId, schuleId))
    .orderBy(desc(schuelerzahlen.stichtag), asc(schulStufen.stufe));
}

export async function getSchuelerzahlenByStichtag(schuleId: number, stichtag: string) {
  return db
    .select({
      id: schuelerzahlen.id,
      schulStufeId: schuelerzahlen.schulStufeId,
      stichtag: schuelerzahlen.stichtag,
      anzahl: schuelerzahlen.anzahl,
      stufe: schulStufen.stufe,
      schulformTyp: schulStufen.schulformTyp,
    })
    .from(schuelerzahlen)
    .innerJoin(schulStufen, eq(schuelerzahlen.schulStufeId, schulStufen.id))
    .where(and(eq(schuelerzahlen.schuleId, schuleId), eq(schuelerzahlen.stichtag, stichtag)))
    .orderBy(asc(schulStufen.stufe));
}

/** Alle Schuelerzahlen fuer mehrere Stichtage auf einmal laden (Batch statt N+1) */
export async function getAlleSchuelerzahlenByStichtage(stichtage: string[]) {
  if (stichtage.length === 0) return [];
  return db
    .select({
      id: schuelerzahlen.id,
      schuleId: schuelerzahlen.schuleId,
      schulStufeId: schuelerzahlen.schulStufeId,
      stichtag: schuelerzahlen.stichtag,
      anzahl: schuelerzahlen.anzahl,
      stufe: schulStufen.stufe,
      schulformTyp: schulStufen.schulformTyp,
    })
    .from(schuelerzahlen)
    .innerJoin(schulStufen, eq(schuelerzahlen.schulStufeId, schulStufen.id))
    .where(inArray(schuelerzahlen.stichtag, stichtage))
    .orderBy(asc(schuelerzahlen.schuleId), asc(schulStufen.stufe));
}

export async function upsertSchuelerzahl(data: {
  schuleId: number;
  schulStufeId: number;
  stichtag: string;
  anzahl: number;
  bemerkung?: string;
  erfasstVon?: string;
}) {
  const [result] = await db
    .insert(schuelerzahlen)
    .values(data)
    .onConflictDoUpdate({
      target: [schuelerzahlen.schuleId, schuelerzahlen.schulStufeId, schuelerzahlen.stichtag],
      set: {
        anzahl: sql`excluded.anzahl`,
        bemerkung: sql`excluded.bemerkung`,
        erfasstVon: sql`excluded.erfasst_von`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return result;
}

export async function deleteSchuelerzahl(id: number) {
  await db.delete(schuelerzahlen).where(eq(schuelerzahlen.id, id));
}

// ============================================================
// SLR-WERTE
// ============================================================

export async function getSlrWerteBySchuljahr(schuljahrId: number) {
  return db
    .select({
      id: slrWerte.id,
      schuljahrId: slrWerte.schuljahrId,
      schulformTyp: slrWerte.schulformTyp,
      relation: slrWerte.relation,
      quelle: slrWerte.quelle,
    })
    .from(slrWerte)
    .where(eq(slrWerte.schuljahrId, schuljahrId))
    .orderBy(asc(slrWerte.schulformTyp));
}

export async function getSlrWert(schuljahrId: number, schulformTyp: string) {
  const [result] = await db
    .select()
    .from(slrWerte)
    .where(and(eq(slrWerte.schuljahrId, schuljahrId), eq(slrWerte.schulformTyp, schulformTyp)));
  return result ?? null;
}

export async function upsertSlrWert(data: {
  schuljahrId: number;
  schulformTyp: string;
  relation: string;
  quelle?: string;
}) {
  const [result] = await db
    .insert(slrWerte)
    .values(data)
    .onConflictDoUpdate({
      target: [slrWerte.schuljahrId, slrWerte.schulformTyp],
      set: {
        relation: sql`excluded.relation`,
        quelle: sql`excluded.quelle`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return result;
}

export async function getSlrHistorieBySchuljahr(schuljahrId: number) {
  return db
    .select()
    .from(slrHistorie)
    .where(eq(slrHistorie.schuljahrId, schuljahrId))
    .orderBy(desc(slrHistorie.geaendertAm));
}

// ============================================================
// ZUSCHLAEGE
// ============================================================

export async function getZuschlagArten() {
  return db.select().from(zuschlagArten).orderBy(asc(zuschlagArten.sortierung));
}

export async function getZuschlaegeBySchuleUndHaushaltsjahr(
  schuleId: number,
  haushaltsjahrId: number
) {
  return db
    .select({
      id: zuschlaege.id,
      schuleId: zuschlaege.schuleId,
      haushaltsjahrId: zuschlaege.haushaltsjahrId,
      zuschlagArtId: zuschlaege.zuschlagArtId,
      wert: zuschlaege.wert,
      zeitraum: zuschlaege.zeitraum,
      bemerkung: zuschlaege.bemerkung,
      bezeichnung: zuschlagArten.bezeichnung,
      istStandard: zuschlagArten.istStandard,
      sortierung: zuschlagArten.sortierung,
    })
    .from(zuschlaege)
    .innerJoin(zuschlagArten, eq(zuschlaege.zuschlagArtId, zuschlagArten.id))
    .where(
      and(eq(zuschlaege.schuleId, schuleId), eq(zuschlaege.haushaltsjahrId, haushaltsjahrId))
    )
    .orderBy(asc(zuschlagArten.sortierung));
}

/** Alle Zuschlaege fuer ein Haushaltsjahr auf einmal laden (Batch statt N+1) */
export async function getAlleZuschlaegeByHaushaltsjahr(haushaltsjahrId: number) {
  return db
    .select({
      id: zuschlaege.id,
      schuleId: zuschlaege.schuleId,
      haushaltsjahrId: zuschlaege.haushaltsjahrId,
      zuschlagArtId: zuschlaege.zuschlagArtId,
      wert: zuschlaege.wert,
      zeitraum: zuschlaege.zeitraum,
      bemerkung: zuschlaege.bemerkung,
      bezeichnung: zuschlagArten.bezeichnung,
      istStandard: zuschlagArten.istStandard,
      sortierung: zuschlagArten.sortierung,
    })
    .from(zuschlaege)
    .innerJoin(zuschlagArten, eq(zuschlaege.zuschlagArtId, zuschlagArten.id))
    .where(eq(zuschlaege.haushaltsjahrId, haushaltsjahrId))
    .orderBy(asc(zuschlaege.schuleId), asc(zuschlagArten.sortierung));
}

export async function upsertZuschlag(data: {
  schuleId: number;
  haushaltsjahrId: number;
  zuschlagArtId: number;
  wert: string;
  zeitraum?: string;
  bemerkung?: string;
}) {
  const [result] = await db
    .insert(zuschlaege)
    .values({ ...data, zeitraum: data.zeitraum ?? "ganzjahr" })
    .onConflictDoUpdate({
      target: [
        zuschlaege.schuleId,
        zuschlaege.haushaltsjahrId,
        zuschlaege.zuschlagArtId,
        zuschlaege.zeitraum,
      ],
      set: {
        wert: sql`excluded.wert`,
        bemerkung: sql`excluded.bemerkung`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return result;
}

// ============================================================
// DEPUTATE & LEHRER
// ============================================================

export async function getLehrerMitDeputaten(haushaltsjahrId: number, schuleId?: number) {
  const baseQuery = db
    .select({
      lehrerId: lehrer.id,
      name: lehrer.vollname,
      stammschuleCode: lehrer.stammschuleCode,
      stammschuleId: lehrer.stammschuleId,
      monat: deputatMonatlich.monat,
      deputatGesamt: deputatMonatlich.deputatGesamt,
      deputatGes: deputatMonatlich.deputatGes,
      deputatGym: deputatMonatlich.deputatGym,
      deputatBk: deputatMonatlich.deputatBk,
    })
    .from(lehrer)
    .innerJoin(deputatMonatlich, eq(lehrer.id, deputatMonatlich.lehrerId))
    .where(
      schuleId
        ? and(
            eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId),
            eq(lehrer.stammschuleId, schuleId),
            eq(lehrer.aktiv, true)
          )
        : and(eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId), eq(lehrer.aktiv, true))
    )
    .orderBy(asc(lehrer.vollname), asc(deputatMonatlich.monat));

  return baseQuery;
}

export async function getDeputatSummenByMonat(haushaltsjahrId: number, schuleId?: number) {
  // Monatliche Summen aller Wochenstunden (fuer Stellenist-Berechnung)
  // OHNE Schul-Filter: Wird nur fuer Uebersicht/Vorschau genutzt
  const rows = await db
    .select({
      monat: deputatMonatlich.monat,
      summeGesamt: sql<string>`sum(${deputatMonatlich.deputatGesamt}::numeric)`,
      summeGes: sql<string>`sum(${deputatMonatlich.deputatGes}::numeric)`,
      summeGym: sql<string>`sum(${deputatMonatlich.deputatGym}::numeric)`,
      summeBk: sql<string>`sum(${deputatMonatlich.deputatBk}::numeric)`,
      anzahlLehrer: sql<number>`count(distinct ${deputatMonatlich.lehrerId})`,
    })
    .from(deputatMonatlich)
    .innerJoin(lehrer, eq(deputatMonatlich.lehrerId, lehrer.id))
    .where(
      schuleId
        ? and(
            eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId),
            eq(lehrer.stammschuleId, schuleId),
            eq(lehrer.aktiv, true)
          )
        : and(eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId), eq(lehrer.aktiv, true))
    )
    .groupBy(deputatMonatlich.monat)
    .orderBy(asc(deputatMonatlich.monat));

  return rows;
}

/**
 * Schulspezifische Deputat-Summen pro Monat.
 *
 * KRITISCH: Summiert die schulspezifische Deputat-Spalte (deputat_ges/gym/bk)
 * ueber ALLE Lehrer — nicht nur Stammschul-Lehrer.
 *
 * Beispiel: Lehrer Hoffmann (Stammschule GYM) unterrichtet 3h an GES.
 * Diese 3h muessen im GES-Stellenist erscheinen, nicht im GYM-Stellenist.
 *
 * Rechtsgrundlage: § 3 FESchVO — das Stellenist basiert auf den tatsaechlich
 * an der Schule erteilten Unterrichtsstunden, unabhaengig von der Stammschule.
 */
export async function getDeputatSummenBySchule(
  haushaltsjahrId: number,
  schulKurzname: string
) {
  // Schulspezifische Spalte je nach Kurzname
  // GES/GYM/BK haben Cross-School-Deputate (deputat_ges, deputat_gym, deputat_bk)
  // → summiert ueber ALLE Lehrer (egal welche Stammschule), nur die schulspezifische Spalte
  // Grundschulen u.a. haben nur deputat_gesamt
  // → summiert nur Lehrer mit dieser Stammschule
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spalteMap: Record<string, any> = {
    GES: deputatMonatlich.deputatGes,
    GYM: deputatMonatlich.deputatGym,
    BK: deputatMonatlich.deputatBk,
  };

  const spalte = spalteMap[schulKurzname];

  if (!spalte) {
    // Grundschulen u.a.: deputatGesamt verwenden, NUR Lehrer dieser Stammschule
    const rows = await db
      .select({
        monat: deputatMonatlich.monat,
        summeSchulspezifisch: sql<string>`sum(${deputatMonatlich.deputatGesamt}::numeric)`,
        summeGesamt: sql<string>`sum(${deputatMonatlich.deputatGesamt}::numeric)`,
        anzahlLehrer: sql<number>`count(distinct ${deputatMonatlich.lehrerId})`,
      })
      .from(deputatMonatlich)
      .innerJoin(lehrer, eq(deputatMonatlich.lehrerId, lehrer.id))
      .where(
        and(
          eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId),
          eq(lehrer.aktiv, true),
          eq(lehrer.stammschuleCode, schulKurzname)
        )
      )
      .groupBy(deputatMonatlich.monat)
      .orderBy(asc(deputatMonatlich.monat));

    return rows;
  }

  // GES/GYM/BK: schulspezifische Spalte ueber alle Lehrer summieren
  const rows = await db
    .select({
      monat: deputatMonatlich.monat,
      summeSchulspezifisch: sql<string>`sum(${spalte}::numeric)`,
      summeGesamt: sql<string>`sum(${deputatMonatlich.deputatGesamt}::numeric)`,
      anzahlLehrer: sql<number>`count(distinct ${deputatMonatlich.lehrerId}) filter (where ${spalte}::numeric > 0)`,
    })
    .from(deputatMonatlich)
    .innerJoin(lehrer, eq(deputatMonatlich.lehrerId, lehrer.id))
    .where(
      and(
        eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId),
        eq(lehrer.aktiv, true)
      )
    )
    .groupBy(deputatMonatlich.monat)
    .orderBy(asc(deputatMonatlich.monat));

  return rows;
}

// ============================================================
// SYNC-LOG
// ============================================================

export async function getLatestSync() {
  const [result] = await db
    .select()
    .from(deputatSyncLog)
    .orderBy(desc(deputatSyncLog.syncDatum))
    .limit(1);
  return result ?? null;
}

// ============================================================
// BERECHNUNGSERGEBNISSE
// ============================================================

export async function getAktuelleStellensollBySchule(schuleId: number, haushaltsjahrId: number) {
  return db
    .select()
    .from(berechnungStellensoll)
    .where(
      and(
        eq(berechnungStellensoll.schuleId, schuleId),
        eq(berechnungStellensoll.haushaltsjahrId, haushaltsjahrId),
        eq(berechnungStellensoll.istAktuell, true)
      )
    )
    .orderBy(asc(berechnungStellensoll.zeitraum));
}

export async function getAktuelleStellensollAlleSchulen(haushaltsjahrId: number) {
  return db
    .select({
      id: berechnungStellensoll.id,
      schuleId: berechnungStellensoll.schuleId,
      zeitraum: berechnungStellensoll.zeitraum,
      grundstellenGerundet: berechnungStellensoll.grundstellenGerundet,
      zuschlaegeSumme: berechnungStellensoll.zuschlaegeSumme,
      stellensoll: berechnungStellensoll.stellensoll,
      grundstellenDetails: berechnungStellensoll.grundstellenDetails,
      berechnetAm: berechnungStellensoll.berechnetAm,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(berechnungStellensoll)
    .innerJoin(schulen, eq(berechnungStellensoll.schuleId, schulen.id))
    .where(
      and(
        eq(berechnungStellensoll.haushaltsjahrId, haushaltsjahrId),
        eq(berechnungStellensoll.istAktuell, true)
      )
    )
    .orderBy(asc(schulen.kurzname), asc(berechnungStellensoll.zeitraum));
}

// ============================================================
// HISTORIE / AUDIT
// ============================================================

export async function getBerechnungsHistorie(limit = 50) {
  // Stellensoll-Berechnungen (alle, nicht nur aktuelle)
  const sollRows = await db
    .select({
      id: berechnungStellensoll.id,
      berechnetAm: berechnungStellensoll.berechnetAm,
      berechnetVon: berechnungStellensoll.berechnetVon,
      zeitraum: berechnungStellensoll.zeitraum,
      stellensoll: berechnungStellensoll.stellensoll,
      istAktuell: berechnungStellensoll.istAktuell,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(berechnungStellensoll)
    .innerJoin(schulen, eq(berechnungStellensoll.schuleId, schulen.id))
    .orderBy(desc(berechnungStellensoll.berechnetAm))
    .limit(limit);

  // Stellenist-Berechnungen
  const istRows = await db
    .select({
      id: berechnungStellenist.id,
      berechnetAm: berechnungStellenist.berechnetAm,
      berechnetVon: berechnungStellenist.berechnetVon,
      zeitraum: berechnungStellenist.zeitraum,
      stellenistGesamt: berechnungStellenist.stellenistGesamt,
      istAktuell: berechnungStellenist.istAktuell,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(berechnungStellenist)
    .innerJoin(schulen, eq(berechnungStellenist.schuleId, schulen.id))
    .orderBy(desc(berechnungStellenist.berechnetAm))
    .limit(limit);

  // Sync-Log Eintraege
  const syncRows = await db
    .select()
    .from(deputatSyncLog)
    .orderBy(desc(deputatSyncLog.syncDatum))
    .limit(20);

  return { sollRows, istRows, syncRows };
}

// ============================================================
// MEHRARBEIT
// ============================================================

export async function getMehrarbeitByHaushaltsjahr(
  haushaltsjahrId: number,
  schuleId?: number
) {
  const conditions = [eq(mehrarbeit.haushaltsjahrId, haushaltsjahrId)];
  if (schuleId) conditions.push(eq(mehrarbeit.schuleId, schuleId));

  return db
    .select({
      id: mehrarbeit.id,
      lehrerId: mehrarbeit.lehrerId,
      monat: mehrarbeit.monat,
      stunden: mehrarbeit.stunden,
      schuleId: mehrarbeit.schuleId,
      bemerkung: mehrarbeit.bemerkung,
      lehrerName: lehrer.vollname,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(mehrarbeit)
    .innerJoin(lehrer, eq(mehrarbeit.lehrerId, lehrer.id))
    .leftJoin(schulen, eq(mehrarbeit.schuleId, schulen.id))
    .where(and(...conditions))
    .orderBy(asc(lehrer.vollname), asc(mehrarbeit.monat));
}

export async function upsertMehrarbeit(data: {
  lehrerId: number;
  haushaltsjahrId: number;
  monat: number;
  stunden: string;
  schuleId?: number;
  bemerkung?: string;
}) {
  const [result] = await db
    .insert(mehrarbeit)
    .values(data)
    .onConflictDoUpdate({
      target: [
        mehrarbeit.lehrerId,
        mehrarbeit.haushaltsjahrId,
        mehrarbeit.monat,
        mehrarbeit.schuleId,
      ],
      set: {
        stunden: sql`excluded.stunden`,
        bemerkung: sql`excluded.bemerkung`,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return result;
}

export async function deleteMehrarbeit(id: number) {
  await db.delete(mehrarbeit).where(eq(mehrarbeit.id, id));
}

// ============================================================
// STELLENIST
// ============================================================

export async function getAktuelleStellenisteBySchule(schuleId: number, haushaltsjahrId: number) {
  return db
    .select()
    .from(berechnungStellenist)
    .where(
      and(
        eq(berechnungStellenist.schuleId, schuleId),
        eq(berechnungStellenist.haushaltsjahrId, haushaltsjahrId),
        eq(berechnungStellenist.istAktuell, true)
      )
    )
    .orderBy(asc(berechnungStellenist.zeitraum));
}

export async function getAktuelleStellenisteAlleSchulen(haushaltsjahrId: number) {
  return db
    .select({
      id: berechnungStellenist.id,
      schuleId: berechnungStellenist.schuleId,
      zeitraum: berechnungStellenist.zeitraum,
      stellenist: berechnungStellenist.stellenist,
      stellenistGerundet: berechnungStellenist.stellenistGerundet,
      mehrarbeitStellen: berechnungStellenist.mehrarbeitStellen,
      stellenistGesamt: berechnungStellenist.stellenistGesamt,
      monatsDurchschnittStunden: berechnungStellenist.monatsDurchschnittStunden,
      regelstundendeputat: berechnungStellenist.regelstundendeputat,
      details: berechnungStellenist.details,
      berechnetAm: berechnungStellenist.berechnetAm,
      schulKurzname: schulen.kurzname,
      schulFarbe: schulen.farbe,
    })
    .from(berechnungStellenist)
    .innerJoin(schulen, eq(berechnungStellenist.schuleId, schulen.id))
    .where(
      and(
        eq(berechnungStellenist.haushaltsjahrId, haushaltsjahrId),
        eq(berechnungStellenist.istAktuell, true)
      )
    )
    .orderBy(asc(schulen.kurzname), asc(berechnungStellenist.zeitraum));
}

// ============================================================
// LEHRER (fuer Selects)
// ============================================================

export async function getAktiveLehrer() {
  return db
    .select({
      id: lehrer.id,
      name: lehrer.vollname,
      stammschuleId: lehrer.stammschuleId,
      stammschuleCode: lehrer.stammschuleCode,
    })
    .from(lehrer)
    .where(eq(lehrer.aktiv, true))
    .orderBy(asc(lehrer.vollname));
}

export async function getAktuelleVergleiche(haushaltsjahrId: number) {
  return db
    .select({
      id: berechnungVergleich.id,
      schuleId: berechnungVergleich.schuleId,
      stellensoll: berechnungVergleich.stellensoll,
      stellenist: berechnungVergleich.stellenist,
      differenz: berechnungVergleich.differenz,
      status: berechnungVergleich.status,
      refinanzierung: berechnungVergleich.refinanzierung,
      berechnetAm: berechnungVergleich.berechnetAm,
      schulKurzname: schulen.kurzname,
      schulName: schulen.name,
      schulFarbe: schulen.farbe,
    })
    .from(berechnungVergleich)
    .innerJoin(schulen, eq(berechnungVergleich.schuleId, schulen.id))
    .where(eq(berechnungVergleich.haushaltsjahrId, haushaltsjahrId))
    .orderBy(asc(schulen.kurzname));
}

// ============================================================
// BENUTZER (Auth / Admin)
// ============================================================

export async function getAllBenutzer() {
  return db
    .select({
      id: benutzer.id,
      email: benutzer.email,
      name: benutzer.name,
      rolle: benutzer.rolle,
      aktiv: benutzer.aktiv,
      letzterLogin: benutzer.letzterLogin,
      createdAt: benutzer.createdAt,
    })
    .from(benutzer)
    .orderBy(asc(benutzer.name));
}

export async function getBenutzerById(id: number) {
  const [result] = await db
    .select()
    .from(benutzer)
    .where(eq(benutzer.id, id));
  return result ?? null;
}

export async function getBenutzerByEmail(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const [result] = await db
    .select()
    .from(benutzer)
    .where(eq(benutzer.email, normalizedEmail));
  return result ?? null;
}

export async function createBenutzer(data: {
  email: string;
  passwortHash: string;
  name: string;
  rolle: string;
}) {
  const [result] = await db
    .insert(benutzer)
    .values(data)
    .returning();
  return result;
}

export async function updateBenutzer(
  id: number,
  data: { name?: string; email?: string; rolle?: string; aktiv?: boolean }
) {
  const [result] = await db
    .update(benutzer)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(benutzer.id, id))
    .returning();
  return result;
}

export async function updateBenutzerPasswort(id: number, passwortHash: string) {
  await db
    .update(benutzer)
    .set({ passwortHash, updatedAt: sql`now()` })
    .where(eq(benutzer.id, id));
}

// ============================================================
// DEPUTAT-AENDERUNGEN
// ============================================================

/** Alle Aenderungen fuer ein Haushaltsjahr (fuer Dashboard-Warnungen) */
export async function getDeputatAenderungen(haushaltsjahrId: number, nurGehaltsrelevant = false) {
  const conditions = [eq(deputatAenderungen.haushaltsjahrId, haushaltsjahrId)];
  if (nurGehaltsrelevant) {
    conditions.push(eq(deputatAenderungen.istGehaltsrelevant, true));
  }

  return db
    .select({
      id: deputatAenderungen.id,
      lehrerId: deputatAenderungen.lehrerId,
      lehrerName: lehrer.vollname,
      stammschuleCode: lehrer.stammschuleCode,
      monat: deputatAenderungen.monat,
      deputatGesamtAlt: deputatAenderungen.deputatGesamtAlt,
      deputatGesamtNeu: deputatAenderungen.deputatGesamtNeu,
      deputatGesAlt: deputatAenderungen.deputatGesAlt,
      deputatGesNeu: deputatAenderungen.deputatGesNeu,
      deputatGymAlt: deputatAenderungen.deputatGymAlt,
      deputatGymNeu: deputatAenderungen.deputatGymNeu,
      deputatBkAlt: deputatAenderungen.deputatBkAlt,
      deputatBkNeu: deputatAenderungen.deputatBkNeu,
      aenderungstyp: deputatAenderungen.aenderungstyp,
      istGehaltsrelevant: deputatAenderungen.istGehaltsrelevant,
      termIdAlt: deputatAenderungen.termIdAlt,
      termIdNeu: deputatAenderungen.termIdNeu,
      geaendertAm: deputatAenderungen.geaendertAm,
    })
    .from(deputatAenderungen)
    .innerJoin(lehrer, eq(deputatAenderungen.lehrerId, lehrer.id))
    .where(and(...conditions))
    .orderBy(desc(deputatAenderungen.geaendertAm));
}

/** Aenderungen fuer einen einzelnen Lehrer (fuer Timeline) */
export async function getDeputatAenderungenByLehrer(lehrerId: number, haushaltsjahrId: number) {
  return db
    .select()
    .from(deputatAenderungen)
    .where(
      and(
        eq(deputatAenderungen.lehrerId, lehrerId),
        eq(deputatAenderungen.haushaltsjahrId, haushaltsjahrId)
      )
    )
    .orderBy(asc(deputatAenderungen.monat), desc(deputatAenderungen.geaendertAm));
}

/** Lehrer-Detaildaten mit allen Monatswerten + Schulaufschluesselung */
export async function getLehrerDetail(lehrerId: number, haushaltsjahrId: number) {
  const [lehrerRow] = await db
    .select()
    .from(lehrer)
    .where(eq(lehrer.id, lehrerId));

  if (!lehrerRow) return null;

  const monatsDaten = await db
    .select()
    .from(deputatMonatlich)
    .where(
      and(
        eq(deputatMonatlich.lehrerId, lehrerId),
        eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId)
      )
    )
    .orderBy(asc(deputatMonatlich.monat));

  const aenderungen = await getDeputatAenderungenByLehrer(lehrerId, haushaltsjahrId);

  return {
    lehrer: lehrerRow,
    monatsDaten,
    aenderungen,
  };
}

/** Zusammenfassung der Aenderungen (fuer Dashboard-Badge) */
export async function getAenderungenZusammenfassung(haushaltsjahrId: number) {
  const [result] = await db
    .select({
      gesamt: sql<number>`count(distinct ${deputatAenderungen.lehrerId} || '_' || ${deputatAenderungen.monat})`,
      gehaltsrelevant: sql<number>`count(distinct ${deputatAenderungen.lehrerId} || '_' || ${deputatAenderungen.monat}) filter (where ${deputatAenderungen.istGehaltsrelevant} = true)`,
      betroffeneLehrer: sql<number>`count(distinct ${deputatAenderungen.lehrerId})`,
    })
    .from(deputatAenderungen)
    .where(eq(deputatAenderungen.haushaltsjahrId, haushaltsjahrId));

  return result ?? { gesamt: 0, gehaltsrelevant: 0, betroffeneLehrer: 0 };
}

// ============================================================
// NACHTRAEGE (gehaltsrelevante Aenderungen mit Nachtrag-Status)
// ============================================================

/** Alle gehaltsrelevanten Aenderungen fuer Nachtrags-Uebersicht */
export async function getGehaltsrelevanteAenderungen(haushaltsjahrId: number) {
  return db
    .select({
      id: deputatAenderungen.id,
      lehrerId: deputatAenderungen.lehrerId,
      lehrerName: lehrer.vollname,
      personalnummer: lehrer.personalnummer,
      stammschuleCode: lehrer.stammschuleCode,
      stammschuleId: lehrer.stammschuleId,
      schuleName: schulen.name,
      monat: deputatAenderungen.monat,
      deputatGesamtAlt: deputatAenderungen.deputatGesamtAlt,
      deputatGesamtNeu: deputatAenderungen.deputatGesamtNeu,
      geaendertAm: deputatAenderungen.geaendertAm,
      tatsaechlichesDatum: deputatAenderungen.tatsaechlichesDatum,
      nachtragStatus: deputatAenderungen.nachtragStatus,
      nachtragErstelltAm: deputatAenderungen.nachtragErstelltAm,
      nachtragErstelltVon: deputatAenderungen.nachtragErstelltVon,
    })
    .from(deputatAenderungen)
    .innerJoin(lehrer, eq(deputatAenderungen.lehrerId, lehrer.id))
    .leftJoin(schulen, eq(lehrer.stammschuleId, schulen.id))
    .where(
      and(
        eq(deputatAenderungen.haushaltsjahrId, haushaltsjahrId),
        eq(deputatAenderungen.istGehaltsrelevant, true)
      )
    )
    .orderBy(desc(deputatAenderungen.geaendertAm));
}

/** Einzelne Aenderung fuer Nachtrag-Generierung laden */
export async function getAenderungFuerNachtrag(aenderungId: number) {
  const [result] = await db
    .select({
      id: deputatAenderungen.id,
      lehrerId: deputatAenderungen.lehrerId,
      lehrerName: lehrer.vollname,
      personalnummer: lehrer.personalnummer,
      stammschuleCode: lehrer.stammschuleCode,
      schuleName: schulen.name,
      schulform: schulen.schulform,
      monat: deputatAenderungen.monat,
      haushaltsjahrId: deputatAenderungen.haushaltsjahrId,
      deputatGesamtAlt: deputatAenderungen.deputatGesamtAlt,
      deputatGesamtNeu: deputatAenderungen.deputatGesamtNeu,
      geaendertAm: deputatAenderungen.geaendertAm,
      tatsaechlichesDatum: deputatAenderungen.tatsaechlichesDatum,
    })
    .from(deputatAenderungen)
    .innerJoin(lehrer, eq(deputatAenderungen.lehrerId, lehrer.id))
    .leftJoin(schulen, eq(lehrer.stammschuleId, schulen.id))
    .where(eq(deputatAenderungen.id, aenderungId));

  return result ?? null;
}

// ============================================================
// STELLENARTEN (Stammdaten)
// ============================================================

export async function getStellenartTypen() {
  return db
    .select()
    .from(stellenartTypen)
    .where(eq(stellenartTypen.aktiv, true))
    .orderBy(asc(stellenartTypen.sortierung));
}

export async function createStellenartTyp(data: {
  bezeichnung: string;
  kurzbezeichnung?: string | null;
  beschreibung?: string | null;
  rechtsgrundlage?: string | null;
  bindungstyp: string;
  istIsoliert?: boolean;
}) {
  const [result] = await db
    .insert(stellenartTypen)
    .values(data)
    .returning();
  return result;
}

export async function updateStellenartTyp(
  id: number,
  data: {
    bezeichnung?: string;
    kurzbezeichnung?: string | null;
    beschreibung?: string | null;
    rechtsgrundlage?: string | null;
    bindungstyp?: string;
    istIsoliert?: boolean;
    aktiv?: boolean;
  }
) {
  const [result] = await db
    .update(stellenartTypen)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(stellenartTypen.id, id))
    .returning();
  return result;
}

// ============================================================
// STELLENANTEILE
// ============================================================

export async function getStellenanteileBySchuleUndHj(schuleId: number, haushaltsjahrId: number) {
  return db
    .select({
      id: stellenanteile.id,
      schuleId: stellenanteile.schuleId,
      haushaltsjahrId: stellenanteile.haushaltsjahrId,
      stellenartTypId: stellenanteile.stellenartTypId,
      stellenartBezeichnung: stellenartTypen.bezeichnung,
      stellenartKurz: stellenartTypen.kurzbezeichnung,
      stellenartKuerzel: stellenartTypen.kuerzel,
      stellenartTyp: stellenartTypen.typ,
      bindungstyp: stellenartTypen.bindungstyp,
      istIsoliert: stellenartTypen.istIsoliert,
      anlage2a: stellenartTypen.anlage2a,
      erhoehtPauschale: stellenartTypen.erhoehtPauschale,
      rechtsgrundlage: stellenartTypen.rechtsgrundlage,
      lehrerId: stellenanteile.lehrerId,
      lehrerName: lehrer.vollname,
      lehrerPersonalnr: lehrer.personalnummer,
      wert: stellenanteile.wert,
      eurBetrag: stellenanteile.eurBetrag,
      wahlrecht: stellenanteile.wahlrecht,
      zeitraum: stellenanteile.zeitraum,
      status: stellenanteile.status,
      befristetBis: stellenanteile.befristetBis,
      antragsdatum: stellenanteile.antragsdatum,
      aktenzeichen: stellenanteile.aktenzeichen,
      dmsDokumentennummer: stellenanteile.dmsDokumentennummer,
      bemerkung: stellenanteile.bemerkung,
      erstelltVon: stellenanteile.erstelltVon,
      createdAt: stellenanteile.createdAt,
    })
    .from(stellenanteile)
    .innerJoin(stellenartTypen, eq(stellenanteile.stellenartTypId, stellenartTypen.id))
    .leftJoin(lehrer, eq(stellenanteile.lehrerId, lehrer.id))
    .where(
      and(
        eq(stellenanteile.schuleId, schuleId),
        eq(stellenanteile.haushaltsjahrId, haushaltsjahrId)
      )
    )
    .orderBy(asc(stellenartTypen.sortierung), asc(stellenanteile.createdAt));
}

export async function getAlleStellenanteileByHj(haushaltsjahrId: number) {
  return db
    .select({
      id: stellenanteile.id,
      schuleId: stellenanteile.schuleId,
      stellenartBezeichnung: stellenartTypen.bezeichnung,
      stellenartKuerzel: stellenartTypen.kuerzel,
      stellenartTyp: stellenartTypen.typ,
      istIsoliert: stellenartTypen.istIsoliert,
      anlage2a: stellenartTypen.anlage2a,
      erhoehtPauschale: stellenartTypen.erhoehtPauschale,
      lehrerId: stellenanteile.lehrerId,
      lehrerName: lehrer.vollname,
      wert: stellenanteile.wert,
      eurBetrag: stellenanteile.eurBetrag,
      wahlrecht: stellenanteile.wahlrecht,
      zeitraum: stellenanteile.zeitraum,
      status: stellenanteile.status,
      aktenzeichen: stellenanteile.aktenzeichen,
    })
    .from(stellenanteile)
    .innerJoin(stellenartTypen, eq(stellenanteile.stellenartTypId, stellenartTypen.id))
    .leftJoin(lehrer, eq(stellenanteile.lehrerId, lehrer.id))
    .where(
      and(
        eq(stellenanteile.haushaltsjahrId, haushaltsjahrId),
        eq(stellenanteile.status, "genehmigt")
      )
    )
    .orderBy(asc(stellenanteile.schuleId), asc(stellenartTypen.sortierung));
}

export async function createStellenanteil(data: {
  schuleId: number;
  haushaltsjahrId: number;
  stellenartTypId: number;
  lehrerId?: number | null;
  wert: string;
  eurBetrag?: string | null;
  wahlrecht?: string | null;
  zeitraum: string;
  status: string;
  befristetBis?: string | null;
  antragsdatum?: string | null;
  aktenzeichen?: string | null;
  dmsDokumentennummer?: string | null;
  bemerkung?: string | null;
  erstelltVon?: string | null;
}) {
  const [result] = await db
    .insert(stellenanteile)
    .values(data)
    .returning();
  return result;
}

export async function updateStellenanteil(
  id: number,
  data: {
    stellenartTypId?: number;
    lehrerId?: number | null;
    wert?: string;
    eurBetrag?: string | null;
    wahlrecht?: string | null;
    zeitraum?: string;
    status?: string;
    befristetBis?: string | null;
    antragsdatum?: string | null;
    aktenzeichen?: string | null;
    dmsDokumentennummer?: string | null;
    bemerkung?: string | null;
    geaendertVon?: string | null;
  }
) {
  const [result] = await db
    .update(stellenanteile)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(stellenanteile.id, id))
    .returning();
  return result;
}

export async function deleteStellenanteil(id: number) {
  await db.delete(stellenanteile).where(eq(stellenanteile.id, id));
}

export async function getStellenanteilById(id: number) {
  const [result] = await db
    .select({
      id: stellenanteile.id,
      schuleId: stellenanteile.schuleId,
      haushaltsjahrId: stellenanteile.haushaltsjahrId,
      stellenartTypId: stellenanteile.stellenartTypId,
      stellenartBezeichnung: stellenartTypen.bezeichnung,
      stellenartKuerzel: stellenartTypen.kuerzel,
      stellenartTyp: stellenartTypen.typ,
      bindungstyp: stellenartTypen.bindungstyp,
      istIsoliert: stellenartTypen.istIsoliert,
      lehrerId: stellenanteile.lehrerId,
      lehrerName: lehrer.vollname,
      wert: stellenanteile.wert,
      eurBetrag: stellenanteile.eurBetrag,
      wahlrecht: stellenanteile.wahlrecht,
      zeitraum: stellenanteile.zeitraum,
      status: stellenanteile.status,
      befristetBis: stellenanteile.befristetBis,
      antragsdatum: stellenanteile.antragsdatum,
      aktenzeichen: stellenanteile.aktenzeichen,
      dmsDokumentennummer: stellenanteile.dmsDokumentennummer,
      bemerkung: stellenanteile.bemerkung,
    })
    .from(stellenanteile)
    .innerJoin(stellenartTypen, eq(stellenanteile.stellenartTypId, stellenartTypen.id))
    .leftJoin(lehrer, eq(stellenanteile.lehrerId, lehrer.id))
    .where(eq(stellenanteile.id, id));
  return result ?? null;
}

// ============================================================
// LEHRER — erweiterte Queries (Mitarbeiterverwaltung)
// ============================================================

export async function getAlleLehrerMitDetails() {
  return db
    .select({
      id: lehrer.id,
      untisTeacherId: lehrer.untisTeacherId,
      personalnummer: lehrer.personalnummer,
      name: lehrer.name,
      vollname: lehrer.vollname,
      vorname: lehrer.vorname,
      nachname: lehrer.nachname,
      stammschuleId: lehrer.stammschuleId,
      stammschuleCode: lehrer.stammschuleCode,
      schuleName: schulen.name,
      schuleKurzname: schulen.kurzname,
      schuleFarbe: schulen.farbe,
      quelle: lehrer.quelle,
      aktiv: lehrer.aktiv,
      createdAt: lehrer.createdAt,
    })
    .from(lehrer)
    .leftJoin(schulen, eq(lehrer.stammschuleId, schulen.id))
    .orderBy(asc(lehrer.vollname));
}

export async function getAktiveLehrerBySchule(schuleId: number) {
  return db
    .select({
      id: lehrer.id,
      vollname: lehrer.vollname,
      personalnummer: lehrer.personalnummer,
    })
    .from(lehrer)
    .where(and(eq(lehrer.stammschuleId, schuleId), eq(lehrer.aktiv, true)))
    .orderBy(asc(lehrer.vollname));
}

export async function createLehrerManuell(data: {
  vorname: string;
  nachname: string;
  personalnummer?: string | null;
  stammschuleId: number;
}) {
  const stammschule = await db.select({ kurzname: schulen.kurzname }).from(schulen).where(eq(schulen.id, data.stammschuleId));
  const code = stammschule[0]?.kurzname ?? null;

  const [result] = await db
    .insert(lehrer)
    .values({
      name: data.nachname.substring(0, 3),
      vollname: `${data.nachname} ${data.vorname}`,
      vorname: data.vorname,
      nachname: data.nachname,
      personalnummer: data.personalnummer || null,
      stammschuleId: data.stammschuleId,
      stammschuleCode: code,
      quelle: "manuell",
    })
    .returning();
  return result;
}

export async function updateLehrerManuell(
  id: number,
  data: {
    vorname?: string;
    nachname?: string;
    personalnummer?: string | null;
    stammschuleId?: number;
  }
) {
  const updates: Record<string, unknown> = { updatedAt: sql`now()` };
  if (data.vorname !== undefined) updates.vorname = data.vorname;
  if (data.nachname !== undefined) updates.nachname = data.nachname;
  if (data.vorname !== undefined || data.nachname !== undefined) {
    const v = data.vorname ?? "";
    const n = data.nachname ?? "";
    updates.vollname = `${n} ${v}`;
    updates.name = n.substring(0, 3);
  }
  if (data.personalnummer !== undefined) updates.personalnummer = data.personalnummer || null;
  if (data.stammschuleId !== undefined) {
    updates.stammschuleId = data.stammschuleId;
    const stammschule = await db.select({ kurzname: schulen.kurzname }).from(schulen).where(eq(schulen.id, data.stammschuleId));
    updates.stammschuleCode = stammschule[0]?.kurzname ?? null;
  }

  const [result] = await db
    .update(lehrer)
    .set(updates)
    .where(and(eq(lehrer.id, id), eq(lehrer.quelle, "manuell")))
    .returning();
  return result;
}

/**
 * Setzt das Deputat fuer einen manuell angelegten Lehrer auf alle 12 Monate
 * eines Haushaltsjahres. Upsert: bestehende Werte werden ueberschrieben.
 */
export async function upsertManuellDeputat(
  lehrerId: number,
  haushaltsjahrId: number,
  deputatGesamt: string,
) {
  for (let monat = 1; monat <= 12; monat++) {
    await db
      .insert(deputatMonatlich)
      .values({
        lehrerId,
        haushaltsjahrId,
        monat,
        deputatGesamt,
        deputatGes: "0",
        deputatGym: "0",
        deputatBk: "0",
        quelle: "manuell",
      })
      .onConflictDoUpdate({
        target: [deputatMonatlich.lehrerId, deputatMonatlich.haushaltsjahrId, deputatMonatlich.monat],
        set: {
          deputatGesamt,
          quelle: "manuell",
          updatedAt: sql`now()`,
        },
      });
  }
}

/**
 * Setzt das Deputat fuer einen einzelnen Monat (manuell).
 */
export async function upsertManuellDeputatMonat(
  lehrerId: number,
  haushaltsjahrId: number,
  monat: number,
  deputatGesamt: string,
) {
  await db
    .insert(deputatMonatlich)
    .values({
      lehrerId,
      haushaltsjahrId,
      monat,
      deputatGesamt,
      deputatGes: "0",
      deputatGym: "0",
      deputatBk: "0",
      quelle: "manuell",
    })
    .onConflictDoUpdate({
      target: [deputatMonatlich.lehrerId, deputatMonatlich.haushaltsjahrId, deputatMonatlich.monat],
      set: {
        deputatGesamt,
        quelle: "manuell",
        updatedAt: sql`now()`,
      },
    });
}

/**
 * Laedt das aktuelle Deputat eines Lehrers (letzter Monat mit Daten).
 */
export async function getAktuellesDeputat(lehrerId: number, haushaltsjahrId: number) {
  const rows = await db
    .select({
      monat: deputatMonatlich.monat,
      deputatGesamt: deputatMonatlich.deputatGesamt,
    })
    .from(deputatMonatlich)
    .where(
      and(
        eq(deputatMonatlich.lehrerId, lehrerId),
        eq(deputatMonatlich.haushaltsjahrId, haushaltsjahrId),
      )
    )
    .orderBy(asc(deputatMonatlich.monat));
  return rows;
}

/**
 * Laedt alle Deputat-Aenderungen mit eingetragenem tatsaechlichem Datum
 * fuer ein Haushaltsjahr. Diese werden fuer die tagesgenaue Stellenist-Berechnung
 * verwendet: Wenn HR ein tatsaechliches Datum eintraegt, wird der Monatswert
 * nicht pauschal genommen sondern tagesgewichtet berechnet.
 */
export async function getAenderungenMitDatum(haushaltsjahrId: number) {
  return db
    .select({
      lehrerId: deputatAenderungen.lehrerId,
      monat: deputatAenderungen.monat,
      deputatGesamtAlt: deputatAenderungen.deputatGesamtAlt,
      deputatGesamtNeu: deputatAenderungen.deputatGesamtNeu,
      deputatGesAlt: deputatAenderungen.deputatGesAlt,
      deputatGesNeu: deputatAenderungen.deputatGesNeu,
      deputatGymAlt: deputatAenderungen.deputatGymAlt,
      deputatGymNeu: deputatAenderungen.deputatGymNeu,
      deputatBkAlt: deputatAenderungen.deputatBkAlt,
      deputatBkNeu: deputatAenderungen.deputatBkNeu,
      tatsaechlichesDatum: deputatAenderungen.tatsaechlichesDatum,
      stammschuleCode: lehrer.stammschuleCode,
    })
    .from(deputatAenderungen)
    .innerJoin(lehrer, eq(deputatAenderungen.lehrerId, lehrer.id))
    .where(
      and(
        eq(deputatAenderungen.haushaltsjahrId, haushaltsjahrId),
        sql`${deputatAenderungen.tatsaechlichesDatum} IS NOT NULL`
      )
    )
    .orderBy(asc(deputatAenderungen.lehrerId), asc(deputatAenderungen.monat));
}

// ============================================================
// STELLENANTEILE — KPIs + Befristungs-Monitoring
// ============================================================

/** Ablaufende Befristungen innerhalb der naechsten X Tage */
export async function getAblaufendeBefristungen(haushaltsjahrId: number, tageVoraus = 90) {
  const heute = new Date().toISOString().split("T")[0];
  const grenze = new Date(Date.now() + tageVoraus * 86400000).toISOString().split("T")[0];

  return db
    .select({
      id: stellenanteile.id,
      schuleId: stellenanteile.schuleId,
      stellenartBezeichnung: stellenartTypen.bezeichnung,
      lehrerName: lehrer.vollname,
      wert: stellenanteile.wert,
      befristetBis: stellenanteile.befristetBis,
      status: stellenanteile.status,
      schuleKurzname: schulen.kurzname,
    })
    .from(stellenanteile)
    .innerJoin(stellenartTypen, eq(stellenanteile.stellenartTypId, stellenartTypen.id))
    .leftJoin(lehrer, eq(stellenanteile.lehrerId, lehrer.id))
    .innerJoin(schulen, eq(stellenanteile.schuleId, schulen.id))
    .where(
      and(
        eq(stellenanteile.haushaltsjahrId, haushaltsjahrId),
        eq(stellenanteile.status, "genehmigt"),
        lte(stellenanteile.befristetBis, grenze),
        gte(stellenanteile.befristetBis, heute)
      )
    )
    .orderBy(asc(stellenanteile.befristetBis));
}

/** KPI-Zusammenfassung Stellenanteile (mit Geldleistungen) */
export async function getStellenanteileKPIs(haushaltsjahrId: number) {
  const rows = await db
    .select({
      status: stellenanteile.status,
      wert: stellenanteile.wert,
      eurBetrag: stellenanteile.eurBetrag,
      wahlrecht: stellenanteile.wahlrecht,
      stellenartTyp: stellenartTypen.typ,
    })
    .from(stellenanteile)
    .innerJoin(stellenartTypen, eq(stellenanteile.stellenartTypId, stellenartTypen.id))
    .where(eq(stellenanteile.haushaltsjahrId, haushaltsjahrId));

  let beantragt = 0;
  let genehmigt = 0;
  let genehmigtStellen = 0;
  let genehmigtEurBetrag = 0;

  for (const row of rows) {
    if (row.status === "beantragt") beantragt++;
    if (row.status === "genehmigt") {
      genehmigt++;
      // Stellen nur zaehlen wenn deputatswirksam (A, A_106, B mit Stellenwahl)
      const typ = row.stellenartTyp;
      if (typ === "A" || typ === "A_106") {
        genehmigtStellen += Number(row.wert);
      } else if (typ === "B" && row.wahlrecht === "stelle") {
        genehmigtStellen += Number(row.wert);
      }
      // EUR-Betraege zaehlen (B mit Geldwahl + C)
      if (row.eurBetrag) {
        genehmigtEurBetrag += Number(row.eurBetrag);
      }
    }
  }

  return {
    beantragt,
    genehmigt,
    genehmigtStellen: Math.round(genehmigtStellen * 10000) / 10000,
    genehmigtEurBetrag: Math.round(genehmigtEurBetrag * 100) / 100,
  };
}
