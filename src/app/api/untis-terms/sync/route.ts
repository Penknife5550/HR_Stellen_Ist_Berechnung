/**
 * POST /api/untis-terms/sync
 *
 * Spiegelt die Untis-Terms-Tabelle 1:1 in unserer DB. Wird per separatem
 * n8n-Job aufgerufen (idR taeglich), schreibt in die Master-Tabelle
 * `untis_terms`. Ohne diese Master-Daten kann kein Lehrer-Sync nach
 * /api/deputate/sync-v2 erfolgen — die Periode muss vorher angelegt sein
 * (FK von deputat_pro_periode auf untis_terms).
 *
 * Idempotent: Upsert via (school_year_id, term_id). Bei Konflikt werden
 * Datumsbereich + Name aktualisiert. Veraltete Terms (in unserer DB, aber
 * nicht mehr im Payload) werden NICHT geloescht — Untis hat sie ggf. nur
 * temporaer ausgeschlossen, und wir wollen referentielle Integritaet zu
 * deputat_pro_periode bewahren.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { untisTermsSyncPayloadSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { authenticateWebhook } from "@/lib/webhookAuth";

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/** Parsed deutsches Datum "DD.MM.YYYY" zu ISO "YYYY-MM-DD". */
function germanDateToIso(dateStr: string): string {
  const [d, m, y] = dateStr.split(".");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungueltiges JSON im Request-Body." }, { status: 400 });
    }

    const parsed = untisTermsSyncPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabedaten.";
      return NextResponse.json({ error: `Validierungsfehler: ${firstError}` }, { status: 400 });
    }

    const payload = parsed.data;

    // Auth: webhook_configs (endpointTyp = 'sync') ODER ENV-Bootstrap solange
    // noch keine webhook_configs angelegt wurden. Identische Logik zum
    // bestehenden /api/deputate/sync-Endpoint.
    const webhookConfig = await authenticateWebhook(payload.api_key, "sync");
    if (!webhookConfig) {
      const envKey = process.env.API_SYNC_KEY;
      const priorConfigs = await db
        .select({ id: schema.auditLog.id })
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.tabelle, "webhook_configs"),
            eq(schema.auditLog.aktion, "INSERT"),
          ),
        )
        .limit(1);
      const bootstrapAllowed = priorConfigs.length === 0;
      const envMatch = bootstrapAllowed && !!envKey && timingSafeStringEqual(payload.api_key, envKey);
      if (!envMatch) {
        return NextResponse.json({ error: "Ungueltiger API-Schluessel." }, { status: 401 });
      }
    }

    // Plausibilitaetscheck: date_from <= date_to ist im Schema, aber Zod prueft
    // das nicht weil es nur zwei Strings sind. Hier explizit nach ISO-Konvertierung.
    const eintraege = payload.terms.map((t) => {
      const dateFromIso = germanDateToIso(t.date_from);
      const dateToIso = germanDateToIso(t.date_to);
      if (dateFromIso > dateToIso) {
        throw new Error(
          `Term ${t.school_year_id}/${t.term_id}: date_from (${t.date_from}) > date_to (${t.date_to}).`,
        );
      }
      return {
        schoolYearId: t.school_year_id,
        termId: t.term_id,
        termName: t.term_name ?? null,
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        isBPeriod: t.is_b_period ?? false,
      };
    });

    // Upsert pro Term — DB-CHECK fuer date_from <= date_to bleibt zusaetzliche Sicherung.
    const now = new Date();
    let inserted = 0;
    let updated = 0;

    for (const e of eintraege) {
      const result = await db
        .insert(schema.untisTerms)
        .values({
          schoolYearId: e.schoolYearId,
          termId: e.termId,
          termName: e.termName,
          dateFrom: e.dateFrom,
          dateTo: e.dateTo,
          isBPeriod: e.isBPeriod,
          syncDatum: now,
        })
        .onConflictDoUpdate({
          target: [schema.untisTerms.schoolYearId, schema.untisTerms.termId],
          set: {
            termName: e.termName,
            dateFrom: e.dateFrom,
            dateTo: e.dateTo,
            isBPeriod: e.isBPeriod,
            syncDatum: now,
            updatedAt: now,
          },
        })
        .returning({
          // xmax = 0 bedeutet "neu eingefuegt" in Postgres; bei Update > 0.
          isInsert: sql<boolean>`xmax = 0`,
        });

      if (result[0]?.isInsert) inserted++;
      else updated++;
    }

    await writeAuditLog(
      "untis_terms",
      0,
      "INSERT",
      null,
      { inserted, updated, total: eintraege.length },
      "n8n",
    );

    return NextResponse.json({
      success: true,
      verarbeitet: eintraege.length,
      inserted,
      updated,
      message: `${eintraege.length} Term(s) gespiegelt (${inserted} neu, ${updated} aktualisiert).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler.";
    console.error("[/api/untis-terms/sync] Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
