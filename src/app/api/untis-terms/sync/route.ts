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
 *
 * Ausnahme (v0.8): Die synthetische Pseudo-Periode UNTIS_PSEUDO_TERM_ID
 * ("Schuljahr ohne Perioden", vom n8n-Sync geliefert solange Untis fuer ein
 * Schuljahr keine Perioden hat) wird hier verwaltet: Sobald echte Perioden
 * fuer dieses Schuljahr eintreffen, wird sie auf den Tag vor Periode 1
 * gekuerzt (August bleibt abgedeckt) bzw. entfernt, falls Periode 1 am/vor
 * dem Pseudo-Start beginnt. Details: lib/db/pseudoPeriode.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { untisTermsSyncPayloadSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { authenticateWebhook } from "@/lib/webhookAuth";
import { notify } from "@/lib/notifications";
import { UNTIS_PSEUDO_TERM_ID } from "@/lib/constants";
import { verarbeitePseudoBeiEchtenTerms, type PseudoVerarbeitung } from "@/lib/db/pseudoPeriode";

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
      // n8n schluckt 400er (continueOnFail) — Fehler sichtbar machen.
      void notify("sync.failed", { error: `Terms-Validierungsfehler: ${firstError}`, schuljahr: null });
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

    // Pseudo-Periode: Schuljahre, fuer die jetzt echte Perioden geliefert
    // wurden, bekommen ihre Pseudo-Periode auf den Tag vor Periode 1 gekuerzt
    // (bzw. entfernt, falls Periode 1 am/vor dem Pseudo-Start beginnt).
    // Idempotent; ohne Pseudo-Periode passiert nichts.
    const syMitEchtenTerms = [
      ...new Set(
        eintraege.filter((e) => e.termId !== UNTIS_PSEUDO_TERM_ID).map((e) => e.schoolYearId),
      ),
    ];
    const pseudoVerarbeitung: PseudoVerarbeitung[] = [];
    for (const sy of syMitEchtenTerms) {
      const echte = await db
        .select({ termId: schema.untisTerms.termId, dateFrom: schema.untisTerms.dateFrom })
        .from(schema.untisTerms)
        .where(
          and(
            eq(schema.untisTerms.schoolYearId, sy),
            ne(schema.untisTerms.termId, UNTIS_PSEUDO_TERM_ID),
          ),
        )
        .orderBy(asc(schema.untisTerms.dateFrom), asc(schema.untisTerms.termId));
      if (echte.length === 0) continue;
      const r = await verarbeitePseudoBeiEchtenTerms({
        sy,
        p1From: echte[0].dateFrom,
        ersteEchteTermId: echte[0].termId,
        letzteEchteTermId: echte[echte.length - 1].termId,
      });
      if (r.aktion !== "keine") pseudoVerarbeitung.push(r);
    }

    await writeAuditLog(
      "untis_terms",
      0,
      "INSERT",
      null,
      { inserted, updated, total: eintraege.length, pseudoVerarbeitung },
      "n8n",
    );

    return NextResponse.json({
      success: true,
      verarbeitet: eintraege.length,
      inserted,
      updated,
      pseudo_verarbeitung: pseudoVerarbeitung,
      message: `${eintraege.length} Term(s) gespiegelt (${inserted} neu, ${updated} aktualisiert).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler.";
    console.error("[/api/untis-terms/sync] Fehler:", err);
    // Fachliche Plausibilitaetsfehler (date_from > date_to) duerfen mit Detail
    // zurueck an n8n; DB-/Systemfehler nicht (kein Leak von Tabellennamen).
    if (msg.startsWith("Term ")) {
      void notify("sync.failed", { error: msg, schuljahr: null });
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    void notify("sync.failed", { error: "Terms-Sync: interner Fehler", schuljahr: null });
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
