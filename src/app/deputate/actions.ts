"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  deputatAenderungen,
  deputatAenderungKorrekturen,
  deputatNachtraege,
  deputatProPeriode,
  untisTerms,
} from "@/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { UNTIS_PSEUDO_TERM_ID } from "@/lib/constants";
import { z } from "zod";

const datumKorrekturSchema = z.object({
  aenderungId: z.number().int().positive(),
  tatsaechlichesDatum: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Format: JJJJ-MM-TT"
  ),
});

/**
 * Tatsaechliches Aenderungsdatum korrigieren.
 *
 * Untis erzwingt Aenderungen immer zum Montag. Das reale Datum
 * kann abweichen und muss fuer die korrekte Refinanzierung
 * nach § 3 Abs. 1 FESchVO taggenau erfasst werden.
 */
export async function korrigiereDatumAction(formData: FormData) {
  const session = await requireWriteAccess();

  const raw = {
    aenderungId: Number(formData.get("aenderungId")),
    tatsaechlichesDatum: String(formData.get("tatsaechlichesDatum") ?? ""),
  };

  const parsed = datumKorrekturSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltiges Datum." };
  }

  const { aenderungId, tatsaechlichesDatum } = parsed.data;

  // Bestehenden Eintrag laden
  const [existing] = await db
    .select()
    .from(deputatAenderungen)
    .where(eq(deputatAenderungen.id, aenderungId));

  if (!existing) {
    return { error: "Aenderungseintrag nicht gefunden." };
  }

  // Datum aktualisieren
  await db
    .update(deputatAenderungen)
    .set({
      tatsaechlichesDatum,
      datumKorrigiertVon: session.name,
      datumKorrigiertAm: new Date(),
    })
    .where(eq(deputatAenderungen.id, aenderungId));

  await writeAuditLog("deputat_aenderungen", aenderungId, "UPDATE", {
    tatsaechlichesDatum: existing.tatsaechlichesDatum,
  }, {
    tatsaechlichesDatum,
    korrigiertVon: session.name,
  }, session.name);

  revalidatePath(`/deputate/${existing.lehrerId}`);
  revalidatePath("/deputate");

  return { success: true, message: "Tatsaechliches Datum gespeichert." };
}

// ============================================================
// PERIODENMODELL — Korrektur-Layer (v0.7+)
// ============================================================

const periodenKorrekturSchema = z.object({
  lehrerId: z.number().int().positive(),
  syAlt: z.number().int().positive(),
  termIdAlt: z.number().int().positive(),
  syNeu: z.number().int().positive(),
  termIdNeu: z.number().int().positive(),
  // Echter Stichtag (jedes Datum erlaubt, nicht nur Montag — das ist genau der Punkt)
  tatsaechlichesDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: JJJJ-MM-TT"),
  bemerkung: z.string().max(500).optional(),
});

/**
 * Setzt oder aktualisiert eine Sachbearbeiter-Korrektur fuer einen Term-zu-Term-
 * Wechsel im Periodenmodell. Wirkt auf v_deputat_pro_tag (Tagesgenau-Berechnung)
 * und v_deputat_aenderungen (UI-Anzeige).
 *
 * Untis bleibt unangetastet — die Korrektur lebt in deputat_aenderung_korrekturen.
 * Pro (lehrer, sy_neu, term_id_neu) max. eine Korrektur (Unique-Constraint).
 */
