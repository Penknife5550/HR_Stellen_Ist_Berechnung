"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { berechnungStellenist } from "@/db/schema";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getHaushaltsjahrById,
  getDeputatSummenBySchuleTagesgenau,
  getMehrarbeitByHaushaltsjahr,
  getRegeldeputateMap,
  getStellenistDrilldownByLehrer,
} from "@/lib/db/queries";
import { berechneStellenist } from "@/lib/berechnungen/stellenist";
import { aktualisiereVergleich } from "@/lib/berechnungen/vergleich";
import { writeAuditLog } from "@/lib/audit";
import { requireRole, requireWriteAccess } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";

const ZEITRAUM_MONATE = {
  "aug-dez": [8, 9, 10, 11, 12],
  "jan-jul": [1, 2, 3, 4, 5, 6, 7],
} as const;
type ZeitraumKey = keyof typeof ZEITRAUM_MONATE;

/**
 * Stellen-IST-Berechnung im Periodenmodell (v0.7+).
 *
 * Datenquelle ist die View v_deputat_monat_tagesgenau, die alle Wertwechsel
 * im Monat tagesgewichtet auswertet — inklusive Sachbearbeiter-Korrekturen
 * fuer das tatsaechliche Wirksamkeitsdatum (deputat_aenderung_korrekturen).
 *
 * Die frueher noetige nachgelagerte Korrektur ueber berechneTagesgenauKorrekturen
 * entfaellt damit komplett — die Schul-Monatssummen sind bereits korrekt.
 */
export async function berechneStellenisteAction(haushaltsjahrId?: number) {
  const session = await requireWriteAccess();
  try {
    const aktuellesHj = haushaltsjahrId
      ? await getHaushaltsjahrById(haushaltsjahrId)
      : await getAktuellesHaushaltsjahr();
    if (!aktuellesHj) return { error: "Haushaltsjahr nicht gefunden." };

    const [schulen, regeldeputateMap] = await Promise.all([
      getSchulen(),
      getRegeldeputateMap(),
    ]);

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
        getDeputatSummenBySchuleTagesgenau(aktuellesHj.id, schule.kurzname),
        getMehrarbeitByHaushaltsjahr(aktuellesHj.id, schule.id),
      ]);

      if (monatsSummen.length === 0) continue;

      // Mehrarbeit aufteilen: Lehrer-bezogene (Stunden) vs. schulweite (Stellenanteile)
      const mehrarbeitStunden = mehrarbeitRows
        .filter((m) => m.lehrerId !== null)
        .map((m) => ({ monat: m.monat, stunden: Number(m.stunden) }));
      const mehrarbeitStellen = mehrarbeitRows
        .filter((m) => m.lehrerId === null && m.stellenanteil !== null)
        .map((m) => ({ monat: m.monat, stellen: Number(m.stellenanteil) }));

      // Schulspezifische Stunden direkt aus der tagesgenauen View
      const libResult = berechneStellenist({
        monatlicheStunden: monatsSummen.map((m) => ({
          monat: m.monat,
          stunden: Number(m.summeSchulspezifisch ?? 0),
        })),
        regeldeputat,
        mehrarbeitStunden,
        mehrarbeitStellen,
      });

      const hatTagesgenauKorrekturen = monatsSummen.some((m) => m.enthaeltKorrektur);

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
        const mehrarbeitStundenSumme = mehrarbeitImZr
          .filter((m) => m.lehrerId !== null)
          .reduce((acc, m) => acc + Number(m.stunden), 0);
        const mehrarbeitStellenSumme = mehrarbeitImZr
          .filter((m) => m.lehrerId === null && m.stellenanteil !== null)
          .reduce((acc, m) => acc + Number(m.stellenanteil), 0);

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
              modell: "periodenmodell-v0.7",
              monateImZeitraum: monateImZeitraum.map((m) => ({
                monat: m.monat,
                summeWochenstunden: Number(m.summeSchulspezifisch ?? 0),
                anzahlLehrer: m.anzahlLehrer,
                enthaeltKorrektur: m.enthaeltKorrektur,
              })),
              mehrarbeitStunden: mehrarbeitStundenSumme,
              mehrarbeitStellenanteile: mehrarbeitStellenSumme,
              hatTagesgenauKorrekturen,
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
      modell: "periodenmodell-v0.7",
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
      message: `Stellenist fuer ${ergebnisse.length} Zeitraeume berechnet (Periodenmodell, tagesgenau).`,
    };
  } catch (err: unknown) {
    console.error("Stellenist-Berechnung fehlgeschlagen:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Berechnung fehlgeschlagen. Bitte erneut versuchen." };
  }
}

