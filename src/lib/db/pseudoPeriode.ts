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
 * Verschiebt Untis den Start von Periode 1 spaeter noch einmal, wird das
 * Pseudo-Ende entsprechend nachgezogen (auch wieder nach hinten).
 *
 * Sachbearbeiter-Korrekturen am Wechsel "→ Pseudo-Periode", deren Stichtag
 * AB Periode 1 liegt, gehoeren fachlich an den Wechsel in die echte Periode,
 * die den Stichtag ENTHAELT — dorthin werden sie (samt Nachtrag-Status)
 * umgehaengt, und die Pseudo-Zeile der betroffenen Lehrkraft entfaellt, damit
 * die Vorgaenger-Periode in v_deputat_pro_tag bis zum Stichtag verlaengert
 * wird und ab Stichtag die echte Periode gilt.
 *
 * Nur wenn Periode 1 am/vor dem Pseudo-Start beginnt (kein Tag bleibt uebrig),
 * wird die Pseudo-Periode komplett entfernt.
 *
 * Alles laeuft schuljahresweit (alle Lehrer), damit auch Lehrkraefte ohne
 * echte Zeilen im aktuellen Payload keine Ganzjahres-Pseudo-Periode behalten.
 */

import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, asc, eq, ne, inArray, sql } from "drizzle-orm";
import { UNTIS_PSEUDO_TERM_ID, UNTIS_PSEUDO_TERM_NAME } from "@/lib/constants";
import { writeAuditLog } from "@/lib/audit";

export type EchteTermInfo = { termId: number; dateFrom: string; dateTo: string };

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
 * Die echte Periode, die einen Stichtag ENTHAELT: die chronologisch letzte
 * mit dateFrom <= stichtag. Faellt der Stichtag vor die erste echte Periode,
 * gibt es kein Ziel (null) — dann bleibt die Korrektur an der Pseudo-Periode.
 */
export function zielPeriodeFuerStichtag(
  echteTerms: EchteTermInfo[],
  stichtag: string,
): EchteTermInfo | null {
  let ziel: EchteTermInfo | null = null;
  for (const t of echteTerms) {
    if (t.dateFrom <= stichtag) ziel = t;
    else break;
  }
  return ziel;
}

