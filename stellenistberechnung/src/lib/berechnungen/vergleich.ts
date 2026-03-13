/**
 * Vergleichs-Berechnung (Stellensoll vs Stellenist).
 *
 * Berechnet den gewichteten Jahresdurchschnitt fuer Soll und Ist,
 * die Differenz, den Status und die Refinanzierung.
 *
 * Gewichtung: Jan-Jul (7 Monate) und Aug-Dez (5 Monate) → Jahreswert
 * Formel: (janJulWert × 7 + augDezWert × 5) / 12
 */

import { db } from "@/db";
import {
  berechnungStellensoll,
  berechnungStellenist,
  berechnungVergleich,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { roundToDecimals } from "./rounding";

/**
 * Berechnet den gewichteten Jahresdurchschnitt aus zwei Zeitraum-Werten.
 *
 * Falls nur ein Zeitraum vorhanden: diesen Wert verwenden (der andere ist noch
 * nicht berechnet). Falls beide vorhanden: gewichteter Durchschnitt.
 */
export function berechneGewichtetenDurchschnitt(
  janJulWert: number | null,
  augDezWert: number | null,
): number {
  if (janJulWert !== null && augDezWert !== null) {
    return roundToDecimals((janJulWert * 7 + augDezWert * 5) / 12, 1);
  }
  if (janJulWert !== null) return janJulWert;
  if (augDezWert !== null) return augDezWert;
  return 0;
}

/**
 * Aktualisiert den Vergleich (Stellensoll vs Stellenist) fuer eine Schule.
 *
 * Wird nach jeder Stellensoll- oder Stellenist-Berechnung aufgerufen.
 * Verwendet den gewichteten Jahresdurchschnitt statt Math.max.
 */
export async function aktualisiereVergleich(
  schuleId: number,
  haushaltsjahrId: number,
) {
  // Aktuellste Stellensoll-Werte laden
  const sollRows = await db
    .select()
    .from(berechnungStellensoll)
    .where(
      and(
        eq(berechnungStellensoll.schuleId, schuleId),
        eq(berechnungStellensoll.haushaltsjahrId, haushaltsjahrId),
        eq(berechnungStellensoll.istAktuell, true),
      ),
    );

  if (sollRows.length === 0) return;

  // Gewichteter Durchschnitt Stellensoll
  const janJulSoll = sollRows.find((r) => r.zeitraum === "jan-jul");
  const augDezSoll = sollRows.find((r) => r.zeitraum === "aug-dez");
  const gewichtetSoll = berechneGewichtetenDurchschnitt(
    janJulSoll ? Number(janJulSoll.stellensoll) : null,
    augDezSoll ? Number(augDezSoll.stellensoll) : null,
  );

  // Aktuellste Stellenist-Werte laden
  const istRows = await db
    .select()
    .from(berechnungStellenist)
    .where(
      and(
        eq(berechnungStellenist.schuleId, schuleId),
        eq(berechnungStellenist.haushaltsjahrId, haushaltsjahrId),
        eq(berechnungStellenist.istAktuell, true),
      ),
    );

  // Gewichteter Durchschnitt Stellenist
  const janJulIst = istRows.find((r) => r.zeitraum === "jan-jul");
  const augDezIst = istRows.find((r) => r.zeitraum === "aug-dez");
  const hatStellenist = istRows.length > 0;
  const gewichtetIst = berechneGewichtetenDurchschnitt(
    janJulIst ? Number(janJulIst.stellenistGesamt) : null,
    augDezIst ? Number(augDezIst.stellenistGesamt) : null,
  );

  if (gewichtetSoll === 0 && gewichtetIst === 0) return;

  const differenz = roundToDecimals(gewichtetIst - gewichtetSoll, 1);
  // "nicht_berechnet" wenn noch keine Stellenist-Daten vorhanden
  const status = !hatStellenist
    ? "nicht_berechnet"
    : differenz <= 0 ? "im_soll" : differenz <= 0.5 ? "grenzbereich" : "ueber_soll";
  const refinanzierung = Math.min(gewichtetIst, gewichtetSoll);

  // Transaktion: Loeschen + Einfuegen atomar
  await db.transaction(async (tx) => {
    await tx
      .delete(berechnungVergleich)
      .where(
        and(
          eq(berechnungVergleich.schuleId, schuleId),
          eq(berechnungVergleich.haushaltsjahrId, haushaltsjahrId),
        ),
      );

    await tx.insert(berechnungVergleich).values({
      schuleId,
      haushaltsjahrId,
      stellensoll: String(gewichtetSoll),
      stellenist: String(gewichtetIst),
      differenz: String(differenz),
      status,
      refinanzierung: String(refinanzierung),
    });
  });
}
