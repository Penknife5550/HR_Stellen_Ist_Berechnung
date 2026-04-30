/**
 * POST /api/deputate/sync-v2
 *
 * Neuer Sync-Endpoint im Periodenmodell. Untis ist die Quelle der Wahrheit —
 * jede (Lehrer × Periode)-Kombination kommt 1:1 in `deputat_pro_periode`.
 * Kein Coverage-Tie-Breaker mehr, kein Datenverlust.
 *
 * Voraussetzung: Die Periode (school_year_id, term_id) muss in `untis_terms`
 * existieren. Wenn nicht, wird der Eintrag uebersprungen und im Response
 * gemeldet — typisch ist, dass /api/untis-terms/sync vor diesem Endpoint
 * laeuft.
 *
 * Lehrer-Stammdaten (name, vollname, personalnummer, stammschule, statistik_code)
 * werden wie in v1 upserted. Lehrer mit unbekannter Stammschule werden komplett
 * verworfen (gleiche Logik wie v1, damit FK auf schulen sauber bleibt).
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { syncV2PayloadSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { authenticateWebhook } from "@/lib/webhookAuth";
import { normalizeStatistikCode, detectStatistikCodeChange } from "@/lib/statistikCode";
import { notify } from "@/lib/notifications";

/** Liefert alle (jahr, monat)-Buckets, die ein [dateFrom, dateTo]-Intervall beruehrt. */
function monthsInRange(
  dateFromIso: string,
  dateToIso: string,
): Array<{ jahr: number; monat: number }> {
  const yF = Number(dateFromIso.slice(0, 4));
  const mF = Number(dateFromIso.slice(5, 7));
  const yT = Number(dateToIso.slice(0, 4));
  const mT = Number(dateToIso.slice(5, 7));
  const out: Array<{ jahr: number; monat: number }> = [];
  let y = yF;
  let m = mF;
  while (y < yT || (y === yT && m <= mT)) {
    out.push({ jahr: y, monat: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  try {
    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungueltiges JSON im Request-Body." }, { status: 400 });
    }

    const parsed = syncV2PayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Ungueltige Eingabedaten.";
      return NextResponse.json({ error: `Validierungsfehler: ${firstError}` }, { status: 400 });
    }

    const payload = parsed.data;

    // Auth — gleiche Logik wie /api/deputate/sync
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

    const now = new Date();
    const eintraege = payload.eintraege;

    // 1. Schulen-Mapping (Untis-Code → schule.id)
    const alleSchulen = await db.select().from(schema.schulen);
    const schulenMap = new Map(alleSchulen.map((s) => [s.untisCode?.toUpperCase(), s.id]));
    const gueltigeSchulen = new Set(alleSchulen.map((s) => s.untisCode?.toUpperCase()));

    // 2. Statistik-Code-Whitelist
    const validStatistikCodes = new Set(
      (await db.select({ code: schema.statistikCodes.code }).from(schema.statistikCodes)).map(
        (r) => r.code,
      ),
    );

    // 3. Eintraege ohne gueltige Stammschule verwerfen (wie v1)
    const gueltige = eintraege.filter((e) => {
      const code = e.stammschule?.toUpperCase();
      return code && gueltigeSchulen.has(code);
    });
    const verworfeneAusStammschule = eintraege.length - gueltige.length;

    if (gueltige.length === 0) {
      return NextResponse.json({
        success: true,
        verarbeitet: 0,
        verworfen_stammschule: verworfeneAusStammschule,
        message: "Keine Eintraege mit gueltiger Stammschule im Payload.",
      });
    }

    // 4. Untis-Terms vorladen (FK-Pruefung + gueltig_von/bis-Cache)
    const benoetigteTermKeys = new Set(
      gueltige.map((e) => `${e.school_year_id}_${e.term_id}`),
    );
    const benoetigteSyIds = [...new Set(gueltige.map((e) => e.school_year_id))];
    const benoetigteTermIds = [...new Set(gueltige.map((e) => e.term_id))];

    const vorhandeneTerms = await db
      .select()
      .from(schema.untisTerms)
      .where(
        and(
          inArray(schema.untisTerms.schoolYearId, benoetigteSyIds),
          inArray(schema.untisTerms.termId, benoetigteTermIds),
        ),
      );
    const termMap = new Map(
      vorhandeneTerms.map((t) => [`${t.schoolYearId}_${t.termId}`, t]),
    );
    const fehlendeTermKeys = [...benoetigteTermKeys].filter((k) => !termMap.has(k));

    // 5. Bestehende Lehrer vorladen (Match auf untis_teacher_id)
    const teacherIds = [...new Set(gueltige.map((e) => e.teacher_id))];
    const existingLehrer = await db
      .select()
      .from(schema.lehrer)
      .where(inArray(schema.lehrer.untisTeacherId, teacherIds));
    const lehrerMap = new Map(existingLehrer.map((l) => [l.untisTeacherId, l]));

    // 5b. Bestehende deputat_pro_periode-Werte vorladen — fuer Diff-Erkennung
    //     (Hauptdeputat- vs. Verteilungs-Aenderung). Nur sinnvoll fuer existing
    //     Lehrer; neu angelegte Lehrer haben naturgemaess keine Vorgaengerwerte.
    const existingLehrerIds = existingLehrer.map((l) => l.id);
    type DppRow = typeof schema.deputatProPeriode.$inferSelect;
    let existingDpp: DppRow[] = [];
    if (existingLehrerIds.length > 0) {
      existingDpp = await db
        .select()
        .from(schema.deputatProPeriode)
        .where(
          and(
            inArray(schema.deputatProPeriode.lehrerId, existingLehrerIds),
            inArray(schema.deputatProPeriode.untisSchoolyearId, benoetigteSyIds),
            inArray(schema.deputatProPeriode.untisTermId, benoetigteTermIds),
          ),
        );
    }
    const dppMap = new Map<string, DppRow>(
      existingDpp.map((r) => [`${r.lehrerId}_${r.untisSchoolyearId}_${r.untisTermId}`, r]),
    );

    // 6. Verarbeiten — pro Eintrag: Lehrer upserten + deputat_pro_periode upserten
    let verarbeitet = 0;
    let lehrerNeu = 0;
    let lehrerAktualisiert = 0;
    let dppInserted = 0;
    let dppUpdated = 0;
    let verworfenFehlenderTerm = 0;
    const statistikCodeChanges: Array<{
      lehrerId: number;
      vollname: string;
      alt: string | null;
      neu: string | null;
    }> = [];

    // Sammler fuer ausgehende Webhook-Events
    const lehrerCreatedEvents: Array<{
      lehrerId: number; teacherId: number; vollname: string; stammschule: string | null;
    }> = [];
    type DppChange = {
      lehrerId: number; teacherId: number; vollname: string;
      sy: number; termId: number; dateFrom: string; dateTo: string;
      alt: { gesamt: number; ges: number; gym: number; bk: number };
      neu: { gesamt: number; ges: number; gym: number; bk: number };
      type: "haupt" | "verteilung";
    };
    const dppChanges: DppChange[] = [];

    // Lehrer-Upsert nur EINMAL pro teacher_id pro Sync (nicht 18x bei 18 Perioden)
    const lehrerVerarbeitet = new Set<number>();

    const BATCH_SIZE = 100;
    for (let i = 0; i < gueltige.length; i += BATCH_SIZE) {
      const batch = gueltige.slice(i, i + BATCH_SIZE);

      await db.transaction(async (tx) => {
        for (const e of batch) {
          const termKey = `${e.school_year_id}_${e.term_id}`;
          const term = termMap.get(termKey);
          if (!term) {
            verworfenFehlenderTerm++;
            continue;
          }

          // Lehrer-Upsert pro teacher_id einmalig
          let lehrerId: number;
          if (!lehrerVerarbeitet.has(e.teacher_id)) {
            const stammschuleId = schulenMap.get(e.stammschule?.toUpperCase()) ?? null;
            const existing = lehrerMap.get(e.teacher_id);
            const { incomingValid, valueForUpdate } = normalizeStatistikCode(
              e.statistik_code,
              validStatistikCodes,
              existing?.statistikCode,
            );

            if (existing) {
              await tx
                .update(schema.lehrer)
                .set({
                  name: e.name,
                  vollname: e.vollname,
                  personalnummer: e.personalnummer ?? null,
                  stammschuleId,
                  stammschuleCode: e.stammschule,
                  statistikCode: valueForUpdate,
                  updatedAt: now,
                })
                .where(eq(schema.lehrer.id, existing.id));
              lehrerId = existing.id;
              lehrerAktualisiert++;
              if (detectStatistikCodeChange(existing.statistikCode, valueForUpdate)) {
                statistikCodeChanges.push({
                  lehrerId: existing.id,
                  vollname: e.vollname,
                  alt: existing.statistikCode ?? null,
                  neu: valueForUpdate,
                });
              }
            } else {
              const [inserted] = await tx
                .insert(schema.lehrer)
                .values({
                  untisTeacherId: e.teacher_id,
                  name: e.name,
                  vollname: e.vollname,
                  personalnummer: e.personalnummer ?? null,
                  stammschuleId,
                  stammschuleCode: e.stammschule,
                  statistikCode: incomingValid,
                })
                .returning();
              lehrerId = inserted.id;
              lehrerMap.set(e.teacher_id, inserted);
              lehrerNeu++;
              lehrerCreatedEvents.push({
                lehrerId: inserted.id,
                teacherId: e.teacher_id,
                vollname: e.vollname,
                stammschule: e.stammschule ?? null,
              });
            }
            lehrerVerarbeitet.add(e.teacher_id);
          } else {
            lehrerId = lehrerMap.get(e.teacher_id)!.id;
          }

          // Diff gegen vorhandenen Periodenwert (fuer Webhook-Events)
          const dppKey = `${lehrerId}_${e.school_year_id}_${e.term_id}`;
          const dppOld = dppMap.get(dppKey);
          if (dppOld) {
            const altGesamt = Number(dppOld.deputatGesamt);
            const altGes = Number(dppOld.deputatGes);
            const altGym = Number(dppOld.deputatGym);
            const altBk = Number(dppOld.deputatBk);
            const neuGesamt = e.deputat_gesamt;
            const neuGes = e.deputat_ges;
            const neuGym = e.deputat_gym;
            const neuBk = e.deputat_bk;
            const gesamtGeaendert = Math.abs(altGesamt - neuGesamt) > 0.001;
            const verteilungGeaendert =
              Math.abs(altGes - neuGes) > 0.001 ||
              Math.abs(altGym - neuGym) > 0.001 ||
              Math.abs(altBk - neuBk) > 0.001;
            if (gesamtGeaendert || verteilungGeaendert) {
              dppChanges.push({
                lehrerId,
                teacherId: e.teacher_id,
                vollname: e.vollname,
                sy: e.school_year_id,
                termId: e.term_id,
                dateFrom: term.dateFrom,
                dateTo: term.dateTo,
                alt: { gesamt: altGesamt, ges: altGes, gym: altGym, bk: altBk },
                neu: { gesamt: neuGesamt, ges: neuGes, gym: neuGym, bk: neuBk },
                type: gesamtGeaendert ? "haupt" : "verteilung",
              });
            }
          }

          // deputat_pro_periode upserten
          const dppResult = await tx
            .insert(schema.deputatProPeriode)
            .values({
              lehrerId,
              untisSchoolyearId: e.school_year_id,
              untisTermId: e.term_id,
              gueltigVon: term.dateFrom,
              gueltigBis: term.dateTo,
              deputatGesamt: String(e.deputat_gesamt),
              deputatGes: String(e.deputat_ges),
              deputatGym: String(e.deputat_gym),
              deputatBk: String(e.deputat_bk),
              stammschuleCode: e.stammschule,
              quelle: "untis",
              syncDatum: now,
            })
            .onConflictDoUpdate({
              target: [
                schema.deputatProPeriode.lehrerId,
                schema.deputatProPeriode.untisSchoolyearId,
                schema.deputatProPeriode.untisTermId,
              ],
              set: {
                gueltigVon: term.dateFrom,
                gueltigBis: term.dateTo,
                deputatGesamt: String(e.deputat_gesamt),
                deputatGes: String(e.deputat_ges),
                deputatGym: String(e.deputat_gym),
                deputatBk: String(e.deputat_bk),
                stammschuleCode: e.stammschule,
                syncDatum: now,
                updatedAt: now,
              },
            })
            .returning({
              // xmax = 0 → frisch eingefuegt; xmax > 0 → durch ON CONFLICT aktualisiert.
              isInsert: sql<boolean>`xmax = 0`,
            });

          if (dppResult[0]?.isInsert) dppInserted++;
          else dppUpdated++;

          verarbeitet++;
        }
      });
    }

    // Sync-Log
    await db.insert(schema.deputatSyncLog).values({
      schuljahrText: payload.schuljahr_text ?? null,
      termId: null,
      anzahlLehrer: lehrerVerarbeitet.size,
      anzahlAenderungen: verarbeitet,
      status: verworfenFehlenderTerm > 0 ? "partial" : "success",
      fehlerDetails: verworfenFehlenderTerm > 0
        ? `${verworfenFehlenderTerm} Eintraege verworfen wegen fehlender Periode`
        : null,
    });

    // Statistik-Code-Wechsel auditieren (gleiche Logik wie v1)
    await Promise.all(
      statistikCodeChanges.map((change) =>
        writeAuditLog(
          "lehrer",
          change.lehrerId,
          "UPDATE",
          { statistikCode: change.alt },
          { statistikCode: change.neu, hinweis: "Aenderung via n8n-Sync (sync-v2 Periodenmodell)" },
          "n8n",
        ),
      ),
    );

    await writeAuditLog(
      "deputat_sync_v2",
      0,
      "INSERT",
      null,
      {
        eintraegeImPayload: eintraege.length,
        verarbeitet,
        lehrerNeu,
        lehrerAktualisiert,
        dppInserted,
        dppUpdated,
        verworfenStammschule: verworfeneAusStammschule,
        verworfenFehlenderTerm,
        fehlendeTermKeys,
      },
      "n8n",
    );

    // Webhook-Events: Periodendiffs auf Monatsebene aggregieren.
    // Pro (lehrer × jahr × monat) maximal ein Event. Wenn in einem Monat
    // mindestens eine Periode den Hauptwert aendert, wird der Bucket als
    // "haupt" markiert (gehaltsrelevant uebersteuert reine Verteilung).
    type MonthBucket = {
      lehrerId: number; teacherId: number; vollname: string;
      jahr: number; monat: number;
      type: "haupt" | "verteilung";
      perioden: Array<{
        sy: number; termId: number; dateFrom: string; dateTo: string;
        alt: { gesamt: number; ges: number; gym: number; bk: number };
        neu: { gesamt: number; ges: number; gym: number; bk: number };
      }>;
    };
    const monthMap = new Map<string, MonthBucket>();
    for (const ch of dppChanges) {
      for (const { jahr, monat } of monthsInRange(ch.dateFrom, ch.dateTo)) {
        const key = `${ch.lehrerId}_${jahr}_${monat}`;
        let bucket = monthMap.get(key);
        if (!bucket) {
          bucket = {
            lehrerId: ch.lehrerId, teacherId: ch.teacherId, vollname: ch.vollname,
            jahr, monat,
            type: ch.type,
            perioden: [],
          };
          monthMap.set(key, bucket);
        } else if (ch.type === "haupt" && bucket.type === "verteilung") {
          bucket.type = "haupt";
        }
        bucket.perioden.push({
          sy: ch.sy, termId: ch.termId, dateFrom: ch.dateFrom, dateTo: ch.dateTo,
          alt: ch.alt, neu: ch.neu,
        });
      }
    }
    const hauptBuckets: MonthBucket[] = [];
    const verteilBuckets: MonthBucket[] = [];
    for (const b of monthMap.values()) {
      if (b.type === "haupt") hauptBuckets.push(b);
      else verteilBuckets.push(b);
    }

    if (lehrerCreatedEvents.length > 0) {
      void notify("lehrer.created", {
        count: lehrerCreatedEvents.length,
        lehrer: lehrerCreatedEvents,
      });
    }
    if (hauptBuckets.length > 0) {
      void notify("hauptdeputat.changed", {
        count: hauptBuckets.length,
        aenderungen: hauptBuckets,
      });
    }
    if (verteilBuckets.length > 0) {
      void notify("verteilung.changed", {
        count: verteilBuckets.length,
        aenderungen: verteilBuckets,
      });
    }
    void notify(verworfenFehlenderTerm > 0 ? "sync.failed" : "sync.completed", {
      schuljahr: payload.schuljahr_text ?? null,
      verarbeitet,
      lehrer_neu: lehrerNeu,
      lehrer_aktualisiert: lehrerAktualisiert,
      perioden_neu: dppInserted,
      perioden_aktualisiert: dppUpdated,
      verworfen_stammschule: verworfeneAusStammschule,
      verworfen_fehlender_term: verworfenFehlenderTerm,
    });

    return NextResponse.json({
      success: true,
      verarbeitet,
      lehrer_neu: lehrerNeu,
      lehrer_aktualisiert: lehrerAktualisiert,
      perioden_eintraege_neu: dppInserted,
      perioden_eintraege_aktualisiert: dppUpdated,
      verworfen_stammschule: verworfeneAusStammschule,
      verworfen_fehlender_term: verworfenFehlenderTerm,
      fehlende_terms: fehlendeTermKeys,
      message: `${verarbeitet} Periodeneintrag(e) verarbeitet (${dppInserted} neu, ${dppUpdated} aktualisiert).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler.";
    console.error("[/api/deputate/sync-v2] Fehler:", err);
    void notify("sync.failed", {
      error: msg,
      schuljahr: null,
    });
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