/** Laedt alle echten Perioden eines Schuljahres, chronologisch sortiert. */
export async function ladeEchteTerms(sy: number): Promise<EchteTermInfo[]> {
  return db
    .select({
      termId: schema.untisTerms.termId,
      dateFrom: schema.untisTerms.dateFrom,
      dateTo: schema.untisTerms.dateTo,
    })
    .from(schema.untisTerms)
    .where(
      and(
        eq(schema.untisTerms.schoolYearId, sy),
        ne(schema.untisTerms.termId, UNTIS_PSEUDO_TERM_ID),
      ),
    )
    .orderBy(asc(schema.untisTerms.dateFrom), asc(schema.untisTerms.termId));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Haengt alle Pseudo-Korrekturen (sy_neu = sy, term_id_neu = 999) mit Stichtag
 * ab Periode 1 auf die echte Periode um, die den Stichtag enthaelt; zieht den
 * Nachtrag-Status der betroffenen Lehrkraefte mit und entfernt deren
 * Pseudo-Werte-Zeilen. Konfliktreste (Ziel existiert schon) werden geloescht.
 */
async function haengeKorrekturenUm(
  tx: Tx,
  sy: number,
  echteTerms: EchteTermInfo[],
  abStichtag: string,
): Promise<{
  umgehaengt: Array<{ id: number; lehrerId: number; datum: string; zielTermId: number }>;
  verworfen: Array<{ id: number; lehrerId: number; datum: string }>;
  nachtraegeUmgehaengt: number;
  nachtraegeVerworfen: number;
  dppEntfernt: number;
}> {
  const PSEUDO = UNTIS_PSEUDO_TERM_ID;
  const betroffene = await tx
    .select({
      id: schema.deputatAenderungKorrekturen.id,
      lehrerId: schema.deputatAenderungKorrekturen.lehrerId,
      datum: schema.deputatAenderungKorrekturen.tatsaechlichesDatum,
    })
    .from(schema.deputatAenderungKorrekturen)
    .where(
      and(
        eq(schema.deputatAenderungKorrekturen.syNeu, sy),
        eq(schema.deputatAenderungKorrekturen.termIdNeu, PSEUDO),
        sql`${schema.deputatAenderungKorrekturen.tatsaechlichesDatum} >= ${abStichtag}`,
      ),
    );

  const umgehaengt: Array<{ id: number; lehrerId: number; datum: string; zielTermId: number }> = [];
  const verworfen: Array<{ id: number; lehrerId: number; datum: string }> = [];
  let nachtraegeUmgehaengt = 0;
  let nachtraegeVerworfen = 0;

  for (const k of betroffene) {
    const ziel = zielPeriodeFuerStichtag(echteTerms, k.datum);
    if (!ziel) continue; // Stichtag vor Periode 1 — bleibt an der Pseudo-Periode
    const [konflikt] = await tx
      .select({ id: schema.deputatAenderungKorrekturen.id })
      .from(schema.deputatAenderungKorrekturen)
      .where(
        and(
          eq(schema.deputatAenderungKorrekturen.lehrerId, k.lehrerId),
          eq(schema.deputatAenderungKorrekturen.syNeu, sy),
          eq(schema.deputatAenderungKorrekturen.termIdNeu, ziel.termId),
        ),
      )
      .limit(1);
    if (konflikt) {
      await tx
        .delete(schema.deputatAenderungKorrekturen)
        .where(eq(schema.deputatAenderungKorrekturen.id, k.id));
      verworfen.push(k);
    } else {
      await tx
        .update(schema.deputatAenderungKorrekturen)
        .set({ termIdNeu: ziel.termId, updatedAt: new Date() })
        .where(eq(schema.deputatAenderungKorrekturen.id, k.id));
      umgehaengt.push({ ...k, zielTermId: ziel.termId });
    }

    // Nachtrag-Status desselben Wechsels mitziehen (Ziel = gleiche Periode).
    const na = (await tx.execute(sql`
      UPDATE deputat_nachtraege n
         SET term_neu = ${ziel.termId}, updated_at = now()
       WHERE n.lehrer_id = ${k.lehrerId} AND n.sy_neu = ${sy} AND n.term_neu = ${PSEUDO}
         AND NOT EXISTS (
           SELECT 1 FROM deputat_nachtraege z
            WHERE z.lehrer_id = n.lehrer_id AND z.sy_alt = n.sy_alt AND z.term_alt = n.term_alt
              AND z.sy_neu = ${sy} AND z.term_neu = ${ziel.termId}
         )
      RETURNING n.id
    `)) as unknown as Array<{ id: number }>;
    nachtraegeUmgehaengt += na.length;
  }

  const lehrerIds = [...new Set(betroffene.map((k) => k.lehrerId))];
  let dppEntfernt = 0;
  if (lehrerIds.length > 0) {
    // Reste: Nachtraege, die noch auf die Pseudo-Periode zeigen (Konflikt
    // oder Wechsel AUS der Pseudo-Periode) — der Wechsel existiert nach dem
    // Entfernen der Pseudo-Zeile nicht mehr. Audit-Spur bleibt im audit_log.
    const naRest = (await tx.execute(sql`
      DELETE FROM deputat_nachtraege n
       WHERE n.lehrer_id IN (${sql.join(lehrerIds.map((id) => sql`${id}`), sql`, `)})
         AND ((n.sy_neu = ${sy} AND n.term_neu = ${PSEUDO})
           OR (n.sy_alt = ${sy} AND n.term_alt = ${PSEUDO}))
      RETURNING n.id
    `)) as unknown as Array<{ id: number }>;
    nachtraegeVerworfen = naRest.length;

    dppEntfernt = (
      await tx
        .delete(schema.deputatProPeriode)
        .where(
          and(
            inArray(schema.deputatProPeriode.lehrerId, lehrerIds),
            eq(schema.deputatProPeriode.untisSchoolyearId, sy),
            eq(schema.deputatProPeriode.untisTermId, UNTIS_PSEUDO_TERM_ID),
          ),
        )
        .returning({ id: schema.deputatProPeriode.id })
    ).length;
  }

  return { umgehaengt, verworfen, nachtraegeUmgehaengt, nachtraegeVerworfen, dppEntfernt };
}

/**
 * Wird von /api/untis-terms/sync aufgerufen, sobald fuer ein Schuljahr echte
 * Perioden geliefert wurden. Idempotent: ohne Pseudo-Periode passiert nichts,
 * ein bereits passendes Pseudo-Ende wird nicht erneut angefasst.
 */
export async function verarbeitePseudoBeiEchtenTerms(params: {
  sy: number;
  echteTerms: EchteTermInfo[];
}): Promise<PseudoVerarbeitung> {
  const { sy, echteTerms } = params;
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
  if (echteTerms.length === 0) return leer;
  const p1 = echteTerms[0];
  const letzte = echteTerms[echteTerms.length - 1];

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
  if (p1.dateFrom > pseudo.dateFrom) {
    const neuesBis = isoMinusEinTag(p1.dateFrom);
    const korrOffen = await db
      .select({ id: schema.deputatAenderungKorrekturen.id })
      .from(schema.deputatAenderungKorrekturen)
      .where(
        and(
          eq(schema.deputatAenderungKorrekturen.syNeu, sy),
          eq(schema.deputatAenderungKorrekturen.termIdNeu, PSEUDO),
          sql`${schema.deputatAenderungKorrekturen.tatsaechlichesDatum} >= ${p1.dateFrom}`,
        ),
      )
      .limit(1);
    if (pseudo.dateTo === neuesBis && korrOffen.length === 0) {
      // Bereits gekuerzt und nichts umzuhaengen.
      return leer;
    }

    const result = await db.transaction(async (tx) => {
      // Ende nachziehen — in beide Richtungen: kuerzen beim ersten Mal,
      // wieder verlaengern, falls Untis den Start von Periode 1 nach hinten
      // verschiebt (sonst bliebe eine Abdeckungsluecke).
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
            ne(schema.deputatProPeriode.gueltigBis, neuesBis),
          ),
        )
        .returning({ id: schema.deputatProPeriode.id });

      const um = await haengeKorrekturenUm(tx, sy, echteTerms, p1.dateFrom);
      return { dpp: dpp.length, um };
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
        hinweis: `Pseudo-Periode auf Tag vor Untis-Periode ${p1.termId} (${p1.dateFrom}) gesetzt; ${result.dpp} Lehrer-Zeilen angepasst`,
        korrekturenUmgehaengt: result.um.umgehaengt,
        korrekturenVerworfen: result.um.verworfen,
        nachtraegeUmgehaengt: result.um.nachtraegeUmgehaengt,
        nachtraegeVerworfen: result.um.nachtraegeVerworfen,
        pseudoZeilenEntferntWegenKorrektur: result.um.dppEntfernt,
      },
      "n8n",
    );
    return {
      aktion: "gekuerzt",
      sy,
      neuesBis,
      dppGeaendert: result.dpp + result.um.dppEntfernt,
      korrekturenUmgehaengt: result.um.umgehaengt.length,
      korrekturenVerworfen: result.um.verworfen.length,
      nachtraegeUmgehaengt: result.um.nachtraegeUmgehaengt,
      nachtraegeVerworfen: result.um.nachtraegeVerworfen,
      termGeloescht: false,
    };
  }

  // ---- Sonderfall: Periode 1 beginnt am/vor dem Pseudo-Start → entfernen ----
  const r = await db.transaction(async (tx) => {
    // Alle Pseudo-Korrekturen umhaengen (jeder Stichtag liegt jetzt in einer
    // echten Periode, da Periode 1 am/vor dem Pseudo-Start beginnt).
    const um = await haengeKorrekturenUm(tx, sy, echteTerms, pseudo.dateFrom);
    // ALT-Seite (seltener Fall: Wechsel AUS der Pseudo-Periode heraus).
    const korAlt = (await tx.execute(sql`
      UPDATE deputat_aenderung_korrekturen k
         SET term_id_alt = ${letzte.termId}, updated_at = now()
       WHERE k.sy_alt = ${sy} AND k.term_id_alt = ${UNTIS_PSEUDO_TERM_ID}
      RETURNING k.id
    `)) as unknown as Array<{ id: number }>;
    // Reste an der Pseudo-Periode (Stichtag vor Periode 1 kann hier nicht
    // vorkommen; alles andere ist Konfliktrest) entfernen.
    const korRest = (await tx.execute(sql`
      DELETE FROM deputat_aenderung_korrekturen k
       WHERE (k.sy_neu = ${sy} AND k.term_id_neu = ${UNTIS_PSEUDO_TERM_ID})
      RETURNING k.id, k.lehrer_id, k.tatsaechliches_datum
    `)) as unknown as Array<Record<string, unknown>>;
    const naRest = (await tx.execute(sql`
      DELETE FROM deputat_nachtraege n
       WHERE (n.sy_neu = ${sy} AND n.term_neu = ${UNTIS_PSEUDO_TERM_ID})
          OR (n.sy_alt = ${sy} AND n.term_alt = ${UNTIS_PSEUDO_TERM_ID})
      RETURNING n.id
    `)) as unknown as Array<{ id: number }>;
    const dpp = await tx
      .delete(schema.deputatProPeriode)
      .where(
        and(
          eq(schema.deputatProPeriode.untisSchoolyearId, sy),
          eq(schema.deputatProPeriode.untisTermId, UNTIS_PSEUDO_TERM_ID),
        ),
      )
      .returning({ id: schema.deputatProPeriode.id });
    const term = await tx
      .delete(schema.untisTerms)
      .where(
        and(
          eq(schema.untisTerms.schoolYearId, sy),
          eq(schema.untisTerms.termId, UNTIS_PSEUDO_TERM_ID),
        ),
      )
      .returning({ termId: schema.untisTerms.termId });
    return { um, korAlt, korRest, naRest, dpp: dpp.length, termGeloescht: term.length > 0 };
  });

  await writeAuditLog(
    "untis_terms",
    0,
    "DELETE",
    { schoolYearId: sy, termId: PSEUDO, dateFrom: pseudo.dateFrom, dateTo: pseudo.dateTo },
    {
      hinweis: `Pseudo-Periode entfernt: Untis-Periode ${p1.termId} beginnt am ${p1.dateFrom} (am/vor Pseudo-Start)`,
      korrekturenUmgehaengt: r.um.umgehaengt,
      korrekturenAltSeite: r.korAlt.length,
      korrekturenVerworfen: [...r.um.verworfen, ...r.korRest],
      nachtraegeUmgehaengt: r.um.nachtraegeUmgehaengt,
      nachtraegeVerworfen: r.um.nachtraegeVerworfen + r.naRest.length,
      dppGeloescht: r.dpp,
    },
    "n8n",
  );

  return {
    aktion: "entfernt",
    sy,
    dppGeaendert: r.dpp,
    korrekturenUmgehaengt: r.um.umgehaengt.length + r.korAlt.length,
    korrekturenVerworfen: r.um.verworfen.length + r.korRest.length,
    nachtraegeUmgehaengt: r.um.nachtraegeUmgehaengt,
    nachtraegeVerworfen: r.um.nachtraegeVerworfen + r.naRest.length,
    termGeloescht: r.termGeloescht,
  };
}
