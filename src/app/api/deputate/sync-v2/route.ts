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
 *
 * v0.8 (03.09.2026):
 *  - Webhook-Events (hauptdeputat.changed / verteilung.changed) auch fuer NEU
 *    eingefuegte Perioden: Diff gegen die chronologisch vorhergehende Periode
 *    (Untis bildet Aenderungen fast immer als neue Periode ab, nicht als
 *    Aenderung einer bestehenden). Siehe lib/berechnungen/periodenDiff.ts.
 *  - Ein Sync-Request laeuft in EINER Transaktion: entweder alle Zeilen und
 *    danach die Events, oder nichts (kein Event-Verlust bei Teilfehlern).
 *  - Pseudo-Periode UNTIS_PSEUDO_TERM_ID (Schuljahr ohne Untis-Perioden) wird
 *    nie neben echten Perioden desselben Schuljahres geschrieben; ihren
 *    Lebenszyklus verwaltet /api/untis-terms/sync (lib/db/pseudoPeriode.ts).
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
import { UNTIS_PSEUDO_TERM_ID } from "@/lib/constants";
import {
  berechneNeuePeriodenWechsel,
  baueMonatsBuckets,
  klassifiziereWechsel,
  monthsInRange,
  wirksamMonat,
  type BucketInput,
  type PeriodenWerte,
  type PeriodenZeile,
} from "@/lib/berechnungen/periodenDiff";

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
      // Ein verworfener Chunk darf nicht stumm bleiben — n8n schluckt 400er.
      // Aber nur fuer authentifizierte Aufrufer melden, sonst wird der
      // Event-Versand zum unauthentifizierten Mail-/Log-Trigger.
      const key = (rawPayload as { api_key?: unknown })?.api_key;
      if (typeof key === "string" && (await authenticateWebhook(key, "sync"))) {
        void notify("sync.failed", { error: `Validierungsfehler: ${firstError}`, schuljahr: null });
      }
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
    const heuteIso = now.toISOString().slice(0, 10);
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

    // 4. Untis-Terms vorladen (FK-Pruefung + gueltig_von/bis-Cache) — alle Terms
    //    der betroffenen Schuljahre.
    const benoetigteTermKeys = new Set(
      gueltige.map((e) => `${e.school_year_id}_${e.term_id}`),
    );
    const benoetigteSyIds = [...new Set(gueltige.map((e) => e.school_year_id))];

    const vorhandeneTerms = await db
      .select()
      .from(schema.untisTerms)
      .where(inArray(schema.untisTerms.schoolYearId, benoetigteSyIds));
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

    // 5a. Pro teacher_id den AKTUELLSTEN Eintrag ermitteln (max SY, max term_id).
    //     Lehrer-Stammdaten (Stammschule, Name, Personalnummer, Statistik-Code)
    //     koennen sich zwischen Schuljahren aendern. Wenn das Untis-Payload nach
    //     (SY, term_id) AUFSTEIGEND sortiert kommt, wuerde ein naiver Loop den
    //     Master-Datensatz aus der AELTESTEN Periode setzen und nie wieder
    //     aktualisieren — Schulwechsel zum neuen SY wuerde im Master stecken
    //     bleiben (Beispiel: Elsanowski 2024/25 = GYM, 2025/26 = BK; Master
    //     blieb auf GYM stehen). Wir picken stattdessen die letzte Periode.
    type EintragGueltig = (typeof gueltige)[number];
    const masterPerLehrer = new Map<number, EintragGueltig>();
    for (const e of gueltige) {
      const current = masterPerLehrer.get(e.teacher_id);
      if (
        !current ||
        e.school_year_id > current.school_year_id ||
        (e.school_year_id === current.school_year_id && e.term_id > current.term_id)
      ) {
        masterPerLehrer.set(e.teacher_id, e);
      }
    }

    // 5b. Bestehende deputat_pro_periode-Werte vorladen — fuer Diff-Erkennung
    //     (Hauptdeputat- vs. Verteilungs-Aenderung) und als Timeline-Basis fuer
    //     den Vorgaenger-Diff neuer Perioden. ALLE Perioden der bekannten Lehrer
    //     (auch fruehere Schuljahre), da der Vorgaenger einer neuen Periode im
    //     Vorjahr liegen kann. Neu angelegte Lehrer haben keine Vorgaengerwerte.
    const existingLehrerIds = existingLehrer.map((l) => l.id);
    type DppRow = typeof schema.deputatProPeriode.$inferSelect;
    let existingDpp: DppRow[] = [];
    if (existingLehrerIds.length > 0) {
      existingDpp = await db
        .select()
        .from(schema.deputatProPeriode)
        .where(inArray(schema.deputatProPeriode.lehrerId, existingLehrerIds));
    }
    const dppKeyOf = (lehrerId: number, sy: number, termId: number) => `${lehrerId}_${sy}_${termId}`;
    const dppMap = new Map<string, DppRow>(
      existingDpp.map((r) => [dppKeyOf(r.lehrerId, r.untisSchoolyearId, r.untisTermId), r]),
    );
    // Lehrer × Schuljahr, fuer die bereits ECHTE Perioden in der DB liegen
    // (Schutz: Pseudo-Periode darf echte Perioden nie ueberlappen).
    const echteInDb = new Set<string>();
    for (const r of existingDpp) {
      if (r.untisTermId !== UNTIS_PSEUDO_TERM_ID) echteInDb.add(`${r.lehrerId}_${r.untisSchoolyearId}`);
    }

    // 6. Verarbeiten — pro Eintrag: Lehrer upserten + deputat_pro_periode upserten.
    //    Eine Transaktion fuer den gesamten Request.
    let verarbeitet = 0;
    let lehrerNeu = 0;
    let lehrerAktualisiert = 0;
    let dppInserted = 0;
    let dppUpdated = 0;
    let verworfenFehlenderTerm = 0;
    let verworfenPseudoWeilEchte = 0;
    let periodenVerschoben = 0;
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
    /** Rueckwirkende Aenderung einer bereits synchronisierten Periode (gleicher Key). */
    const updateWechsel: BucketInput[] = [];
    /** Alle in diesem Request geschriebenen Zeilen (Nach-Sync-Zustand), key → Zeile. */
    const verarbeiteteZeilen = new Map<string, PeriodenZeile>();
    const eingefuegteKeys = new Set<string>();
    /** lehrerId → Untis-Stammdaten fuer Event-Payloads */
    const lehrerInfo = new Map<number, { teacherId: number; vollname: string }>();

    // Lehrer-Upsert nur EINMAL pro teacher_id pro Sync (nicht 18x bei 18 Perioden)
    const lehrerVerarbeitet = new Set<number>();

    await db.transaction(async (tx) => {
      for (const e of gueltige) {
        const termKey = `${e.school_year_id}_${e.term_id}`;
        const term = termMap.get(termKey);
        if (!term) {
          verworfenFehlenderTerm++;
          continue;
        }

        // Lehrer-Upsert pro teacher_id einmalig — auf Basis der AKTUELLSTEN
        // Periode dieses Lehrers (siehe masterPerLehrer-Aufbau oben), nicht
        // des aktuellen Schleifeneintrags.
        let lehrerId: number;
        if (!lehrerVerarbeitet.has(e.teacher_id)) {
          const master = masterPerLehrer.get(e.teacher_id) ?? e;
          const stammschuleId = schulenMap.get(master.stammschule?.toUpperCase()) ?? null;
          const existing = lehrerMap.get(e.teacher_id);
          const { incomingValid, valueForUpdate } = normalizeStatistikCode(
            master.statistik_code,
            validStatistikCodes,
            existing?.statistikCode,
          );

          if (existing) {
            await tx
              .update(schema.lehrer)
              .set({
                name: master.name,
                vollname: master.vollname,
                personalnummer: master.personalnummer ?? null,
                stammschuleId,
                stammschuleCode: master.stammschule,
                statistikCode: valueForUpdate,
                updatedAt: now,
              })
              .where(eq(schema.lehrer.id, existing.id));
            lehrerId = existing.id;
            lehrerAktualisiert++;
            if (detectStatistikCodeChange(existing.statistikCode, valueForUpdate)) {
              statistikCodeChanges.push({
                lehrerId: existing.id,
                vollname: master.vollname,
                alt: existing.statistikCode ?? null,
                neu: valueForUpdate,
              });
            }
          } else {
            const [inserted] = await tx
              .insert(schema.lehrer)
              .values({
                untisTeacherId: e.teacher_id,
                name: master.name,
                vollname: master.vollname,
                personalnummer: master.personalnummer ?? null,
                stammschuleId,
                stammschuleCode: master.stammschule,
                statistikCode: incomingValid,
              })
              .returning();
            lehrerId = inserted.id;
            lehrerMap.set(e.teacher_id, inserted);
            lehrerNeu++;
            lehrerCreatedEvents.push({
              lehrerId: inserted.id,
              teacherId: e.teacher_id,
              vollname: master.vollname,
              stammschule: master.stammschule ?? null,
            });
          }
          lehrerVerarbeitet.add(e.teacher_id);
        } else {
          lehrerId = lehrerMap.get(e.teacher_id)!.id;
        }
        lehrerInfo.set(lehrerId, { teacherId: e.teacher_id, vollname: e.vollname });

        const istPseudo = e.term_id === UNTIS_PSEUDO_TERM_ID;

        // Pseudo-Periode nie neben echten Perioden desselben Schuljahres
        // schreiben (kaeme nur vor, wenn Untis seine Perioden wieder loescht).
        if (istPseudo && echteInDb.has(`${lehrerId}_${e.school_year_id}`)) {
          verworfenPseudoWeilEchte++;
          continue;
        }

        const dppKey = dppKeyOf(lehrerId, e.school_year_id, e.term_id);
        const dppOld = dppMap.get(dppKey);
        const neuWerte: PeriodenWerte = {
          gesamt: e.deputat_gesamt, ges: e.deputat_ges, gym: e.deputat_gym, bk: e.deputat_bk,
        };

        // Diff gegen vorhandenen Periodenwert (rueckwirkende Aenderung) — nur,
        // wenn es noch DIESELBE Periode ist. Untis nummeriert TERM_IDs um, wenn
        // Perioden nachtraeglich eingeschoben werden; dann traegt der Key ploetzlich
        // einen anderen Zeitraum und ein Wertvergleich waere ein Phantom-Wechsel.
        if (dppOld) {
          if (dppOld.gueltigVon === term.dateFrom) {
            const altWerte: PeriodenWerte = {
              gesamt: Number(dppOld.deputatGesamt),
              ges: Number(dppOld.deputatGes),
              gym: Number(dppOld.deputatGym),
              bk: Number(dppOld.deputatBk),
            };
            const typ = klassifiziereWechsel(altWerte, neuWerte);
            if (typ) {
              updateWechsel.push({
                lehrerId,
                teacherId: e.teacher_id,
                vollname: e.vollname,
                sy: e.school_year_id,
                termId: e.term_id,
                dateFrom: term.dateFrom,
                dateTo: term.dateTo,
                alt: altWerte,
                neu: neuWerte,
                type: typ,
                // Rueckwirkende Aenderung betrifft alle Monate der Periode; die
                // Pseudo-Periode (ganzes Schuljahr) nur ihren Wirksamkeitsmonat,
                // sonst 12 Zeilen je Lehrer in der Mail.
                monate: istPseudo
                  ? [wirksamMonat(term.dateFrom)]
                  : monthsInRange(term.dateFrom, term.dateTo),
              });
            }
          } else {
            periodenVerschoben++;
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

        if (dppResult[0]?.isInsert) {
          dppInserted++;
          eingefuegteKeys.add(dppKey);
        } else {
          dppUpdated++;
        }
        verarbeiteteZeilen.set(dppKey, {
          lehrerId,
          sy: e.school_year_id,
          termId: e.term_id,
          gueltigVon: term.dateFrom,
          gueltigBis: term.dateTo,
          werte: neuWerte,
        });

        verarbeitet++;
      }
    });

    // 7. Wertwechsel NEUER Perioden gegen den chronologischen Vorgaenger.
    //    Timeline = NACH-Sync-Zustand: unveraenderte DB-Zeilen + alle in diesem
    //    Request geschriebenen Zeilen (mit ihren neuen Daten/Werten). Historischer
    //    Backfill (> 60 Tage zurueck) erzeugt keine Events.
    const bestehendZeilen: PeriodenZeile[] = existingDpp
      .filter((r) => !verarbeiteteZeilen.has(dppKeyOf(r.lehrerId, r.untisSchoolyearId, r.untisTermId)))
      .map((r) => ({
        lehrerId: r.lehrerId,
        sy: r.untisSchoolyearId,
        termId: r.untisTermId,
        gueltigVon: r.gueltigVon,
        gueltigBis: r.gueltigBis,
        werte: {
          gesamt: Number(r.deputatGesamt),
          ges: Number(r.deputatGes),
          gym: Number(r.deputatGym),
          bk: Number(r.deputatBk),
        },
      }));
    const eingefuegteZeilen: PeriodenZeile[] = [];
    for (const [key, zeile] of verarbeiteteZeilen) {
      if (eingefuegteKeys.has(key)) eingefuegteZeilen.push(zeile);
      else bestehendZeilen.push(zeile);
    }
    const neueWechsel = berechneNeuePeriodenWechsel({
      bestehend: bestehendZeilen,
      eingefuegt: eingefuegteZeilen,
      heute: heuteIso,
    });
    const neueWechselInputs: BucketInput[] = neueWechsel.map((w) => {
      const info = lehrerInfo.get(w.lehrerId) ?? { teacherId: 0, vollname: "" };
      return {
        lehrerId: w.lehrerId,
        teacherId: info.teacherId,
        vollname: info.vollname,
        sy: w.sy,
        termId: w.termId,
        dateFrom: w.dateFrom,
        dateTo: w.dateTo,
        alt: w.alt,
        neu: w.neu,
        type: w.type,
        monate: [wirksamMonat(w.dateFrom)],
      };
    });

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
        verworfenPseudoWeilEchte,
        periodenVerschoben,
        fehlendeTermKeys,
        wechselRueckwirkend: updateWechsel.length,
        wechselNeuePerioden: neueWechsel.length,
      },
      "n8n",
    );

    // Webhook-Events: Diffs auf Monatsebene aggregieren.
    // Pro (lehrer × jahr × monat) maximal ein Event. Wenn in einem Monat
    // mindestens eine Periode den Hauptwert aendert, wird der Bucket als
    // "haupt" markiert (gehaltsrelevant uebersteuert reine Verteilung).
    const buckets = baueMonatsBuckets([...updateWechsel, ...neueWechselInputs]);
    const hauptBuckets = buckets.filter((b) => b.type === "haupt");
    const verteilBuckets = buckets.filter((b) => b.type === "verteilung");

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
      verworfen_pseudo_weil_echte: verworfenPseudoWeilEchte,
      perioden_verschoben: periodenVerschoben,
      fehlende_terms: fehlendeTermKeys,
      wechsel_rueckwirkend: updateWechsel.length,
      wechsel_neue_perioden: neueWechsel.length,
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
