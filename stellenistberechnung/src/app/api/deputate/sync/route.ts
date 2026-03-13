/**
 * POST /api/deputate/sync
 *
 * Empfaengt Lehrer-/Deputatsdaten von n8n Workflow #221.
 * Dieser Endpoint ist die Bruecke zwischen Untis und der Webanwendung.
 *
 * Ablauf:
 * 1. API-Key validieren (timing-safe)
 * 2. Payload mit Zod validieren
 * 3. Lehrer upserten (Match auf untis_teacher_id)
 * 4. Term-Datumsbereich auf Monate mappen
 * 5. Deputat-Monatsdaten upserten
 * 6. Sync-Log schreiben
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
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

    // 2. API-Key validieren ZUERST (vor Zod, um unauthentifizierte Requests sofort abzuweisen)
    const expectedKey = process.env.API_SYNC_KEY;
    const providedKey = typeof rawPayload === "object" && rawPayload !== null
      ? (rawPayload as Record<string, unknown>).api_key
      : undefined;
    if (!expectedKey || typeof providedKey !== "string" || !timingSafeEqual(providedKey, expectedKey)) {
      return NextResponse.json(
        { error: "Ungueltiger API-Schluessel." },
        { status: 401 }
      );
    }

    // 3. Zod-Validierung (nach Auth-Check)
    const parsed = syncPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabedaten.";
      return NextResponse.json(
        { error: `Validierungsfehler: ${firstError}` },
        { status: 400 }
      );
    }

    const payload = parsed.data;

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

    // 7. Lehrer verarbeiten
    let verarbeitet = 0;
    let fehler = 0;

    for (const lehrerData of payload.lehrer) {
      try {
        // 7a. Lehrer upserten
        const stammschuleId = schulenMap.get(lehrerData.stammschule?.toUpperCase()) ?? null;

        const existing = await db
          .select()
          .from(schema.lehrer)
          .where(eq(schema.lehrer.untisTeacherId, lehrerData.teacher_id))
          .limit(1);

        let lehrerId: number;

        if (existing.length > 0) {
          // Update
          await db
            .update(schema.lehrer)
            .set({
              name: lehrerData.name,
              vollname: lehrerData.vollname,
              personalnummer: lehrerData.personalnummer ?? null,
              stammschuleId: stammschuleId,
              stammschuleCode: lehrerData.stammschule,
              updatedAt: new Date(),
            })
            .where(eq(schema.lehrer.untisTeacherId, lehrerData.teacher_id));
          lehrerId = existing[0].id;
        } else {
          // Insert
          const [inserted] = await db
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
        }

        // 7b. Deputat fuer jeden Monat im Zeitraum schreiben
        for (const { monat } of monate) {
          const existingDeputat = await db
            .select()
            .from(schema.deputatMonatlich)
            .where(
              and(
                eq(schema.deputatMonatlich.lehrerId, lehrerId),
                eq(schema.deputatMonatlich.haushaltsjahrId, hj.id),
                eq(schema.deputatMonatlich.monat, monat)
              )
            )
            .limit(1);

          if (existingDeputat.length > 0) {
            await db
              .update(schema.deputatMonatlich)
              .set({
                deputatGesamt: String(lehrerData.deputat),
                deputatGes: String(lehrerData.deputat_ges),
                deputatGym: String(lehrerData.deputat_gym),
                deputatBk: String(lehrerData.deputat_bk),
                untisTermId: payload.term_id ?? null,
                syncDatum: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(schema.deputatMonatlich.id, existingDeputat[0].id));
          } else {
            await db.insert(schema.deputatMonatlich).values({
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
            });
          }
        }

        verarbeitet++;
      } catch (err) {
        fehler++;
        // DSGVO: Keine personenbezogenen Daten (Name) ins Log
        console.error(
          `Fehler bei Lehrer teacher_id=${lehrerData.teacher_id}:`,
          err instanceof Error ? err.message : "Unbekannt"
        );
      }
    }

    // 8. Sync-Log schreiben
    await db.insert(schema.deputatSyncLog).values({
      schuljahrText: payload.schuljahr_text ?? null,
      termId: payload.term_id ?? null,
      anzahlLehrer: payload.lehrer.length,
      anzahlAenderungen: verarbeitet,
      status: fehler > 0 ? "partial" : "success",
      fehlerDetails: fehler > 0 ? `${fehler} Fehler aufgetreten` : null,
    });

    // 9. Audit-Log
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
      message: `${verarbeitet} Lehrer fuer ${monate.length} Monat(e) synchronisiert.`,
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