/**
 * Drilldown fuer eine Stellenist-Karte: Zeigt pro Lehrer die tagesgenauen
 * Wochenstunden je Monat im gewaehlten Zeitraum, plus separater Mehrarbeit-Block.
 *
 * Datenquelle ist v_deputat_monat_tagesgenau (gleiche View wie das Karten-Aggregat),
 * damit Drilldown-Summen by construction stimmen.
 */
export async function getStellenistDrilldownAction(
  schuleKurzname: string,
  haushaltsjahrId: number,
  zeitraum: ZeitraumKey,
) {
  // DSGVO: Drilldown enthaelt Lehrer-Klartextnamen + Stundenraster (PII).
  // Konsistent mit dem CSV-Export: nur Mitarbeiter-Rolle und hoeher.
  await requireRole("mitarbeiter");
  try {
    const monate: number[] = [...ZEITRAUM_MONATE[zeitraum]];
    if (!monate || monate.length === 0) {
      return { error: "Ungueltiger Zeitraum." };
    }

    const [hj, regelMap, schulen] = await Promise.all([
      getHaushaltsjahrById(haushaltsjahrId),
      getRegeldeputateMap(),
      getSchulen(),
    ]);
    if (!hj) return { error: "Haushaltsjahr nicht gefunden." };

    const schule = schulen.find((s) => s.kurzname === schuleKurzname);
    if (!schule) return { error: "Schule nicht gefunden." };

    const regeldeputat = regelMap.get(schuleKurzname);
    if (regeldeputat === undefined) return { error: "Regeldeputat fehlt." };

    const [lehrerRows, mehrarbeitAlle] = await Promise.all([
      getStellenistDrilldownByLehrer(haushaltsjahrId, schuleKurzname, monate),
      getMehrarbeitByHaushaltsjahr(haushaltsjahrId, schule.id),
    ]);

    // Lehrer-Aggregation: pro Lehrer Map<monat, stunden> + Korrektur-Set + Summe
    type LehrerAgg = {
      lehrerId: number;
      vollname: string;
      stammschuleCode: string | null;
      stundenProMonat: Record<number, number>;
      korrekturMonate: number[];
      summeStunden: number;
    };
    const lehrerMap = new Map<number, LehrerAgg>();
    for (const r of lehrerRows) {
      let agg = lehrerMap.get(r.lehrerId);
      if (!agg) {
        agg = {
          lehrerId: r.lehrerId,
          vollname: r.vollname,
          stammschuleCode: r.stammschuleCode,
          stundenProMonat: {},
          korrekturMonate: [],
          summeStunden: 0,
        };
        lehrerMap.set(r.lehrerId, agg);
      }
      const ws = Number(r.wochenstunden);
      agg.stundenProMonat[r.monat] = ws;
      agg.summeStunden += ws;
      if (r.enthaeltKorrektur) agg.korrekturMonate.push(r.monat);
    }

    // Stellen-Anteil pro Lehrer = (durchschnittliche WS im Zeitraum) / regeldeputat
    const lehrer = Array.from(lehrerMap.values())
      .map((l) => {
        const durchschnitt = l.summeStunden / monate.length;
        return {
          ...l,
          durchschnittWS: Math.round(durchschnitt * 100) / 100,
          stellenAnteil: Math.round((durchschnitt / regeldeputat) * 10000) / 10000,
        };
      })
      .sort((a, b) => b.summeStunden - a.summeStunden);

    // Mehrarbeit aufteilen
    const mehrarbeitImZr = mehrarbeitAlle.filter((m) => monate.includes(m.monat));
    const mehrarbeitLehrerMap = new Map<
      number,
      { lehrerId: number; vollname: string; summeStunden: number }
    >();
    for (const m of mehrarbeitImZr) {
      if (m.lehrerId === null) continue;
      const std = Number(m.stunden ?? 0);
      if (std === 0) continue;
      const ex = mehrarbeitLehrerMap.get(m.lehrerId);
      if (ex) ex.summeStunden += std;
      else
        mehrarbeitLehrerMap.set(m.lehrerId, {
          lehrerId: m.lehrerId,
          vollname: m.lehrerName ?? "—",
          summeStunden: std,
        });
    }
    const mehrarbeitLehrer = Array.from(mehrarbeitLehrerMap.values())
      .map((m) => ({
        ...m,
        // Mehrarbeit-Stunden sind Jahresstunden (nicht Wochenstunden) → Stellenanteil
        // = stunden / (regeldeputat * 40 Wochen). Wir richten uns hier nach dem
        // bestehenden Modell aus berechneStellenist: stellen = stunden / regeldeputat / monateImZeitraum.length
        stellenAnteil:
          Math.round(((m.summeStunden / regeldeputat) / monate.length) * 10000) / 10000,
      }))
      .sort((a, b) => b.summeStunden - a.summeStunden);

    // Schulweite Mehrarbeit: durch Anzahl Monate teilen — die Hauptberechnung
    // in lib/berechnungen/stellenist.ts mittelt die monatlichen Stellenanteile
    // ueber die Monate des Zeitraums. Sonst Faktor 5/7 zuviel im Drilldown.
    const mehrarbeitSchuleStellenSumme = mehrarbeitImZr
      .filter((m) => m.lehrerId === null && m.stellenanteil !== null)
      .reduce((acc, m) => acc + Number(m.stellenanteil ?? 0), 0);
    const mehrarbeitSchuleStellen = mehrarbeitSchuleStellenSumme / monate.length;

    // Gesamtsummen fuer Plausibilitaetsabgleich mit der Karte
    const summeStundenGesamt = lehrer.reduce((acc, l) => acc + l.summeStunden, 0);
    const durchschnittGesamt = summeStundenGesamt / monate.length;
    const stellenAusStunden = durchschnittGesamt / regeldeputat;
    const mehrarbeitStellenSumme =
      mehrarbeitLehrer.reduce((acc, m) => acc + m.stellenAnteil, 0) + mehrarbeitSchuleStellen;
    const gesamtStellen = stellenAusStunden + mehrarbeitStellenSumme;

    return {
      success: true,
      data: {
        schuleKurzname,
        zeitraum,
        monate,
        regeldeputat,
        lehrer,
        mehrarbeitLehrer,
        mehrarbeitSchuleStellen: Math.round(mehrarbeitSchuleStellen * 10000) / 10000,
        summen: {
          stunden: Math.round(summeStundenGesamt * 100) / 100,
          durchschnittWS: Math.round(durchschnittGesamt * 100) / 100,
          stellenAusStunden: Math.round(stellenAusStunden * 10000) / 10000,
          mehrarbeitStellen: Math.round(mehrarbeitStellenSumme * 10000) / 10000,
          gesamt: Math.round(gesamtStellen * 10000) / 10000,
        },
      },
    };
  } catch (err) {
    console.error("Drilldown fehlgeschlagen:", err);
    return { error: "Drilldown fehlgeschlagen." };
  }
}
