"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { berechnungStellenist } from "@/db/schema";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getHaushaltsjahrById,
  getDeputatSummenBySchule,
  getMehrarbeitByHaushaltsjahr,
  getRegeldeputateMap,
  getAenderungenMitDatum,
} from "@/lib/db/queries";
import { berechneStellenist } from "@/lib/berechnungen/stellenist";
import { aktualisiereVergleich } from "@/lib/berechnungen/vergleich";
import { berechneTagesgenauKorrekturen, type TagesgenauAenderung } from "@/lib/berechnungen/tagesgenau";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";

export async function berechneStellenisteAction(haushaltsjahrId?: number) {
  const session = await requireWriteAccess();
  try {
    const aktuellesHj = haushaltsjahrId
      ? await getHaushaltsjahrById(haushaltsjahrId)
      : await getAktuellesHaushaltsjahr();
    if (!aktuellesHj) return { error: "Haushaltsjahr nicht gefunden." };

    const [schulen, regeldeputateMap, alleAenderungen] = await Promise.all([
      getSchulen(),
      getRegeldeputateMap(),
      getAenderungenMitDatum(aktuellesHj.id),
    ]);

    // Tagesgenaue Korrekturen vorbereiten
    // Aenderungen in das Format fuer berechneTagesgenauKorrekturen umwandeln
    const tagesgenauInput: TagesgenauAenderung[] = alleAenderungen.map((a) => {
      // Tag im Monat aus dem tatsaechlichen Datum extrahieren
      const datum = a.tatsaechlichesDatum!; // IS NOT NULL in Query
      const tag = new Date(datum + "T00:00:00").getDate();
      const monatsTage = new Date(aktuellesHj.jahr, a.monat, 0).getDate();
      return {
        lehrerId: a.lehrerId,
        monat: a.monat,
        altGesamt: Number(a.deputatGesamtAlt ?? 0),
        altGes: Number(a.deputatGesAlt ?? 0),
        altGym: Number(a.deputatGymAlt ?? 0),
        altBk: Number(a.deputatBkAlt ?? 0),
        neuGesamt: Number(a.deputatGesamtNeu ?? 0),
        neuGes: Number(a.deputatGesNeu ?? 0),
        neuGym: Number(a.deputatGymNeu ?? 0),
        neuBk: Number(a.deputatBkNeu ?? 0),
        aenderungTag: tag,
        monatsTage,
        stammschuleCode: a.stammschuleCode,
      };
    });

    const ergebnisse: Array<{
      schule: string;
      zeitraum: string;
      stellenist: number;
      mehrarbeit: number;
      gesamt: number;
    }> = [];

    for (const schule of schulen) {
      const regeldeputat = regeldeputateMap.get(schule.kurzname);
      if (regeldeputat === undefined) {
        console.warn(`Kein Regeldeputat fuer Schulform "${schule.kurzname}" in DB konfiguriert. Schule wird uebersprungen.`);
        continue;
      }

      const [monatsSummen, mehrarbeitRows] = await Promise.all([
        getDeputatSummenBySchule(aktuellesHj.id, schule.kurzname),
        getMehrarbeitByHaushaltsjahr(aktuellesHj.id, schule.id),
      ]);

      if (monatsSummen.length === 0) continue;

      // Tagesgenaue Korrekturen fuer diese Schule berechnen
      const korrekturen = berechneTagesgenauKorrekturen(
        tagesgenauInput,
        schule.kurzname,
        aktuellesHj.jahr,
      );
      const korrekturByMonat = new Map(korrekturen.map((k) => [k.monat, k.differenzSchulspezifisch]));

      // Schulspezifische Stunden + tagesgenaue Korrektur
      const libResult = berechneStellenist({
        monatlicheStunden: monatsSummen.map((m) => ({
          monat: m.monat,
          stunden: Number(m.summeSchulspezifisch ?? 0) + (korrekturByMonat.get(m.monat) ?? 0),
        })),
        regeldeputat,
        mehrarbeitStunden: mehrarbeitRows.map((m) => ({
          monat: m.monat,
          stunden: Number(m.stunden),
        })),
      });

      // Per-Zeitraum Details fuer DB-Speicherung aufbereiten
      const zeitraumDaten = [
        {
          key: "jan-jul" as const,
          zr: libResult.janJul,
          mehrarbeit: libResult.mehrarbeitStellen.janJul,
          gesamt: libResult.gesamtStellen.janJul,
          monate: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          key: "aug-dez" as const,
          zr: libResult.augDez,
          mehrarbeit: libResult.mehrarbeitStellen.augDez,
          gesamt: libResult.gesamtStellen.augDez,
          monate: [8, 9, 10, 11, 12],
        },
      ];

      for (const zd of zeitraumDaten) {
        // Nur speichern wenn Daten fuer diesen Zeitraum vorhanden
        const monateImZeitraum = monatsSummen.filter((m) =>
          zd.monate.includes(m.monat)
        );
        if (monateImZeitraum.length === 0) continue;

        const mehrarbeitImZr = mehrarbeitRows.filter((m) =>
          zd.monate.includes(m.monat)
        );
        const mehrarbeitStunden = mehrarbeitImZr.reduce(
          (acc, m) => acc + Number(m.stunden),
          0
        );

        // Gerundete Werte fuer DB-Speicherung
        const stellenistGerundet = Math.round(zd.zr.stellen * 10) / 10;
        const mehrarbeitStellenGerundet = Math.round(zd.mehrarbeit * 10000) / 10000;
        const gesamtStellen = Math.round((stellenistGerundet + mehrarbeitStellenGerundet) * 10) / 10;

        // Transaktion: Deaktivieren + Einfuegen atomar
        await db.transaction(async (tx) => {
          // Alte Berechnungen deaktivieren
          await tx
            .update(berechnungStellenist)
            .set({ istAktuell: false })
            .where(
              and(
                eq(berechnungStellenist.schuleId, schule.id),
                eq(berechnungStellenist.haushaltsjahrId, aktuellesHj.id),
                eq(berechnungStellenist.zeitraum, zd.key)
              )
            );

          // Neue Berechnung speichern
          await tx.insert(berechnungStellenist).values({
            schuleId: schule.id,
            haushaltsjahrId: aktuellesHj.id,
            zeitraum: zd.key,
            monatsDurchschnittStunden: String(Math.round(zd.zr.monatsDurchschnitt * 100) / 100),
            regelstundendeputat: String(regeldeputat),
            stellenist: String(Math.round(zd.zr.stellen * 10000) / 10000),
            stellenistGerundet: String(stellenistGerundet),
            mehrarbeitStellen: String(mehrarbeitStellenGerundet),
            stellenistGesamt: String(gesamtStellen),
            details: {
              monateImZeitraum: monateImZeitraum.map((m) => {
                const korrektur = korrekturByMonat.get(m.monat) ?? 0;
                const pauschal = Number(m.summeSchulspezifisch ?? 0);
                return {
                  monat: m.monat,
                  summeWochenstunden: pauschal + korrektur,
                  summeWochenstundenPauschal: pauschal,
                  tagesgenauKorrektur: Math.abs(korrektur) > 0.001 ? Math.round(korrektur * 1000) / 1000 : 0,
                  anzahlLehrer: m.anzahlLehrer,
                };
              }),
              mehrarbeitStunden,
              hatTagesgenauKorrekturen: korrekturen.length > 0,
            },
            berechnetVon: session.name,
            istAktuell: true,
          });
        });

        ergebnisse.push({
          schule: schule.kurzname,
          zeitraum: zd.key,
          stellenist: stellenistGerundet,
          mehrarbeit: mehrarbeitStellenGerundet,
          gesamt: gesamtStellen,
        });
      }

      // Vergleich aktualisieren (gemeinsame Funktion mit gewichtetem Durchschnitt)
      await aktualisiereVergleich(schule.id, aktuellesHj.id);
    }

    // Audit-Log schreiben
    await writeAuditLog("berechnung_stellenist", 0, "INSERT", null, {
      haushaltsjahrId: aktuellesHj.id,
      anzahlErgebnisse: ergebnisse.length,
      ergebnisse: ergebnisse.map((e) => ({
        schule: e.schule,
        zeitraum: e.zeitraum,
        gesamt: e.gesamt,
      })),
    }, session.name);

    revalidatePath("/stellenist");
    revalidatePath("/dashboard");
    revalidatePath("/vergleich");
    revalidatePath("/historie");

    return {
      success: true,
      ergebnisse,
      message: `Stellenist fuer ${ergebnisse.length} Zeitraeume berechnet.`,
    };
  } catch (err: unknown) {
    console.error("Stellenist-Berechnung fehlgeschlagen:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Berechnung fehlgeschlagen. Bitte erneut versuchen." };
  }
}
