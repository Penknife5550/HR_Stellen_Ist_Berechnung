/**
 * POST /api/deputate/sync
 *
 * Empfaengt Lehrer-/Deputatsdaten von n8n Workflow #223.
 * Dieser Endpoint ist die Bruecke zwischen Untis und der Webanwendung.
 *
 * Ablauf:
 * 1. API-Key validieren (timing-safe)
 * 2. Payload mit Zod validieren
 * 3. Lehrer upserten (Match auf untis_teacher_id)
 * 4. Term-Datumsbereich auf Monate mappen
 * 5. Deputat-Monatsdaten upserten (pro Monat ins korrekte Haushaltsjahr!)
 * 6. Sync-Log schreiben
 *
 * WICHTIG: Das Haushaltsjahr wird pro Monat aus dem Kalenderjahr des Monats
 * bestimmt — NICHT aus dem Sync-Datum. Ein Term von Aug 2024 bis Feb 2025
 * schreibt Aug-Dez nach HJ 2024 und Jan-Feb nach HJ 2025.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { syncPayloadSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { authenticateWebhook } from "@/lib/webhookAuth";
import { notify } from "@/lib/notifications";
import { germanDateToIso, neuePeriodeGewinnt } from "@/lib/periodCoverage";
import { normalizeStatistikCode, detectStatistikCodeChange } from "@/lib/statistikCode";

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Konstante Zeit erzwingen
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Parsed deutsches Datum "DD.MM.YYYY" zu Date.
 */
