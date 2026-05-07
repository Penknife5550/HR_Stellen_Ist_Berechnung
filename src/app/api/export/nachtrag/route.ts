/**
 * GET /api/export/nachtrag?lehrerId=&syAlt=&termAlt=&syNeu=&termNeu=
 *
 * Generiert einen Vertragsnachtrag als Word-Dokument (.docx) fuer einen
 * gehaltsrelevanten Wertwechsel aus dem Periodenmodell
 * (v_deputat_aenderungen).
 *
 * Setzt zugleich den Bearbeitungsstatus in deputat_nachtraege auf
 * "erstellt" (Upsert).
 *
 * Auth: erfordert Mitarbeiter-Rolle (PII-Schutz, DSGVO Art. 30) — analog zu
 * /api/export/lehrer-detail und /api/export/stellenist-drilldown.
 */

import { NextRequest } from "next/server";
import { getOptionalSession, ROLE_LEVEL } from "@/lib/auth/permissions";
import {
  getWertwechselFuerNachtrag,
  upsertNachtragStatus,
} from "@/lib/db/queries";
import { generateNachtragDocx } from "@/lib/export/docx";
import { writeAuditLog } from "@/lib/audit";

import { getSchulformLang, REGELSTUNDEN_DEFAULT } from "@/lib/constants";

function parseIntParam(req: NextRequest, name: string): number | null {
  const raw = req.nextUrl.searchParams.get(name);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Whitelist-Sanitize fuer Filename-Bestandteile:
 * verhindert Header-Injection (CR/LF) und Anfuehrungszeichen-Bruch im
 * Content-Disposition `filename="..."`.
 */
function sanitizeFilenamePart(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[^A-Za-z0-9_\-äöüÄÖÜß]/g, "_")
    .slice(0, 60);
  return cleaned.replace(/_+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Bitte erneut anmelden.", { status: 401 });
  }
  if (ROLE_LEVEL[session.rolle] < ROLE_LEVEL["mitarbeiter"]) {
    return new Response("Keine Berechtigung fuer Nachtrag-Export.", { status: 403 });
  }

  const lehrerId = parseIntParam(request, "lehrerId");
  const syAlt = parseIntParam(request, "syAlt");
  const termAlt = parseIntParam(request, "termAlt");
  const syNeu = parseIntParam(request, "syNeu");
  const termNeu = parseIntParam(request, "termNeu");

  if (!lehrerId || !syAlt || !termAlt || !syNeu || !termNeu) {
    return new Response(
      "Ungueltige Anfrage — bitte Seite neu laden.",
      { status: 400 },
    );
  }

  try {
    const wechsel = await getWertwechselFuerNachtrag({
      lehrerId,
      syAlt,
      termAlt,
      syNeu,
      termNeu,
    });
    if (!wechsel) {
      return new Response("Dieser Wertwechsel existiert nicht mehr.", { status: 404 });
    }

    const datumIso = wechsel.effektiv_wirksam_ab;
    const datumDe = new Date(datumIso + "T12:00:00").toLocaleDateString("de-DE");

    // Audit ZUERST: dokumentiert die PII-Verarbeitung auch wenn die spaetere
    // Doc-Generierung scheitert (DSGVO Art. 30).
    await writeAuditLog(
      "deputat_nachtraege",
      lehrerId,
      "UPDATE",
      null,
      { lehrerId, syAlt, termAlt, syNeu, termNeu, format: "docx", action: "export" },
      session.name,
    );

    const docxBuffer = await generateNachtragDocx({
      lehrerVollname: wechsel.lehrer_name,
      personalnummer: wechsel.personalnummer ?? "",
      altStunden: Number(wechsel.gesamt_alt ?? 0).toFixed(1),
      neuStunden: Number(wechsel.gesamt_neu ?? 0).toFixed(1),
      regelstunden: REGELSTUNDEN_DEFAULT,
      schuleName: wechsel.schule_name ?? "Freie Evangelische Schulen Minden",
      schulformLang: getSchulformLang(wechsel.schulform),
      aenderungsDatum: datumDe,
    });

    // Status erst NACH erfolgreicher Doc-Erstellung. upsertNachtragStatus
    // erhaelt erstelltAm/Von der Erstgenerierung via COALESCE — kein
    // Audit-Verlust bei Re-Generierung durch zweiten User.
    await upsertNachtragStatus({
      lehrerId,
      syAlt,
      termAlt,
      syNeu,
      termNeu,
      status: "erstellt",
      erstelltVon: session.name,
    });

    const nachname = sanitizeFilenamePart(
      wechsel.lehrer_name.trim().split(/\s+/)[0] ?? "",
      "Lehrkraft",
    );
    const [yyyy, mm, dd] = datumIso.split("-");
    const filename = `Nachtrag_${nachname}_${dd}${mm}_${yyyy}.docx`;

    return new Response(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("nachtrag/route GET", err);
    return new Response(
      "Nachtrag konnte nicht erstellt werden — bitte Admin kontaktieren.",
      { status: 500 },
    );
  }
}
