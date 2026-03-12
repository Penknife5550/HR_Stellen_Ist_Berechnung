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
  zuschlagArten,
  zuschlaege,
  lehrer,
  deputatMonatlich,
  mehrarbeit,
  deputatSyncLog,
  berechnungStellensoll,
  berechnungStellenist,
  berechnungVergleich,
  benutzer,
} from "@/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

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
