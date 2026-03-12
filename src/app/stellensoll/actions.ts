"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  berechnungStellensoll,
  berechnungVergleich,
  berechnungStellenist,
} from "@/db/schema";
import {
  getSchulen,
  getSchulStufenBySchule,
  getSchuelerzahlenByStichtag,
  getAktuellesHaushaltsjahr,
  getZuschlaegeBySchuleUndHaushaltsjahr,
} from "@/lib/db/queries";
import { getSlrWerteBySchuljahr, getAktuellesSchuljahr } from "@/lib/db/queries";
import { berechneGrundstellen } from "@/lib/berechnungen/grundstellen";
import { aktualisiereVergleich } from "@/lib/berechnungen/vergleich";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";

export async function berechneStellensollAction() {
  const session = await requireWriteAccess();
  try {
    const aktuellesHj = await getAktuellesHaushaltsjahr();
    if (!aktuellesHj) return { error: "Kein aktuelles Haushaltsjahr gefunden." };

    const aktuellesSj = await getAktuellesSchuljahr();
    if (!aktuellesSj) return { error: "Kein aktuelles Schuljahr gefunden." };

    const schulen = await getSchulen();
    const slrWerte = await getSlrWerteBySchuljahr(aktuellesSj.id);

    // SLR als Lookup: schulformTyp → relation
    const slrLookup: Record<string, number> = {};
    for (const slr of slrWerte) {
      slrLookup[slr.schulformTyp] = Number(slr.relation);
    }

    const ergebnisse: Array<{
      schule: string;
      zeitraum: string;
      grundstellen: number;
      zuschlaege: number;
      stellensoll: number;
    }> = [];

    for (const schule of schulen) {
      const stufen = await getSchulStufenBySchule(schule.id);

      // Zuschlaege einmal pro Schule laden (unabhaengig vom Zeitraum)
      const zuschlaegeRows = await getZuschlaegeBySchuleUndHaushaltsjahr(
        schule.id,
        aktuellesHj.id
      );

      // Fuer beide Zeitraeume berechnen (jan-jul = Vorjahr-Stichtag, aug-dez = laufender Stichtag)
      const zeitraeume = [
        { key: "jan-jul", stichtag: aktuellesHj.stichtagVorjahr },
        { key: "aug-dez", stichtag: aktuellesHj.stichtagLaufend },
      ] as const;

      for (const zr of zeitraeume) {
        if (!zr.stichtag) continue;

        // Schuelerzahlen fuer diesen Stichtag laden
        const zahlen = await getSchuelerzahlenByStichtag(schule.id, zr.stichtag);

        if (zahlen.length === 0) continue;

        // SLR-Validierung: Pruefen ob alle benoetigten SLR-Werte vorhanden und > 0
        const stufenDaten = zahlen.map((z) => ({
          stufe: z.stufe,
          schulformTyp: z.schulformTyp,
          schueler: z.anzahl,
          slr: slrLookup[z.schulformTyp] ?? 0,
        }));

        const fehlendeSLR = stufenDaten.filter((s) => s.slr <= 0);
        if (fehlendeSLR.length > 0) {
          return {
            error: `Fehlende SLR-Werte fuer ${schule.kurzname}: ${fehlendeSLR.map((s) => s.schulformTyp).join(", ")}. Bitte SLR-Konfiguration pruefen.`,
          };
        }

        // Grundstellen berechnen (mit korrekter Truncation!)
        const grundstellenResult = berechneGrundstellen(stufenDaten);

        // F1-Fix: Zuschlaege nach Zeitraum filtern
        // "ganzjahr" gilt immer, sonst nur passender Zeitraum (jan-jul / aug-dez)
        const relevanteZuschlaege = zuschlaegeRows.filter(
          (z) => z.zeitraum === "ganzjahr" || z.zeitraum === zr.key
        );
        const zuschlaegeSumme = relevanteZuschlaege.reduce(
          (acc, z) => acc + Number(z.wert),
          0
        );

        const stellensollWert = grundstellenResult.grundstellenzahl + zuschlaegeSumme;

        // Details fuer JSONB aufbereiten
        const detailsFuerDb = grundstellenResult.teilErgebnisse.map((te) => ({
          stufe: te.stufe,
          schueler: te.schueler,
          slr: te.slr,
          rohErgebnis: te.ergebnisRoh,
          truncErgebnis: te.ergebnisTrunc,
        }));

        // Transaktion: Deaktivieren + Einfuegen atomar
        await db.transaction(async (tx) => {
          // Alte Berechnungen deaktivieren
          await tx
            .update(berechnungStellensoll)
            .set({ istAktuell: false })
            .where(
              and(
                eq(berechnungStellensoll.schuleId, schule.id),
                eq(berechnungStellensoll.haushaltsjahrId, aktuellesHj.id),
                eq(berechnungStellensoll.zeitraum, zr.key)
              )
            );

          // Neue Berechnung speichern
          await tx.insert(berechnungStellensoll).values({
            schuleId: schule.id,
            haushaltsjahrId: aktuellesHj.id,
            zeitraum: zr.key,
            grundstellenDetails: detailsFuerDb,
            grundstellenSumme: String(grundstellenResult.summeTrunc),
            grundstellenGerundet: String(grundstellenResult.grundstellenzahl),
            zuschlaegeSumme: String(zuschlaegeSumme),
            zuschlaege_details: relevanteZuschlaege.map((z) => ({
              bezeichnung: z.bezeichnung,
              wert: Number(z.wert),
              zeitraum: z.zeitraum,
            })),
            stellensoll: String(Math.round(stellensollWert * 10) / 10),
            berechnetVon: session.name,
            istAktuell: true,
          });
        });

        ergebnisse.push({
          schule: schule.kurzname,
          zeitraum: zr.key,
          grundstellen: grundstellenResult.grundstellenzahl,
          zuschlaege: zuschlaegeSumme,
          stellensoll: Math.round(stellensollWert * 10) / 10,
        });
      }

      // Vergleich aktualisieren (Stellensoll vs Stellenist)
      await aktualisiereVergleich(schule.id, aktuellesHj.id);
    }

    // Audit-Log schreiben
    await writeAuditLog("berechnung_stellensoll", 0, "INSERT", null, {
      haushaltsjahrId: aktuellesHj.id,
      anzahlErgebnisse: ergebnisse.length,
      ergebnisse: ergebnisse.map((e) => ({
        schule: e.schule,
        zeitraum: e.zeitraum,
        stellensoll: e.stellensoll,
      })),
    }, session.name);

    revalidatePath("/stellensoll");
    revalidatePath("/dashboard");
    revalidatePath("/vergleich");

    return {
      success: true,
      ergebnisse,
      message: `Stellensoll fuer ${ergebnisse.length} Zeitraeume berechnet.`,
    };
  } catch (err: unknown) {
    console.error("Berechnung fehlgeschlagen:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Berechnung fehlgeschlagen. Bitte erneut versuchen." };
  }
}
