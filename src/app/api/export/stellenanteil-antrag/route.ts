/**
 * GET /api/export/stellenanteil-antrag?id=X
 *
 * Generiert einen Antrag auf zusaetzliche Stellenanteile als Word-Dokument (.docx).
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import { getStellenanteilById } from "@/lib/db/queries";
import { generateStellenanteilAntragDocx } from "@/lib/export/stellenanteil-antrag";
import { db } from "@/db";
import { stellenanteile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Nicht authentifiziert.", { status: 401 });
  }

  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!id || isNaN(id)) {
    return new Response("id fehlt oder ungueltig.", { status: 400 });
  }

  const sa = await getStellenanteilById(id);
  if (!sa) {
    return new Response("Stellenanteil nicht gefunden.", { status: 404 });
  }

  const heute = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const wertFormatiert = Number(sa.wert).toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 4,
  });

  const antragText = sa.lehrerId
    ? `die zusaetzlichen Stellenanteile (${wertFormatiert} Stellen) fuer ${sa.stellenartBezeichnung}: ${sa.lehrerName}`
    : `die zusaetzlichen Stellenanteile (${wertFormatiert} Stellen) fuer ${sa.stellenartBezeichnung}`;

  const betreffzeile = sa.lehrerId
    ? `Antrag auf zusaetzliche Stellenanteile fuer ${sa.stellenartBezeichnung} — ${sa.lehrerName}`
    : `Antrag auf zusaetzliche Stellenanteile fuer ${sa.stellenartBezeichnung}`;

  const docxBuffer = await generateStellenanteilAntragDocx({
    brBehoerde: "Bezirksregierung Detmold",
    brAnsprechpartner: "",
    brStrasse: "Leopoldstrasse 15",
    brPlzOrt: "32756 Detmold",
    absenderName: session.name,
    absenderTelefon: "",
    datum: heute,
    betreffzeile,
    lehrerName: sa.lehrerName ?? "",
    schuleName: "",
    schuleOrt: "",
    schulform: "",
    schuleStandort: "",
    schuljahr: "",
    antragText,
    stellenartBezeichnung: sa.stellenartBezeichnung,
    wert: wertFormatiert,
    aktenzeichen: sa.aktenzeichen ?? "",
  });

  // Audit-Log
  await writeAuditLog(
    "stellenanteile",
    id,
    "UPDATE",
    null,
    { aktion: "antrag_docx_erstellt" },
    session.name
  );

  const bezeichnung = sa.stellenartBezeichnung.replace(/\s+/g, "_");
  const lehrerTeil = sa.lehrerName ? `_${sa.lehrerName.split(/\s+/)[0]}` : "";
  const filename = `Antrag_${bezeichnung}${lehrerTeil}_${heute.replace(/\./g, "-")}.docx`;

  return new Response(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
