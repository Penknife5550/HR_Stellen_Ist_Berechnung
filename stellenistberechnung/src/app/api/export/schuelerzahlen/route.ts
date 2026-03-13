/**
 * GET /api/export/schuelerzahlen?haushaltsjahrId=X
 *
 * Schuelerzahlen-Uebersicht — Excel-Export aller Schulen mit Stichtag-Daten.
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import { getSchulen, getSchuelerzahlenBySchule } from "@/lib/db/queries";
import {
  createWorkbook,
  addHeaderRow,
  addSchulHeader,
  setColumnWidths,
  addEmptyRow,
  workbookToBuffer,
  excelResponse,
} from "@/lib/export/excel";

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Nicht authentifiziert.", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const haushaltsjahrId = Number(searchParams.get("haushaltsjahrId"));

  if (!haushaltsjahrId || haushaltsjahrId <= 0) {
    return new Response("haushaltsjahrId fehlt.", { status: 400 });
  }

  try {
    const schulen = await getSchulen();

    const wb = createWorkbook();

    for (const schule of schulen) {
      const daten = await getSchuelerzahlenBySchule(schule.id);
      if (daten.length === 0) continue;

      const ws = wb.addWorksheet(schule.kurzname);
      setColumnWidths(ws, [18, 28, 16, 12, 30]);

      addSchulHeader(ws, schule.kurzname, schule.name, schule.farbe, 5);
      addEmptyRow(ws);
      addHeaderRow(ws, ["Stufe", "Schulform-Typ", "Stichtag", "Anzahl", "Bemerkung"]);

      for (const row of daten) {
        const stichtag = row.stichtag
          ? new Date(row.stichtag + "T00:00:00").toLocaleDateString("de-DE")
          : "—";

        ws.addRow([
          row.stufe,
          row.schulformTyp,
          stichtag,
          row.anzahl,
          row.bemerkung ?? "",
        ]);
      }
    }

    // Falls keine Daten
    if (wb.worksheets.length === 0) {
      const ws = wb.addWorksheet("Keine Daten");
      ws.addRow(["Keine Schuelerzahlen vorhanden."]);
    }

    const buffer = await workbookToBuffer(wb);
    return excelResponse(buffer, `Schuelerzahlen_HJ${haushaltsjahrId}.xlsx`);
  } catch (err) {
    console.error("Export-Fehler:", err);
    return new Response("Fehler beim Erstellen des Exports.", { status: 500 });
  }
}