export async function korrigierePeriodeWirksamkeitAction(formData: FormData) {
  const session = await requireWriteAccess();

  const raw = {
    lehrerId: Number(formData.get("lehrerId")),
    syAlt: Number(formData.get("syAlt")),
    termIdAlt: Number(formData.get("termIdAlt")),
    syNeu: Number(formData.get("syNeu")),
    termIdNeu: Number(formData.get("termIdNeu")),
    tatsaechlichesDatum: String(formData.get("tatsaechlichesDatum") ?? ""),
    bemerkung: formData.get("bemerkung") ? String(formData.get("bemerkung")) : undefined,
  };

  const parsed = periodenKorrekturSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const data = parsed.data;
  const now = new Date();

  // Plausibilitaetsbereich pruefen: tatsaechlichesDatum muss innerhalb
  // [periode_alt.dateFrom, periode_neu.dateTo] liegen. Sonst kann eine
  // verschobene Wirksamkeit fruehere/spaetere Perioden ueberschreiben
  // (LATERAL-Pick in v_deputat_pro_tag) -> Datenkorruption in der Berechnung.
  const [periodeAlt] = await db
    .select({ dateFrom: untisTerms.dateFrom, dateTo: untisTerms.dateTo })
    .from(untisTerms)
    .where(and(eq(untisTerms.schoolYearId, data.syAlt), eq(untisTerms.termId, data.termIdAlt)));
  const [periodeNeu] = await db
    .select({ dateFrom: untisTerms.dateFrom, dateTo: untisTerms.dateTo })
    .from(untisTerms)
    .where(and(eq(untisTerms.schoolYearId, data.syNeu), eq(untisTerms.termId, data.termIdNeu)));

  if (!periodeAlt || !periodeNeu) {
    return { error: "Periode (alt oder neu) nicht im Untis-Terms-Master gefunden." };
  }

  // Pseudo-Periode "Schuljahr ohne Perioden" (v0.8): Obergrenze ist das
  // gesetzliche Schuljahresende, nicht das ggf. schon gekuerzte date_to.
  // Liegt der Stichtag ab der ersten echten Untis-Periode des Schuljahres
  // (z.B. Vertragsbeginn 01.09. bei Untis-Montag 31.08.), gehoert die
  // Korrektur an den Wechsel "→ Periode 1"; die Pseudo-Zeile des Lehrers
  // entfaellt dann, damit die Vorgaenger-Periode bis zum Stichtag gilt.
  let zielTermIdNeu = data.termIdNeu;
  let obergrenze = periodeNeu.dateTo;
  let umleitungAufPeriode1: { termId: number; dateFrom: string } | null = null;
  if (data.termIdNeu === UNTIS_PSEUDO_TERM_ID) {
    obergrenze = `${data.syNeu % 10000}-07-31`;
    const [ersteEchte] = await db
      .select({ termId: untisTerms.termId, dateFrom: untisTerms.dateFrom })
      .from(untisTerms)
      .where(
        and(eq(untisTerms.schoolYearId, data.syNeu), ne(untisTerms.termId, UNTIS_PSEUDO_TERM_ID)),
      )
      .orderBy(asc(untisTerms.dateFrom), asc(untisTerms.termId))
      .limit(1);
    if (ersteEchte && data.tatsaechlichesDatum >= ersteEchte.dateFrom) {
      zielTermIdNeu = ersteEchte.termId;
      umleitungAufPeriode1 = ersteEchte;
    }
  }

  if (
    data.tatsaechlichesDatum < periodeAlt.dateFrom ||
    data.tatsaechlichesDatum > obergrenze
  ) {
    return {
      error: `Datum muss zwischen ${periodeAlt.dateFrom} und ${obergrenze} liegen (Periode alt bis neu).`,
    };
  }

  // Bestehende Korrektur fuer Audit-Vorher-Wert laden
  const [existing] = await db
    .select()
    .from(deputatAenderungKorrekturen)
    .where(
      and(
        eq(deputatAenderungKorrekturen.lehrerId, data.lehrerId),
        eq(deputatAenderungKorrekturen.syNeu, data.syNeu),
        eq(deputatAenderungKorrekturen.termIdNeu, zielTermIdNeu),
      ),
    );

  await db
    .insert(deputatAenderungKorrekturen)
    .values({
      lehrerId: data.lehrerId,
      syAlt: data.syAlt,
      termIdAlt: data.termIdAlt,
      syNeu: data.syNeu,
      termIdNeu: zielTermIdNeu,
      tatsaechlichesDatum: data.tatsaechlichesDatum,
      korrigiertVon: session.name,
      korrigiertAm: now,
      bemerkung: data.bemerkung ?? null,
    })
    .onConflictDoUpdate({
      target: [
        deputatAenderungKorrekturen.lehrerId,
        deputatAenderungKorrekturen.syNeu,
        deputatAenderungKorrekturen.termIdNeu,
      ],
      set: {
        syAlt: data.syAlt,
        termIdAlt: data.termIdAlt,
        tatsaechlichesDatum: data.tatsaechlichesDatum,
        korrigiertVon: session.name,
        korrigiertAm: now,
        bemerkung: data.bemerkung ?? null,
        updatedAt: now,
      },
    });

  // Umleitung auf Periode 1: Pseudo-Zeile und Pseudo-Nachtrag dieses Lehrers
  // entfernen bzw. umhaengen, sonst wuerde die Pseudo-Periode den Stichtag
  // in v_deputat_pro_tag ueberdecken.
  let pseudoEntfernt = 0;
  if (umleitungAufPeriode1) {
    const p1 = umleitungAufPeriode1;
    pseudoEntfernt = await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE deputat_nachtraege n
           SET term_neu = ${p1.termId}, updated_at = now()
         WHERE n.lehrer_id = ${data.lehrerId} AND n.sy_neu = ${data.syNeu}
           AND n.term_neu = ${UNTIS_PSEUDO_TERM_ID}
           AND NOT EXISTS (
             SELECT 1 FROM deputat_nachtraege z
              WHERE z.lehrer_id = n.lehrer_id AND z.sy_alt = n.sy_alt AND z.term_alt = n.term_alt
                AND z.sy_neu = ${data.syNeu} AND z.term_neu = ${p1.termId}
           )
      `);
      await tx
        .delete(deputatNachtraege)
        .where(
          and(
            eq(deputatNachtraege.lehrerId, data.lehrerId),
            eq(deputatNachtraege.syNeu, data.syNeu),
            eq(deputatNachtraege.termNeu, UNTIS_PSEUDO_TERM_ID),
          ),
        );
      const dpp = await tx
        .delete(deputatProPeriode)
        .where(
          and(
            eq(deputatProPeriode.lehrerId, data.lehrerId),
            eq(deputatProPeriode.untisSchoolyearId, data.syNeu),
            eq(deputatProPeriode.untisTermId, UNTIS_PSEUDO_TERM_ID),
          ),
        )
        .returning({ id: deputatProPeriode.id });
      return dpp.length;
    });
  }

  await writeAuditLog(
    "deputat_aenderung_korrekturen",
    existing?.id ?? 0,
    existing ? "UPDATE" : "INSERT",
    existing
      ? { tatsaechlichesDatum: existing.tatsaechlichesDatum, bemerkung: existing.bemerkung }
      : null,
    {
      lehrerId: data.lehrerId,
      sy: data.syNeu,
      termWechsel: `${data.termIdAlt}->${zielTermIdNeu}`,
      tatsaechlichesDatum: data.tatsaechlichesDatum,
      bemerkung: data.bemerkung ?? null,
      ...(umleitungAufPeriode1
        ? {
            hinweis: `Stichtag liegt ab Untis-Periode ${umleitungAufPeriode1.termId} (${umleitungAufPeriode1.dateFrom}); Korrektur statt an Pseudo-Periode an Periode 1 erfasst, ${pseudoEntfernt} Pseudo-Zeile(n) entfernt`,
          }
        : {}),
    },
    session.name,
  );

  revalidatePath(`/deputate/${data.lehrerId}`);
  revalidatePath("/deputate");

  return { success: true, message: "Korrektur gespeichert." };
}

const loescheKorrekturSchema = z.object({
  korrekturId: z.number().int().positive(),
});

/** Loescht eine Sachbearbeiter-Korrektur — der Wechsel gilt dann wieder zum Untis-Montag. */
export async function loescheKorrekturAction(formData: FormData) {
  const session = await requireWriteAccess();
  const parsed = loescheKorrekturSchema.safeParse({
    korrekturId: Number(formData.get("korrekturId")),
  });
  if (!parsed.success) return { error: "Ungueltige Korrektur-ID." };

  const [existing] = await db
    .select()
    .from(deputatAenderungKorrekturen)
    .where(eq(deputatAenderungKorrekturen.id, parsed.data.korrekturId));
  if (!existing) return { error: "Korrektur nicht gefunden." };

  await db
    .delete(deputatAenderungKorrekturen)
    .where(eq(deputatAenderungKorrekturen.id, parsed.data.korrekturId));

  await writeAuditLog(
    "deputat_aenderung_korrekturen",
    parsed.data.korrekturId,
    "DELETE",
    {
      tatsaechlichesDatum: existing.tatsaechlichesDatum,
      lehrerId: existing.lehrerId,
      termWechsel: `${existing.termIdAlt}->${existing.termIdNeu}`,
    },
    null,
    session.name,
  );

  revalidatePath(`/deputate/${existing.lehrerId}`);
  return { success: true, message: "Korrektur entfernt." };
}
