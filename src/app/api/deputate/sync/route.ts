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
 * 5. Deputat-Monatsdaten upserten
 * 6. Sync-Log schreiben
 *
 * Performance: Batch-Verarbeitung in Transaktionen fuer schnellen Sync
 * bei grossen Datenmengen (100+ Lehrer).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { syncPayloadSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

/**
 * Timing-safe Vergleich von API-Keys.
 * Verhindert Timing-Attacks bei der Authentifizierung.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Trotzdem konstante Zeit fuer Laengenunterschied
    const dummy = Buffer.alloc(a.length, 0);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
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

    // 3. API-Key validieren (timing-safe)
    const expectedKey = process.env.API_SYNC_KEY;
    if (!expectedKey || !timingSafeEqual(payload.api_key, expectedKey)) {
      return NextResponse.json(
        { error: "Ungueltiger API-Schluessel." },
        { status: 401 }
      );
    }

    // 4. Schulen-Mapping laden (untis_code → id)
    const alleSchulen = await db.select().from(schema.schulen);
    const schulenMap = new Map(
      alleSchulen.map((s) => [s.untisCode?.toUpperCase(), s.id])
    );

    // 5. Haushaltsjahr ermitteln
    const syncDate = new Date(payload.sync_datum);
    if (isNaN(syncDate.getTime())) {
      return NextResponse.json(
        { error: "Ungueltiges sync_datum." },
        { status: 400 }
      );
    }

    const jahr = syncDate.getFullYear();
    const alleHJ = await db.select().from(schema.haushaltsjahre);
    const hj = alleHJ.find((h) => h.jahr === jahr);

    if (!hj) {
      return NextResponse.json(
        { error: `Haushaltsjahr ${jahr} nicht gefunden.` },
        { status: 400 }
      );
    }

    // 6. Monate ermitteln
    let monate: Array<{ jahr: number; monat: number }>;
    if (payload.date_from && payload.date_to) {
      monate = getMonthsInRange(payload.date_from, payload.date_to);
    } else {
      // Fallback: aktueller Monat
      monate = [{ jahr, monat: syncDate.getMonth() + 1 }];
    }

    if (monate.length === 0) {
      return NextResponse.json(
        { error: "Kein gueltiger Monatszeitraum ermittelbar." },
        { status: 400 }
      );
    }

    // 6b. Lehrer ohne gueltige Stammschule filtern (z.B. Code "Z")
    const gueltigeSchulen = new Set(alleSchulen.map((s) => s.untisCode?.toUpperCase()));
    payload.lehrer = payload.lehrer.filter((l) => {
      const code = l.stammschule?.toUpperCase();
      return code && gueltigeSchulen.has(code);
    });

    if (payload.lehrer.length === 0) {
      return NextResponse.json({
        success: true, verarbeitet: 0, fehler: 0, monate: monate.length,
        aenderungen: 0, gehaltsrelevant: 0,
        message: "Keine Lehrer mit gueltiger Stammschule im Payload.",
      });
    }

    // 7. Bestehende Lehrer vorladen (Batch statt Einzel-Queries)
    const teacherIds = payload.lehrer.map((l) => l.teacher_id);
    const existingLehrer = await db
      .select()
      .from(schema.lehrer)
      .where(inArray(schema.lehrer.untisTeacherId, teacherIds));

    const lehrerMap = new Map(
      existingLehrer.map((l) => [l.untisTeacherId, l])
    );

    // 7b. Bestehende Deputate vorladen (fuer Aenderungserkennung)
    const alleLehrerIds = existingLehrer.map((l) => l.id);
    const monatsNummern = monate.map((m) => m.monat);
    const existingDeputate = alleLehrerIds.length > 0
      ? await db
          .select()
          .from(schema.deputatMonatlich)
          .where(
            and(
              inArray(schema.deputatMonatlich.lehrerId, alleLehrerIds),
              eq(schema.deputatMonatlich.haushaltsjahrId, hj.id),
              inArray(schema.deputatMonatlich.monat, monatsNummern)
            )
          )
      : [];

    // Key: "lehrerId_monat" → bestehendes Deputat
    const deputatMap = new Map(
      existingDeputate.map((d) => [`${d.lehrerId}_${d.monat}`, d])
    );

    // 8. Lehrer verarbeiten (in Transaktion fuer Performance)
    let verarbeitet = 0;
    let fehler = 0;
    let aenderungenGesamt = 0;
    let gehaltsrelevant = 0;
    const fehlgeschlageneLehrer: Array<{ teacherId: number; fehler: string }> = [];

    // Batch-Groesse: 50 Lehrer pro Transaktion
    const BATCH_SIZE = 50;
    for (let i = 0; i < payload.lehrer.length; i += BATCH_SIZE) {
      const batch = payload.lehrer.slice(i, i + BATCH_SIZE);

      try {
        // Batch-lokale Zaehler — werden nur uebernommen wenn Transaktion erfolgreich
        let batchAenderungen = 0;
        let batchGehaltsrelevant = 0;

        await db.transaction(async (tx) => {
          for (const lehrerData of batch) {
              const stammschuleId = schulenMap.get(lehrerData.stammschule?.toUpperCase()) ?? null;
              const existing = lehrerMap.get(lehrerData.teacher_id);

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
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.lehrer.id, existing.id));
                lehrerId = existing.id;
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
                  })
                  .returning();
                lehrerId = inserted.id;
                lehrerMap.set(lehrerData.teacher_id, { ...inserted });
              }

              // Deputat fuer jeden Monat: Upsert + Aenderungserkennung
              for (const { monat } of monate) {
                const key = `${lehrerId}_${monat}`;
                const alt = deputatMap.get(key);

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
                      monat,
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
                  }
                }

                // Upsert Deputat
                await tx
                  .insert(schema.deputatMonatlich)
                  .values({
                    lehrerId,
                    haushaltsjahrId: hj.id,
                    monat,
                    deputatGesamt: String(lehrerData.deputat),
                    deputatGes: String(lehrerData.deputat_ges),
                    deputatGym: String(lehrerData.deputat_gym),
                    deputatBk: String(lehrerData.deputat_bk),
                    quelle: "untis",
                    untisTermId: payload.term_id ?? null,
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
                      untisTermId: payload.term_id ?? null,
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

    // 9. Sync-Log schreiben
    await db.insert(schema.deputatSyncLog).values({
      schuljahrText: payload.schuljahr_text ?? null,
      termId: payload.term_id ?? null,
      anzahlLehrer: payload.lehrer.length,
      anzahlAenderungen: verarbeitet,
      status: fehler > 0 ? "partial" : "success",
      fehlerDetails: fehler > 0 ? `${fehler} Fehler aufgetreten` : null,
    });

    // 10. Audit-Log
    await writeAuditLog("deputat_sync", 0, "INSERT", null, {
      anzahlLehrer: payload.lehrer.length,
      verarbeitet,
      fehler,
      monate: monate.length,
    }, "n8n");

    return NextResponse.json({
      success: true,
      verarbeitet,
      fehler,
      monate: monate.length,
      aenderungen: aenderungenGesamt,
      gehaltsrelevant,
      message: `${verarbeitet} Lehrer fuer ${monate.length} Monat(e) synchronisiert.`
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

    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
