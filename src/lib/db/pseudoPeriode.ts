/**
 * Pseudo-Periode (term_id = UNTIS_PSEUDO_TERM_ID) — Lebenszyklus.
 *
 * Hintergrund: Direkt nach Schuljahresbeginn hat Untis fuer das neue Schuljahr
 * noch keine Perioden (Tabelle Terms leer). Der n8n-Sync #223 v0.8 liefert
 * dann pro Lehrer EINE synthetische Periode 999 ueber das gesetzliche
 * Schuljahr (01.08.–31.07.), damit Aug–Dez in der App nicht leer bleiben.
 *
 * Sobald Untis echte Perioden anlegt, liefert der Sync fuer dieses Schuljahr
 * nur noch echte Perioden. Die Pseudo-Periode wird dann NICHT geloescht,
 * sondern auf den Tag vor Periode 1 GEKUERZT (Normalfall: Untis-Periode 1
 * beginnt am ersten Schul-Montag, z.B. 31.08., die Pseudo-Periode deckt dann
 * 01.08.–30.08.). Vorteile: August bleibt lueckenlos abgedeckt, der Wechsel
 * "letzte Periode Vorjahr → 999" behaelt sein Wirksamkeitsdatum 01.08.
 * (Schuljahresbeginn, § 7 SchulG NRW), Korrekturen und Nachtrag-Status
 * bleiben gueltig, und "999 → Periode 1" ist in der Regel ein Null-Wechsel.
 *
 * Nur wenn Periode 1 am/vor dem Pseudo-Start beginnt (kein Tag bleibt uebrig),
 * wird die Pseudo-Periode komplett entfernt; Korrekturen und Nachtrag-Status
 * werden dann auf die erste echte Periode umgehaengt.
 *
 * Alles laeuft schuljahresweit (alle Lehrer), damit auch Lehrkraefte ohne
 * echte 2026/27-Zeilen (z.B. inzwischen ausgeschieden) keine Ganzjahres-
 * Pseudo-Periode behalten.
 */

import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { UNTIS_PSEUDO_TERM_ID, UNTIS_PSEUDO_TERM_NAME } from "@/lib/constants";
import { writeAuditLog } from "@/lib/audit";

export type PseudoVerarbeitung = {
  aktion: "keine" | "gekuerzt" | "entfernt";
  sy: number;
  /** Neues gueltig_bis der Pseudo-Periode (nur bei "gekuerzt") */
  neuesBis?: string;
  dppGeaendert: number;
  korrekturenUmgehaengt: number;
  korrekturenVerworfen: number;
  nachtraegeUmgehaengt: number;
  nachtraegeVerworfen: number;
  termGeloescht: boolean;
};

