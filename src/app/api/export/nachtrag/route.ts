/**
 * GET /api/export/nachtrag?aenderungId=X
 *
 * Generiert einen Vertragsnachtrag als Word-Dokument (.docx)
 * fuer eine gehaltsrelevante Deputatsaenderung.
 * Setzt den nachtragStatus auf "erstellt".
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import { getAenderungFuerNachtrag } from "@/lib/db/queries";
import { generateNachtragDocx } from "@/lib/export/docx";
import { db } from "@/db";
import { deputatAenderungen } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MONATE_KURZ } from "@/lib/constants";
import { writeAuditLog } from "@/lib/audit";

import { getSchulformLang, REGELSTUNDEN_DEFAULT } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Nicht authentifiziert.", { status: 401 });
  }

  const aenderungId = Number(request.nextUrl.searchParams.get("aenderungId"));
  if (!aenderungId || isNaN(aenderungId)) {
    return new Response("aenderungId fehlt oder ungueltig.", { status: 400 });
  }

  const aenderung = await getAenderungFuerNachtrag(aenderungId);
  if (!aenderung) {
    return new Response("Aenderung nicht gefunden.", { status: 404 });
  }

  // Datum formatieren
  const datum = aenderung.tatsaechlichesDatum
    ? new Date(aenderung.tatsaechlichesDatum + "T00:00:00").toLocaleDateString("de-DE")
    : aenderung.geaendertAm.toLocaleDateString("de-DE");

  // DOCX generieren
  const docxBuffer = await generateNachtragDocx({
    lehrerVollname: aenderung.lehrerName,
    personalnummer: aenderung.personalnummer ?? "",
    altStunden: Number(aenderung.deputatGesamtAlt ?? 0).toFixed(1),
    neuStunden: Number(aenderung.deputatGesamtNeu ?? 0).toFixed(1),
    regelstunden: REGELSTUNDEN_DEFAULT,
    schuleName: aenderung.schuleName ?? "Freie Evangelische Schulen Minden",
    schulformLang: getSchulformLang(aenderung.schulform),
    aenderungsDatum: datum,
  });

  // Status auf "erstellt" setzen + Audit-Log parallel
  await Promise.all([
    db
      .update(deputatAenderungen)
      .set({
        nachtragStatus: "erstellt",
        nachtragErstelltAm: new Date(),
        nachtragErstelltVon: session.name,
      })
      .where(eq(deputatAenderungen.id, aenderungId)),
    writeAuditLog(
      "deputat_aenderungen",
      aenderungId,
      "UPDATE",
      { nachtragStatus: null },
      { nachtragStatus: "erstellt" },
      session.name
    ),
  ]);

  // Dateiname: Nachtrag_Nachname_Monat_Jahr.docx
  const monat = MONATE_KURZ[aenderung.monat - 1] ?? String(aenderung.monat);
  const nachname = aenderung.lehrerName.split(/\s+/)[0] ?? "Lehrkraft";
  const filename = `Nachtrag_${nachname}_${monat}_${aenderung.haushaltsjahrId}.docx`;

  return new Response(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
