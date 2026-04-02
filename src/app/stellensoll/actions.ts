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
  getAktuellesHaushaltsjahr,
  getHaushaltsjahrById,
  getAlleAktivenSchulStufen,
  getAlleSchuelerzahlenByStichtage,
  getAlleZuschlaegeByHaushaltsjahr,
  getAlleGenehmigteStellenanteileByHj,
} from "@/lib/db/queries";
import { getSlrWerteBySchuljahr, getAktuellesSchuljahr } from "@/lib/db/queries";
import { berechneGrundstellen } from "@/lib/berechnungen/grundstellen";
import { aktualisiereVergleich } from "@/lib/berechnungen/vergleich";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";

export async function berechneStellensollAction(haushaltsjahrId?: number) {
  const session = await requireWriteAccess();
  try {
    const aktuellesHj = haushaltsjahrId
      ? await getHaushaltsjahrById(haushaltsjahrId)
      : await getAktuellesHaushaltsjahr();
    if (!aktuellesHj) return { error: "Haushaltsjahr nicht gefunden." };

    const aktuellesSj = await getAktuellesSchuljahr();
    if (!aktuellesSj) return { error: "Kein aktuelles Schuljahr gefunden." };

    const schulen = await getSchulen();
    const slrWerte = await getSlrWerteBySchuljahr(aktuellesSj.id);

    // SLR als Lookup: schulformTyp → relation
    const slrLookup: Record<string, number> = {};
    for (const slr of slrWerte) {
      slrLookup[slr.schulformTyp] = Number(slr.relation);
    }

    // Batch-Loading: Alle Daten VOR der Schleife laden (vermeidet N+1 Queries)
    const stichtage = [aktuellesHj.stichtagVorjahr, aktuellesHj.stichtagLaufend].filter(
      (s): s is string => s !== null && s !== undefined
    );

    const [alleSchulStufen, alleSchuelerzahlen, alleZuschlaege, alleStellenanteile] = await Promise.all([
      getAlleAktivenSchulStufen(),
      getAlleSchuelerzahlenByStichtage(stichtage),
      getAlleZuschlaegeByHaushaltsjahr(aktuellesHj.id),
      getAlleGenehmigteStellenanteileByHj(aktuellesHj.id),
    ]);

    // Lookup-Maps fuer schnellen Zugriff
    const stufenBySchule = new Map<number, typeof alleSchulStufen>();
    for (const stufe of alleSchulStufen) {
      const arr = stufenBySchule.get(stufe.schuleId) ?? [];
      arr.push(stufe);
      stufenBySchule.set(stufe.schuleId, arr);
    }

    // schuelerzahlen nach schuleId+stichtag gruppieren
    const zahlenBySchuleStichtag = new Map<string, typeof alleSchuelerzahlen>();
    for (const z of alleSchuelerzahlen) {
      const key = `${z.schuleId}_${z.stichtag}`;
      const arr = zahlenBySchuleStichtag.get(key) ?? [];
      arr.push(z);
      zahlenBySchuleStichtag.set(key, arr);
    }

    // Stellenanteile nach schuleId gruppieren (Query filtert bereits auf genehmigt)
    const stellenanteileBySchule = new Map<number, typeof alleStellenanteile>();
    for (const sa of alleStellenanteile) {
      const arr = stellenanteileBySchule.get(sa.schuleId) ?? [];
      arr.push(sa);
      stellenanteileBySchule.set(sa.schuleId, arr);
    }

    // Fallback: alte zuschlaege nach schuleId (nur fuer Schulen ohne Stellenanteile)
    const zuschlaegeBySchule = new Map<number, typeof alleZuschlaege>();
    for (const z of alleZuschlaege) {
      const arr = zuschlaegeBySchule.get(z.schuleId) ?? [];
      arr.push(z);
      zuschlaegeBySchule.set(z.schuleId, arr);
    }

    const ergebnisse: Array<{
      schule: string;
      zeitraum: string;
      grundstellen: number;
      zuschlaege: number;
      stellensoll: number;
    }> = [];
    const fehlerListe: Array<{ schule: string; details: string }> = [];

    for (const schule of schulen) {
      const stufen = stufenBySchule.get(schule.id) ?? [];

      // Dual-Source: Wenn Stellenanteile vorhanden → nutzen, sonst Fallback auf alte Zuschlaege
      const hatStellenanteile = stellenanteileBySchule.has(schule.id);
      const stellenanteileRows = stellenanteileBySchule.get(schule.id) ?? [];
      const zuschlaegeRows = zuschlaegeBySchule.get(schule.id) ?? [];

      // Fuer beide Zeitraeume berechnen (jan-jul = Vorjahr-Stichtag, aug-dez = laufender Stichtag)
      const zeitraeume = [
        { key: "jan-jul", stichtag: aktuellesHj.stichtagVorjahr },
        { key: "aug-dez", stichtag: aktuellesHj.stichtagLaufend },
      ] as const;

      let schuleHatFehler = false;

      for (const zr of zeitraeume) {
        if (!zr.stichtag) continue;

        // Schuelerzahlen aus vorgeladenem Lookup
        const zahlen = zahlenBySchuleStichtag.get(`${schule.id}_${zr.stichtag}`) ?? [];

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
          fehlerListe.push({
            schule: schule.kurzname,
            details: `Fehlende SLR-Werte: ${fehlendeSLR.map((s) => s.schulformTyp).join(", ")}`,
          });
          schuleHatFehler = true;
          continue; // Diesen Zeitraum ueberspringen, naechsten versuchen
        }

        // Grundstellen berechnen (mit korrekter Truncation!)
        const grundstellenResult = berechneGrundstellen(stufenDaten);

        // Zuschlaege/Stellenanteile nach Zeitraum filtern
        // "ganzjahr" gilt immer, sonst nur passender Zeitraum (jan-jul / aug-dez)
        let zuschlaegeSumme: number;
        let zuschlagDetailsForDb: Array<Record<string, unknown>>;

        if (hatStellenanteile) {
          // Neue Quelle: stellenanteile (nur genehmigt, bereits gefiltert)
          const relevante = stellenanteileRows.filter(
            (sa) => sa.zeitraum === "ganzjahr" || sa.zeitraum === zr.key
          );

          // Drei-Gruppen-Logik: Nur deputatswirksame Stellenanteile ins Stellensoll
          // Typ A + A_106: immer (wert = Stellen)
          // Typ B mit wahlrecht="stelle": ja (wert = Stellen)
          // Typ B mit wahlrecht="geld": NEIN (nur EUR-Betrag, kein Stellensoll-Effekt)
          // Typ C: NEIN (reine Geldleistung, kein Stellensoll-Effekt)
          const deputatswirksam = relevante.filter((sa) => {
            const typ = sa.stellenartTyp;
            if (typ === "A" || typ === "A_106") return true;
            if (typ === "B" && sa.wahlrecht === "stelle") return true;
            return false;
          });

          zuschlaegeSumme = deputatswirksam.reduce((acc, sa) => acc + Number(sa.wert), 0);

          // Alle relevanten Stellenanteile in Details speichern (auch Geld/C fuer Transparenz)
          zuschlagDetailsForDb = relevante.map((sa) => ({
            id: sa.id,
            bezeichnung: sa.stellenartBezeichnung,
            kuerzel: sa.stellenartKuerzel,
            typ: sa.stellenartTyp,
            wert: Number(sa.wert),
            eurBetrag: sa.eurBetrag ? Number(sa.eurBetrag) : null,
            wahlrecht: sa.wahlrecht,
            zeitraum: sa.zeitraum,
            lehrerId: sa.lehrerId,
            lehrerName: sa.lehrerName,
            aktenzeichen: sa.aktenzeichen,
            istIsoliert: sa.istIsoliert,
            anlage2a: sa.anlage2a,
            erhoehtPauschale: sa.erhoehtPauschale,
            istDeputatswirksam: deputatswirksam.some((d) => d.id === sa.id),
          }));
        } else {
          // Fallback: alte zuschlaege-Tabelle
          const relevanteZuschlaege = zuschlaegeRows.filter(
            (z) => z.zeitraum === "ganzjahr" || z.zeitraum === zr.key
          );
          zuschlaegeSumme = relevanteZuschlaege.reduce(
            (acc, z) => acc + Number(z.wert),
            0
          );
          zuschlagDetailsForDb = relevanteZuschlaege.map((z) => ({
            bezeichnung: z.bezeichnung,
            wert: Number(z.wert),
            zeitraum: z.zeitraum,
          }));
        }

        const stellensollWert = grundstellenResult.grundstellenzahl + zuschlaegeSumme;

        // Grundstellen-Details fuer JSONB
        const detailsFuerDb = grundstellenResult.teilErgebnisse.map((te) => ({
          stufe: te.stufe,
          schueler: te.schueler,
          slr: te.slr,
          rohErgebnis: te.ergebnisRoh,
          truncErgebnis: te.ergebnisTrunc,
        }));

        // Transaktion: Deaktivieren + Einfuegen atomar
        await db.transaction(async (tx) => {
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

          await tx.insert(berechnungStellensoll).values({
            schuleId: schule.id,
            haushaltsjahrId: aktuellesHj.id,
            zeitraum: zr.key,
            grundstellenDetails: detailsFuerDb,
            grundstellenSumme: String(grundstellenResult.summeTrunc),
            grundstellenGerundet: String(grundstellenResult.grundstellenzahl),
            zuschlaegeSumme: String(zuschlaegeSumme),
            zuschlaege_details: zuschlagDetailsForDb,
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

      // Vergleich nur aktualisieren wenn Schule keine Fehler hatte
      if (!schuleHatFehler) {
        await aktualisiereVergleich(schule.id, aktuellesHj.id);
      }
    }

    // Audit-Log schreiben
    await writeAuditLog("berechnung_stellensoll", 0, "INSERT", null, {
      haushaltsjahrId: aktuellesHj.id,
      anzahlErgebnisse: ergebnisse.length,
      anzahlFehler: fehlerListe.length,
      ergebnisse: ergebnisse.map((e) => ({
        schule: e.schule,
        zeitraum: e.zeitraum,
        stellensoll: e.stellensoll,
      })),
      fehler: fehlerListe,
    }, session.name);

    revalidatePath("/stellensoll");
    revalidatePath("/dashboard");
    revalidatePath("/vergleich");

    // Zusammenfassung mit Erfolgen und Fehlern zurueckgeben
    if (fehlerListe.length > 0 && ergebnisse.length === 0) {
      return {
        error: `Berechnung fuer alle Schulen fehlgeschlagen. ${fehlerListe.map((f) => `${f.schule}: ${f.details}`).join("; ")}. Bitte SLR-Konfiguration pruefen.`,
      };
    }

    return {
      success: true,
      ergebnisse,
      fehler: fehlerListe.length > 0 ? fehlerListe : undefined,
      message: `Stellensoll fuer ${ergebnisse.length} Zeitraeume berechnet.`
        + (fehlerListe.length > 0
          ? ` ${fehlerListe.length} Fehler: ${fehlerListe.map((f) => f.schule).join(", ")}.`
          : ""),
    };
  } catch (err: unknown) {
    console.error("Berechnung fehlgeschlagen:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Berechnung fehlgeschlagen. Bitte erneut versuchen." };
  }
}