function parseGermanDate(dateStr: string): Date | null {
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

/**
 * Ermittelt alle Monate in einem Datumsbereich.
 * Jeder Monat traegt sein korrektes Kalenderjahr.
 */
function getMonthsInRange(
  dateFrom: string,
  dateTo: string
): Array<{ jahr: number; monat: number }> {
  const start = parseGermanDate(dateFrom);
  const end = parseGermanDate(dateTo);
  if (!start || !end) return [];

  const months: Array<{ jahr: number; monat: number }> = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);

  while (current <= end) {
    months.push({
      jahr: current.getFullYear(),
      monat: current.getMonth() + 1,
    });
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Payload parsen
    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Ungueltiges JSON im Request-Body." },
        { status: 400 }
      );
    }

    // 2. Zod-Validierung
    const parsed = syncPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabedaten.";
      return NextResponse.json(
        { error: `Validierungsfehler: ${firstError}` },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    // 3. API-Key validieren (gegen webhook_configs in DB)
    // Bootstrap-Fallback auf ENV-Key NUR solange noch nie ein webhook_configs-
    // Eintrag angelegt wurde (auch inaktive/geloeschte zaehlen via audit_log).
    // Sobald einmal ein Key in der UI angelegt wurde, ist der ENV-Fallback
    // dauerhaft deaktiviert — auch wenn der Admin den Key wieder loescht.
    const webhookConfig = await authenticateWebhook(payload.api_key, "sync");
    if (!webhookConfig) {
      const envKey = process.env.API_SYNC_KEY;
      const priorConfigs = await db
        .select({ id: schema.auditLog.id })
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.tabelle, "webhook_configs"),
            eq(schema.auditLog.aktion, "INSERT")
          )
        )
        .limit(1);
      const bootstrapAllowed = priorConfigs.length === 0;
      const envMatch =
        bootstrapAllowed &&
        !!envKey &&
        timingSafeStringEqual(payload.api_key, envKey);
      if (!envMatch) {
        return NextResponse.json(
          { error: "Ungueltiger API-Schluessel." },
          { status: 401 }
        );
      }
    }

    // 4. Schulen-Mapping laden (untis_code → id)
    const alleSchulen = await db.select().from(schema.schulen);
    const schulenMap = new Map(
      alleSchulen.map((s) => [s.untisCode?.toUpperCase(), s.id])
    );

    // 4b. Whitelist gueltiger Statistik-Codes laden. Untis kann Codes liefern,
    // die in der App noch nicht angelegt sind (z.B. neuer NRW-Code). Solche
    // Werte werden ignoriert und der Lehrer behaelt seinen vorherigen Code
    // — Datenverlust statt FK-Verletzung.
    const validStatistikCodes = new Set(
      (await db.select({ code: schema.statistikCodes.code }).from(schema.statistikCodes))
        .map((r) => r.code)
    );

    // 5. Sync-Datum validieren
    const syncDate = new Date(payload.sync_datum);
    if (isNaN(syncDate.getTime())) {
      return NextResponse.json(
        { error: "Ungueltiges sync_datum." },
        { status: 400 }
      );
    }

    // 6. Alle Haushaltsjahre laden (fuer Multi-HJ-Mapping)
    const alleHJ = await db.select().from(schema.haushaltsjahre);
    const hjByJahr = new Map(alleHJ.map((h) => [h.jahr, h]));

    // 7. Monate ermitteln (jeder Monat traegt sein Kalenderjahr)
    let monate: Array<{ jahr: number; monat: number }>;
    if (payload.date_from && payload.date_to) {
      monate = getMonthsInRange(payload.date_from, payload.date_to);
    } else {
      // Fallback: aktueller Monat
      const jahr = syncDate.getFullYear();
      monate = [{ jahr, monat: syncDate.getMonth() + 1 }];
    }

    if (monate.length === 0) {
      return NextResponse.json(
        { error: "Kein gueltiger Monatszeitraum ermittelbar." },
        { status: 400 }
      );
    }

    // 7b. Pruefen ob alle benoetigten Haushaltsjahre existieren
    const benoetigteJahre = [...new Set(monate.map((m) => m.jahr))];
    const fehlendeJahre = benoetigteJahre.filter((j) => !hjByJahr.has(j));
    if (fehlendeJahre.length > 0) {
      return NextResponse.json(
        { error: `Haushaltsjahr(e) ${fehlendeJahre.join(", ")} nicht gefunden. Bitte zuerst anlegen.` },
        { status: 400 }
      );
    }

    // 7c. Monate nach Haushaltsjahr gruppieren
    const monateByHjId = new Map<number, Array<{ monat: number }>>();
    for (const m of monate) {
      const hj = hjByJahr.get(m.jahr)!;
      const arr = monateByHjId.get(hj.id) ?? [];
      arr.push({ monat: m.monat });
      monateByHjId.set(hj.id, arr);
    }

    // 7d. Coverage-Info der eingehenden Periode (ISO-Format fuer DB + Vergleich)
    const incomingDateFromIso = payload.date_from ? germanDateToIso(payload.date_from) : null;
    const incomingDateToIso = payload.date_to ? germanDateToIso(payload.date_to) : null;
    const incomingSchoolyearId = payload.school_year_id ?? null;
    const incomingTermId = payload.term_id ?? null;

    // 8. Lehrer ohne gueltige Stammschule filtern (z.B. Code "Z")
    const gueltigeSchulen = new Set(alleSchulen.map((s) => s.untisCode?.toUpperCase()));
    const gueltigeLehrer = payload.lehrer.filter((l) => {
      const code = l.stammschule?.toUpperCase();
      return code && gueltigeSchulen.has(code);
    });

    if (gueltigeLehrer.length === 0) {
      return NextResponse.json({
        success: true, verarbeitet: 0, fehler: 0, monate: monate.length,
        aenderungen: 0, gehaltsrelevant: 0,
        message: "Keine Lehrer mit gueltiger Stammschule im Payload.",
      });
    }

    // 9. Bestehende Lehrer vorladen (Batch statt Einzel-Queries)
    const teacherIds = gueltigeLehrer.map((l) => l.teacher_id);
    const existingLehrer = await db
      .select()
      .from(schema.lehrer)
      .where(inArray(schema.lehrer.untisTeacherId, teacherIds));

    const lehrerMap = new Map(
      existingLehrer.map((l) => [l.untisTeacherId, l])
    );

    // 9b. Bestehende Deputate vorladen — pro Haushaltsjahr
    const alleLehrerIds = existingLehrer.map((l) => l.id);
    const deputatMap = new Map<string, typeof schema.deputatMonatlich.$inferSelect>();

    if (alleLehrerIds.length > 0) {
      for (const [hjId, hjMonate] of monateByHjId) {
        const monatsNummern = hjMonate.map((m) => m.monat);
        const existingDeputate = await db
          .select()
          .from(schema.deputatMonatlich)
          .where(
            and(
              inArray(schema.deputatMonatlich.lehrerId, alleLehrerIds),
              eq(schema.deputatMonatlich.haushaltsjahrId, hjId),
              inArray(schema.deputatMonatlich.monat, monatsNummern)
            )
          );

        for (const d of existingDeputate) {
          deputatMap.set(`${d.lehrerId}_${d.haushaltsjahrId}_${d.monat}`, d);
        }
      }
    }

    // 10. Lehrer verarbeiten (in Transaktion fuer Performance)
    let verarbeitet = 0;
    let fehler = 0;
    let aenderungenGesamt = 0;
    let gehaltsrelevant = 0;
    const fehlgeschlageneLehrer: Array<{ teacherId: number; fehler: string }> = [];
    const neueLehrerEvents: Array<{ teacherId: number; name: string; vollname: string; stammschule: string | null }> = [];
    const hauptdeputatEvents: Array<{
      lehrerId: number; teacherId: number; vollname: string;
      jahr: number; monat: number;
      alt: number; neu: number;
    }> = [];
    const verteilungEvents: Array<{
      lehrerId: number; teacherId: number; vollname: string;
      jahr: number; monat: number;
      gesamt: number;
      ges: { alt: number; neu: number };
      gym: { alt: number; neu: number };
      bk: { alt: number; neu: number };
    }> = [];
    // Statistik-Code-Wechsel — fuer Audit-Log nach Transaktion (arbeitsrechtlich relevant)
    const statistikCodeChanges: Array<{
      lehrerId: number; vollname: string;
      alt: string | null; neu: string | null;
    }> = [];

    // Batch-Groesse: 50 Lehrer pro Transaktion
    const BATCH_SIZE = 50;
    for (let i = 0; i < gueltigeLehrer.length; i += BATCH_SIZE) {
      const batch = gueltigeLehrer.slice(i, i + BATCH_SIZE);

      try {
        // Batch-lokale Zaehler — werden nur uebernommen wenn Transaktion erfolgreich
        let batchAenderungen = 0;
        let batchGehaltsrelevant = 0;

        await db.transaction(async (tx) => {
          for (const lehrerData of batch) {
              const stammschuleId = schulenMap.get(lehrerData.stammschule?.toUpperCase()) ?? null;
              const existing = lehrerMap.get(lehrerData.teacher_id);

              // Statistik-Code normalisieren + gegen Whitelist pruefen.
              // Unbekannte Codes (z.B. neuer NRW-Standard) werden verworfen
              // damit FK nicht bricht; bei Update bleibt der bisherige Code erhalten.
              const { incomingValid: incomingCodeValid, valueForUpdate: statistikCodeForUpdate } =
                normalizeStatistikCode(
                  lehrerData.statistik_code,
                  validStatistikCodes,
                  existing?.statistikCode,
                );

              let lehrerId: number;

              if (existing) {
                // Update
                await tx
                  .update(schema.lehrer)
                  .set({
                    name: lehrerData.name,
                    vollname: lehrerData.vollname,
                    personalnummer: lehrerData.personalnummer ?? null,
                    stammschuleId: stammschuleId,
                    stammschuleCode: lehrerData.stammschule,
                    statistikCode: statistikCodeForUpdate,
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.lehrer.id, existing.id));
                lehrerId = existing.id;

                // Wechsel des Statistik-Codes ist arbeitsrechtlich relevant — merken fuer Audit
                if (detectStatistikCodeChange(existing.statistikCode, statistikCodeForUpdate)) {
                  statistikCodeChanges.push({
                    lehrerId: existing.id,
                    vollname: lehrerData.vollname,
                    alt: existing.statistikCode ?? null,
                    neu: statistikCodeForUpdate,
                  });
                }
              } else {
                // Insert
                const [inserted] = await tx
                  .insert(schema.lehrer)
                  .values({
                    untisTeacherId: lehrerData.teacher_id,
                    name: lehrerData.name,
                    vollname: lehrerData.vollname,
                    personalnummer: lehrerData.personalnummer ?? null,
                    stammschuleId: stammschuleId,
                    stammschuleCode: lehrerData.stammschule,
                    statistikCode: incomingCodeValid,
                  })
                  .returning();
                lehrerId = inserted.id;
                lehrerMap.set(lehrerData.teacher_id, { ...inserted });
                neueLehrerEvents.push({
                  teacherId: lehrerData.teacher_id,
                  name: lehrerData.name,
                  vollname: lehrerData.vollname,
                  stammschule: lehrerData.stammschule ?? null,
                });
              }

              // Deputat fuer jeden Monat: Upsert + Aenderungserkennung
              // WICHTIG: Jeder Monat geht ins korrekte Haushaltsjahr
              for (const m of monate) {
                const hj = hjByJahr.get(m.jahr)!;
                const key = `${lehrerId}_${hj.id}_${m.monat}`;
                const alt = deputatMap.get(key);

                // Coverage-Tie-Breaker: Wenn bereits Werte einer anderen
                // Periode gespeichert sind, darf die eingehende Periode
                // nur ueberschreiben, wenn sie mehr Tage des Monats abdeckt
                // (oder gleich viele mit spaeterem date_from). Bei gleicher
                // Periode (schoolyear+term) immer durchlassen, damit
                // Wertaenderungen innerhalb einer Periode erkannt werden.
                if (alt && incomingDateFromIso && incomingDateToIso) {
                  const samePeriode =
                    alt.untisSchoolyearId != null &&
                    alt.untisTermId != null &&
                    alt.untisSchoolyearId === incomingSchoolyearId &&
                    alt.untisTermId === incomingTermId;

                  if (!samePeriode) {
                    const gewinnt = neuePeriodeGewinnt({
                      jahr: m.jahr,
                      monat: m.monat,
                      neueDateFrom: incomingDateFromIso,
                      neueDateTo: incomingDateToIso,
                      bestehendeDateFrom: alt.untisTermDateFrom,
                      bestehendeDateTo: alt.untisTermDateTo,
                    });
                    if (!gewinnt) continue;
                  }
                }

                // Aenderung erkennen (nur wenn bereits Daten vorhanden)
                if (alt) {
                  const altGesamt = Number(alt.deputatGesamt ?? 0);
                  const neuGesamt = lehrerData.deputat;
                  const altGes = Number(alt.deputatGes ?? 0);
                  const altGym = Number(alt.deputatGym ?? 0);
                  const altBk = Number(alt.deputatBk ?? 0);
                  const neuGes = lehrerData.deputat_ges;
                  const neuGym = lehrerData.deputat_gym;
                  const neuBk = lehrerData.deputat_bk;

                  const gesamtGeaendert = Math.abs(altGesamt - neuGesamt) > 0.001;
                  const verteilungGeaendert =
                    Math.abs(altGes - neuGes) > 0.001 ||
                    Math.abs(altGym - neuGym) > 0.001 ||
                    Math.abs(altBk - neuBk) > 0.001;

                  if (gesamtGeaendert || verteilungGeaendert) {
                    const istGehaltsrelevant = gesamtGeaendert;
                    const aenderungstyp = gesamtGeaendert
                      ? "deputat_aenderung"
                      : "verteilung_aenderung";

                    await tx.insert(schema.deputatAenderungen).values({
                      lehrerId,
                      haushaltsjahrId: hj.id,
                      monat: m.monat,
                      deputatGesamtAlt: String(altGesamt),
                      deputatGesAlt: String(altGes),
                      deputatGymAlt: String(altGym),
                      deputatBkAlt: String(altBk),
                      deputatGesamtNeu: String(neuGesamt),
                      deputatGesNeu: String(neuGes),
                      deputatGymNeu: String(neuGym),
                      deputatBkNeu: String(neuBk),
                      aenderungstyp,
                      istGehaltsrelevant,
                      termIdAlt: alt.untisTermId ?? null,
                      termIdNeu: payload.term_id ?? null,
                    });

                    batchAenderungen++;
                    if (istGehaltsrelevant) batchGehaltsrelevant++;
                    if (gesamtGeaendert) {
                      hauptdeputatEvents.push({
                        lehrerId,
                        teacherId: lehrerData.teacher_id,
                        vollname: lehrerData.vollname,
                        jahr: m.jahr,
                        monat: m.monat,
                        alt: altGesamt,
                        neu: neuGesamt,
                      });
                    } else if (verteilungGeaendert) {
                      verteilungEvents.push({
                        lehrerId,
                        teacherId: lehrerData.teacher_id,
                        vollname: lehrerData.vollname,
                        jahr: m.jahr,
                        monat: m.monat,
                        gesamt: neuGesamt,
                        ges: { alt: altGes, neu: neuGes },
                        gym: { alt: altGym, neu: neuGym },
                        bk: { alt: altBk, neu: neuBk },
                      });
                    }
                  }
                }

                // Upsert Deputat — ins korrekte Haushaltsjahr
                await tx
                  .insert(schema.deputatMonatlich)
                  .values({
                    lehrerId,
                    haushaltsjahrId: hj.id,
                    monat: m.monat,
                    deputatGesamt: String(lehrerData.deputat),
                    deputatGes: String(lehrerData.deputat_ges),
                    deputatGym: String(lehrerData.deputat_gym),
                    deputatBk: String(lehrerData.deputat_bk),
                    quelle: "untis",
                    untisSchoolyearId: incomingSchoolyearId,
                    untisTermId: incomingTermId,
                    untisTermDateFrom: incomingDateFromIso,
                    untisTermDateTo: incomingDateToIso,
                    syncDatum: new Date(),
                  })
                  .onConflictDoUpdate({
                    target: [
                      schema.deputatMonatlich.lehrerId,
                      schema.deputatMonatlich.haushaltsjahrId,
                      schema.deputatMonatlich.monat,
                    ],
                    set: {
                      deputatGesamt: String(lehrerData.deputat),
                      deputatGes: String(lehrerData.deputat_ges),
                      deputatGym: String(lehrerData.deputat_gym),
                      deputatBk: String(lehrerData.deputat_bk),
                      untisSchoolyearId: incomingSchoolyearId,
                      untisTermId: incomingTermId,
                      untisTermDateFrom: incomingDateFromIso,
                      untisTermDateTo: incomingDateToIso,
                      syncDatum: new Date(),
                      updatedAt: new Date(),
                    },
                  });
              }
          }
        });

        // Transaktion erfolgreich — Zaehler uebernehmen
        verarbeitet += batch.length;
        aenderungenGesamt += batchAenderungen;
        gehaltsrelevant += batchGehaltsrelevant;
      } catch (batchErr) {
        // Gesamte Batch-Transaktion wurde zurueckgerollt
        fehler += batch.length;
        const errMsg = batchErr instanceof Error ? batchErr.message : "Unbekannt";
        for (const l of batch) {
          fehlgeschlageneLehrer.push({ teacherId: l.teacher_id, fehler: errMsg });
        }
        console.error(
          `Batch-Fehler (${batch.length} Lehrer, IDs: ${batch.map((l) => l.teacher_id).join(", ")}):`,
          errMsg
        );
      }
    }

    // Fehlgeschlagene Lehrer loggen (nach Transaktionen)
    if (fehlgeschlageneLehrer.length > 0) {
      console.warn(
        `${fehlgeschlageneLehrer.length} Lehrer fehlgeschlagen:`,
        fehlgeschlageneLehrer.map((f) => `teacher_id=${f.teacherId}`).join(", ")
      );
    }

    // 11. Sync-Log schreiben
    const hjLabels = benoetigteJahre.join(", ");
    await db.insert(schema.deputatSyncLog).values({
      schuljahrText: payload.schuljahr_text ?? null,
      termId: payload.term_id ?? null,
      anzahlLehrer: gueltigeLehrer.length,
      anzahlAenderungen: verarbeitet,
      status: fehler > 0 ? "partial" : "success",
      fehlerDetails: fehler > 0 ? `${fehler} Fehler aufgetreten` : null,
    });

    // 12. Audit-Log
    await writeAuditLog("deputat_sync", 0, "INSERT", null, {
      anzahlLehrer: gueltigeLehrer.length,
      verarbeitet,
      fehler,
      monate: monate.length,
      haushaltsjahre: hjLabels,
    }, "n8n");

    // 12b. Statistik-Code-Wechsel parallel auditieren (arbeitsrechtlich).
    // writeAuditLog faengt eigene Fehler ab — die Hauptoperation bleibt erfolgreich.
    await Promise.all(
      statistikCodeChanges.map((change) =>
        writeAuditLog(
          "lehrer",
          change.lehrerId,
          "UPDATE",
          { statistikCode: change.alt },
          { statistikCode: change.neu, hinweis: "Aenderung via n8n-Sync (Untis StatisticCodes)" },
          "n8n",
        ),
      ),
    );

    // 13. Events ausloesen — aggregiert (ein Event pro Typ, Liste im Payload)
    if (neueLehrerEvents.length > 0) {
      void notify("lehrer.created", {
        count: neueLehrerEvents.length,
        lehrer: neueLehrerEvents,
      });
    }
    if (hauptdeputatEvents.length > 0) {
      void notify("hauptdeputat.changed", {
        count: hauptdeputatEvents.length,
        aenderungen: hauptdeputatEvents,
      });
    }
    if (verteilungEvents.length > 0) {
      void notify("verteilung.changed", {
        count: verteilungEvents.length,
        aenderungen: verteilungEvents,
      });
    }
    void notify(fehler > 0 ? "sync.failed" : "sync.completed", {
      schuljahr: payload.schuljahr_text ?? null,
      termId: payload.term_id ?? null,
      verarbeitet,
      fehler,
      aenderungen: aenderungenGesamt,
      gehaltsrelevant,
      monate: monate.length,
      haushaltsjahre: hjLabels,
    });

    return NextResponse.json({
      success: true,
      verarbeitet,
      fehler,
      monate: monate.length,
      haushaltsjahre: hjLabels,
      aenderungen: aenderungenGesamt,
      gehaltsrelevant,
      message: `${verarbeitet} Lehrer fuer ${monate.length} Monat(e) synchronisiert (HJ: ${hjLabels}).`
        + (aenderungenGesamt > 0 ? ` ${aenderungenGesamt} Aenderungen erkannt` : "")
        + (gehaltsrelevant > 0 ? ` (${gehaltsrelevant} gehaltsrelevant!)` : "")
        + ".",
    });
  } catch (err) {
    console.error("Sync-Fehler:", err instanceof Error ? err.message : "Unbekannt");

    // Fehler-Log (ohne sensible Details)
    try {
      await db.insert(schema.deputatSyncLog).values({
        status: "error",
        fehlerDetails: "Interner Serverfehler beim Sync.",
      });
    } catch {
      // Ignorieren wenn auch Log fehlschlaegt
    }

    void notify("sync.failed", {
      error: err instanceof Error ? err.message : "Unbekannter Fehler",
    });

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