/** ISO-Datum minus 1 Tag (UTC-neutral, nur Kalendertage). */
function isoMinusEinTag(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Wird von /api/untis-terms/sync aufgerufen, sobald fuer ein Schuljahr echte
 * Perioden geliefert wurden. Idempotent: ohne Pseudo-Term passiert nichts;
 * eine bereits gekuerzte Pseudo-Periode wird nicht erneut angefasst.
 *
 * @param p1From            date_from der chronologisch ersten echten Periode (ISO)
 * @param ersteEchteTermId  term_id dieser ersten echten Periode
 * @param letzteEchteTermId term_id der chronologisch letzten echten Periode
 */
export async function verarbeitePseudoBeiEchtenTerms(params: {
  sy: number;
  p1From: string;
  ersteEchteTermId: number;
  letzteEchteTermId: number;
}): Promise<PseudoVerarbeitung> {
  const { sy, p1From, ersteEchteTermId, letzteEchteTermId } = params;
  const PSEUDO = UNTIS_PSEUDO_TERM_ID;
  const leer: PseudoVerarbeitung = {
    aktion: "keine",
    sy,
    dppGeaendert: 0,
    korrekturenUmgehaengt: 0,
    korrekturenVerworfen: 0,
    nachtraegeUmgehaengt: 0,
    nachtraegeVerworfen: 0,
    termGeloescht: false,
  };

  // Defensiv: nur den vom n8n-Sync so benannten Pseudo-Term anfassen.
  const [pseudo] = await db
    .select()
    .from(schema.untisTerms)
    .where(
      and(
        eq(schema.untisTerms.schoolYearId, sy),
        eq(schema.untisTerms.termId, PSEUDO),
        eq(schema.untisTerms.termName, UNTIS_PSEUDO_TERM_NAME),
      ),
    )
    .limit(1);
  if (!pseudo) return leer;

  // ---- Normalfall: kuerzen auf den Tag vor Periode 1 ----------------------
  if (p1From > pseudo.dateFrom) {
    const neuesBis = isoMinusEinTag(p1From);
    if (pseudo.dateTo <= neuesBis) {
      // Bereits gekuerzt (oder Periode 1 beginnt spaeter als das Pseudo-Ende).
      return { ...leer, aktion: "keine" };
    }
    const result = await db.transaction(async (tx) => {
      await tx
        .update(schema.untisTerms)
        .set({ dateTo: neuesBis, updatedAt: new Date() })
        .where(and(eq(schema.untisTerms.schoolYearId, sy), eq(schema.untisTerms.termId, PSEUDO)));
      const dpp = await tx
        .update(schema.deputatProPeriode)
        .set({ gueltigBis: neuesBis, updatedAt: new Date() })
        .where(
          and(
            eq(schema.deputatProPeriode.untisSchoolyearId, sy),
            eq(schema.deputatProPeriode.untisTermId, PSEUDO),
            gt(schema.deputatProPeriode.gueltigBis, neuesBis),
          ),
        )
        .returning({ id: schema.deputatProPeriode.id });
      // Sachbearbeiter-Korrekturen am Wechsel "→ Pseudo-Periode" mit Stichtag AB
      // Periode 1 (z.B. Vertragsbeginn 01.09. bei Untis-Montag 31.08.): ab dort
      // gilt Untis-Periode 1, also gehoert die Korrektur an den Wechsel
      // "→ Periode 1". Die Pseudo-Zeile dieses Lehrers entfaellt, damit
      // v_deputat_pro_tag (Migration 0014) die Vorgaenger-Periode bis zum
      // Stichtag verlaengert und ab Stichtag Periode 1 gilt.
      const korr = (await tx.execute(sql`
        UPDATE deputat_aenderung_korrekturen k
           SET term_id_neu = ${ersteEchteTermId}, updated_at = now()
         WHERE k.sy_neu = ${sy} AND k.term_id_neu = ${PSEUDO}
           AND k.tatsaechliches_datum >= ${p1From}
           AND NOT EXISTS (
             SELECT 1 FROM deputat_aenderung_korrekturen z
              WHERE z.lehrer_id = k.lehrer_id AND z.sy_neu = ${sy} AND z.term_id_neu = ${ersteEchteTermId}
           )
        RETURNING k.id, k.lehrer_id, k.tatsaechliches_datum
      `)) as unknown as Array<{ id: number; lehrer_id: number; tatsaechliches_datum: string }>;
      // Konfliktreste (Ziel-Korrektur existiert bereits): verwerfen, protokollieren
      const korrRest = (await tx.execute(sql`
        DELETE FROM deputat_aenderung_korrekturen k
         WHERE k.sy_neu = ${sy} AND k.term_id_neu = ${PSEUDO}
           AND k.tatsaechliches_datum >= ${p1From}
        RETURNING k.id, k.lehrer_id, k.tatsaechliches_datum
      `)) as unknown as Array<{ id: number; lehrer_id: number; tatsaechliches_datum: string }>;
      const betroffeneLehrer = [...new Set([...korr, ...korrRest].map((r) => r.lehrer_id))];
      let nachtraegeUmgehaengt = 0;
      let nachtraegeVerworfen = 0;
      let dppEntfernt = 0;
      if (betroffeneLehrer.length > 0) {
        const ids = sql.join(betroffeneLehrer.map((id) => sql`${id}`), sql`, `);
        nachtraegeUmgehaengt = ((await tx.execute(sql`
          UPDATE deputat_nachtraege n
             SET term_neu = ${ersteEchteTermId}, updated_at = now()
           WHERE n.sy_neu = ${sy} AND n.term_neu = ${PSEUDO} AND n.lehrer_id IN (${ids})
             AND NOT EXISTS (
               SELECT 1 FROM deputat_nachtraege z
                WHERE z.lehrer_id = n.lehrer_id AND z.sy_alt = n.sy_alt AND z.term_alt = n.term_alt
                  AND z.sy_neu = ${sy} AND z.term_neu = ${ersteEchteTermId}
             )
          RETURNING n.id
        `)) as unknown as Array<{ id: number }>).length;
        nachtraegeVerworfen = ((await tx.execute(sql`
          DELETE FROM deputat_nachtraege n
           WHERE n.sy_neu = ${sy} AND n.term_neu = ${PSEUDO} AND n.lehrer_id IN (${ids})
          RETURNING n.id
        `)) as unknown as Array<{ id: number }>).length;
        dppEntfernt = (
          await tx
            .delete(schema.deputatProPeriode)
            .where(
              and(
                inArray(schema.deputatProPeriode.lehrerId, betroffeneLehrer),
                eq(schema.deputatProPeriode.untisSchoolyearId, sy),
                eq(schema.deputatProPeriode.untisTermId, PSEUDO),
              ),
            )
            .returning({ id: schema.deputatProPeriode.id })
        ).length;
      }
      return {
        dpp: dpp.length,
        korr,
        korrRest,
        nachtraegeUmgehaengt,
        nachtraegeVerworfen,
        dppEntfernt,
      };
    });
    await writeAuditLog(
      "untis_terms",
      0,
      "UPDATE",
      { schoolYearId: sy, termId: PSEUDO, dateTo: pseudo.dateTo },
      {
        schoolYearId: sy,
        termId: PSEUDO,
        dateTo: neuesBis,
        hinweis: `Pseudo-Periode auf Tag vor Untis-Periode ${ersteEchteTermId} (${p1From}) gekuerzt; ${result.dpp} Lehrer-Zeilen angepasst`,
        korrekturenAufPeriode1: result.korr,
        korrekturenVerworfen: result.korrRest,
        nachtraegeAufPeriode1: result.nachtraegeUmgehaengt,
        nachtraegeVerworfen: result.nachtraegeVerworfen,
        pseudoZeilenEntferntWegenKorrektur: result.dppEntfernt,
      },
      "n8n",
    );
    return {
      ...leer,
      aktion: "gekuerzt",
      neuesBis,
      dppGeaendert: result.dpp,
      korrekturenUmgehaengt: result.korr.length,
      korrekturenVerworfen: result.korrRest.length,
      nachtraegeUmgehaengt: result.nachtraegeUmgehaengt,
      nachtraegeVerworfen: result.nachtraegeVerworfen,
    };
  }

  // ---- Sonderfall: Periode 1 beginnt am/vor dem Pseudo-Start → entfernen -----
  const r = await db.transaction(async (tx) => {
    const korNeu = (await tx.execute(sql`
      UPDATE deputat_aenderung_korrekturen k
         SET term_id_neu = ${ersteEchteTermId}, updated_at = now()
       WHERE k.sy_neu = ${sy} AND k.term_id_neu = ${PSEUDO}
         AND NOT EXISTS (
           SELECT 1 FROM deputat_aenderung_korrekturen z
            WHERE z.lehrer_id = k.lehrer_id AND z.sy_neu = ${sy} AND z.term_id_neu = ${ersteEchteTermId}
         )
      RETURNING k.id
    `)) as unknown as Array<{ id: number }>;
    const korAlt = (await tx.execute(sql`
      UPDATE deputat_aenderung_korrekturen k
         SET term_id_alt = ${letzteEchteTermId}, updated_at = now()
       WHERE k.sy_alt = ${sy} AND k.term_id_alt = ${PSEUDO}
      RETURNING k.id
    `)) as unknown as Array<{ id: number }>;
    const korRest = (await tx.execute(sql`
      DELETE FROM deputat_aenderung_korrekturen k
       WHERE (k.sy_neu = ${sy} AND k.term_id_neu = ${PSEUDO})
          OR (k.sy_alt = ${sy} AND k.term_id_alt = ${PSEUDO})
      RETURNING k.id, k.lehrer_id, k.sy_alt, k.term_id_alt, k.sy_neu, k.term_id_neu, k.tatsaechliches_datum
    `)) as unknown as Array<Record<string, unknown>>;

    const naNeu = (await tx.execute(sql`
      UPDATE deputat_nachtraege n
         SET term_neu = ${ersteEchteTermId}, updated_at = now()
       WHERE n.sy_neu = ${sy} AND n.term_neu = ${PSEUDO}
         AND NOT EXISTS (
           SELECT 1 FROM deputat_nachtraege z
            WHERE z.lehrer_id = n.lehrer_id AND z.sy_alt = n.sy_alt AND z.term_alt = n.term_alt
              AND z.sy_neu = ${sy} AND z.term_neu = ${ersteEchteTermId}
         )
      RETURNING n.id
    `)) as unknown as Array<{ id: number }>;
    const naAlt = (await tx.execute(sql`
      UPDATE deputat_nachtraege n
         SET term_alt = ${letzteEchteTermId}, updated_at = now()
       WHERE n.sy_alt = ${sy} AND n.term_alt = ${PSEUDO}
         AND NOT EXISTS (
           SELECT 1 FROM deputat_nachtraege z
            WHERE z.lehrer_id = n.lehrer_id AND z.sy_alt = ${sy} AND z.term_alt = ${letzteEchteTermId}
              AND z.sy_neu = n.sy_neu AND z.term_neu = n.term_neu
         )
      RETURNING n.id
    `)) as unknown as Array<{ id: number }>;
    const naRest = (await tx.execute(sql`
      DELETE FROM deputat_nachtraege n
       WHERE (n.sy_neu = ${sy} AND n.term_neu = ${PSEUDO})
          OR (n.sy_alt = ${sy} AND n.term_alt = ${PSEUDO})
      RETURNING n.id, n.lehrer_id, n.sy_alt, n.term_alt, n.sy_neu, n.term_neu, n.status
    `)) as unknown as Array<Record<string, unknown>>;

    const dpp = await tx
      .delete(schema.deputatProPeriode)
      .where(
        and(
          eq(schema.deputatProPeriode.untisSchoolyearId, sy),
          eq(schema.deputatProPeriode.untisTermId, PSEUDO),
        ),
      )
      .returning({ id: schema.deputatProPeriode.id });

    const term = await tx
      .delete(schema.untisTerms)
      .where(and(eq(schema.untisTerms.schoolYearId, sy), eq(schema.untisTerms.termId, PSEUDO)))
      .returning({ termId: schema.untisTerms.termId });

    return {
      dppGeaendert: dpp.length,
      korrekturenUmgehaengt: korNeu.length + korAlt.length,
      korrekturenVerworfen: korRest.length,
      korrekturenVerworfenDetails: korRest,
      nachtraegeUmgehaengt: naNeu.length + naAlt.length,
      nachtraegeVerworfen: naRest.length,
      nachtraegeVerworfenDetails: naRest,
      termGeloescht: term.length > 0,
    };
  });

  await writeAuditLog(
    "untis_terms",
    0,
    "DELETE",
    { schoolYearId: sy, termId: PSEUDO, dateFrom: pseudo.dateFrom, dateTo: pseudo.dateTo },
    {
      hinweis: `Pseudo-Periode entfernt: Untis-Periode ${ersteEchteTermId} beginnt am ${p1From} (am/vor Pseudo-Start)`,
      dppGeloescht: r.dppGeaendert,
      korrekturenUmgehaengt: r.korrekturenUmgehaengt,
      korrekturenVerworfen: r.korrekturenVerworfenDetails,
      nachtraegeUmgehaengt: r.nachtraegeUmgehaengt,
      nachtraegeVerworfen: r.nachtraegeVerworfenDetails,
    },
    "n8n",
  );

  return {
    aktion: "entfernt",
    sy,
    dppGeaendert: r.dppGeaendert,
    korrekturenUmgehaengt: r.korrekturenUmgehaengt,
    korrekturenVerworfen: r.korrekturenVerworfen,
    nachtraegeUmgehaengt: r.nachtraegeUmgehaengt,
    nachtraegeVerworfen: r.nachtraegeVerworfen,
    termGeloescht: r.termGeloescht,
  };
}
