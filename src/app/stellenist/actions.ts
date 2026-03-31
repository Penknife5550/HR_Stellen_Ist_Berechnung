"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { berechnungStellenist } from "@/db/schema";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getDeputatSummenBySchule,
  getMehrarbeitByHaushaltsjahr,
} from "@/lib/db/queries";
import { berechneStellenist } from "@/lib/berechnungen/stellenist";
import { aktualisiereVergleich } from "@/lib/berechnungen/vergleich";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";

// Regelstundendeputat je Schulform (NRW)
// Rechtsgrundlage: § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW
// Grundschulen: 28 Wochenstunden (Pflichtstundenband GS)
// Weiterführende Schulen (GES, GYM, BK): 25,5 Wochenstunden
const REGELDEPUTAT: Record<string, number> = {
  GES: 25.5,
  GYM: 25.5,
  BK: 25.5,
  GSH: 28.0,
  GSM: 28.0,
  GSS: 28.0,
};

export async function berechneStellenisteAction() {
  const session = await requireWriteAccess();
  try {
    const aktuellesHj = await getAktuellesHaushaltsjahr();
    if (!aktuellesHj) return { error: "Kein aktuelles Haushaltsjahr gefunden." };

    const schulen = await getSchulen();

    const ergebnisse: Array<{
      schule: string;
      zeitraum: string;
      stellenist: number;
      mehrarbeit: number;
      gesamt: number;
    }> = [];

    for (const schule of schulen) {
      const regeldeputat = REGELDEPUTAT[schule.kurzname] ?? 25.5;

      // Schulspezifische Deputat-Summen laden:
      // Summiert deputat_ges/gym/bk ueber ALLE Lehrer (nicht nur Stammschule).
      // Damit werden schuluebergreifend eingesetzte Lehrer korrekt zugeordnet.
      const monatsSummen = await getDeputatSummenBySchule(aktuellesHj.id, schule.kurzname);

      if (monatsSummen.length === 0) continue;

      // Mehrarbeit laden
      const mehrarbeitRows = await getMehrarbeitByHaushaltsjahr(aktuellesHj.id, schule.id);

      // Schulspezifische Stunden verwenden (deputat_ges fuer GES, deputat_gym fuer GYM, etc.)
      const libResult = berechneStellenist({
        monatlicheStunden: monatsSummen.map((m) => ({
          monat: m.monat,
          stunden: Number(
            "summeSchulspezifisch" in m
              ? (m.summeSchulspezifisch ?? 0)
              : (m.summeGesamt ?? 0)
          ),
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
              monateImZeitraum: monateImZeitraum.map((m) => ({
                monat: m.monat,
                summeWochenstunden: Number(
                  "summeSchulspezifisch" in m
                    ? (m.summeSchulspezifisch ?? 0)
                    : (m.summeGesamt ?? 0)
                ),
                anzahlLehrer: m.anzahlLehrer,
              })),
              mehrarbeitStunden,
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
