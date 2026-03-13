"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  berechnungStellensoll,
} from "@/db/schema";
import {
  getSchulen,
  getSchulStufenBySchule,
  getSchuelerzahlenByStichtag,
  getAktuellesHaushaltsjahr,
  getHaushaltsjahrById,
  getZuschlaegeBySchuleUndHaushaltsjahr,
  getAllPflichtstunden,
} from "@/lib/db/queries";
import { getSlrWerteBySchuljahr, getSchuljahrByBezeichnung } from "@/lib/db/queries";
import { berechneGrundstellen } from "@/lib/berechnungen/grundstellen";
import { aktualisiereVergleich } from "@/lib/berechnungen/vergleich";
import { roundToDecimals } from "@/lib/berechnungen/rounding";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";

export async function berechneStellensollAction(haushaltsjahrId?: number) {
  const session = await requireWriteAccess();
  try {
    // Haushaltsjahr laden: entweder per ID oder das aktuelle
    const aktuellesHj = haushaltsjahrId
      ? await getHaushaltsjahrById(haushaltsjahrId)
      : await getAktuellesHaushaltsjahr();
    if (!aktuellesHj) return { error: "Kein Haushaltsjahr gefunden." };

    // Sperre pruefen: Gesperrte Haushaltsjahre duerfen nicht veraendert werden
    if (aktuellesHj.gesperrt) {
      return { error: `Haushaltsjahr ${aktuellesHj.jahr} ist gesperrt. Keine Aenderungen moeglich.` };
    }

    // Zugehoeriges Schuljahr ermitteln: HJ 2026 → SJ "2025/2026"
    const sjBezeichnung = `${aktuellesHj.jahr - 1}/${aktuellesHj.jahr}`;
    const aktuellesSj = await getSchuljahrByBezeichnung(sjBezeichnung);
    if (!aktuellesSj) return { error: `Kein Schuljahr "${sjBezeichnung}" gefunden. Bitte in den Einstellungen anlegen.` };

    const schulen = await getSchulen();
    const slrWerte = await getSlrWerteBySchuljahr(aktuellesSj.id);

    // SLR als Lookup: schulformTyp → relation
    const slrLookup: Record<string, number> = {};
    for (const slr of slrWerte) {
      slrLookup[slr.schulformTyp] = Number(slr.relation);
    }

    // Pflichtstunden als Lookup: schulform → vollzeitDeputat
    // Umrechnung VZAe → Deputatsstunden gem. BASS 11-11 Nr. 1, § 2 Abs. 1, Tabelle 2
    const pflichtstundenRows = await getAllPflichtstunden();
    const pflichtstundenLookup: Record<string, number> = {};
    for (const ps of pflichtstundenRows) {
      pflichtstundenLookup[ps.schulform] = Number(ps.vollzeitDeputat);
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
      // AUFBAUSCHULEN (VV zu § 3 FESchVO): Immer laufendes Jahr verwenden, auch fuer Jan-Jul
      const zeitraeume = schule.istImAufbau
        ? [
            { key: "jan-jul" as const, stichtag: aktuellesHj.stichtagLaufend },
            { key: "aug-dez" as const, stichtag: aktuellesHj.stichtagLaufend },
          ]
        : [
            { key: "jan-jul" as const, stichtag: aktuellesHj.stichtagVorjahr },
            { key: "aug-dez" as const, stichtag: aktuellesHj.stichtagLaufend },
          ];

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

          // Deputatsstundenrahmen: Grundstellen x Vollzeitdeputat
          // gem. BASS 11-11 Nr. 1, § 2 Abs. 1, Tabelle 2
          const vzDeputat = pflichtstundenLookup[schule.schulform] ?? null;
          const depStundenrahmen = vzDeputat !== null
            ? roundToDecimals(grundstellenResult.grundstellenzahl * vzDeputat, 1)
            : null;

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
            stellensoll: String(roundToDecimals(stellensollWert, 1)),
            vollzeitDeputat: vzDeputat !== null ? String(vzDeputat) : null,
            deputatstundenrahmen: depStundenrahmen !== null ? String(depStundenrahmen) : null,
            berechnetVon: session.name,
            istAktuell: true,
          });
        });

        ergebnisse.push({
          schule: schule.kurzname,
          zeitraum: zr.key,
          grundstellen: grundstellenResult.grundstellenzahl,
          zuschlaege: zuschlaegeSumme,
          stellensoll: roundToDecimals(stellensollWert, 1),
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
