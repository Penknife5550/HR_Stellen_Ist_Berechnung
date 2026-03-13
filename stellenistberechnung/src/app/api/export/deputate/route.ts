/**
 * GET /api/export/deputate?haushaltsjahrId=X&format=pdf|excel&schuleId=Y (optional)
 *
 * Deputatsuebersicht — monatliche Wochenstunden aller Lehrkraefte.
 * Optional gefiltert nach Schule.
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import { getLehrerMitDeputaten, getSchulen } from "@/lib/db/queries";
import {
  createWorkbook,
  addHeaderRow,
  setColumnWidths,
  addSummenRow,
  workbookToBuffer,
  excelResponse,
} from "@/lib/export/excel";
import {
  createPdf,
  addPdfHeader,
  addPdfTable,
  addPdfPageNumbers,
  pdfToBuffer,
  pdfResponse,
} from "@/lib/export/pdf";

const MONATSNAMEN = ["Jan", "Feb", "Maer", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Nicht authentifiziert.", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const haushaltsjahrId = Number(searchParams.get("haushaltsjahrId"));
  const format = searchParams.get("format") ?? "excel";
  const schuleId = searchParams.get("schuleId") ? Number(searchParams.get("schuleId")) : undefined;

  if (!haushaltsjahrId || haushaltsjahrId <= 0) {
    return new Response("haushaltsjahrId fehlt.", { status: 400 });
  }

  try {
    const rawData = await getLehrerMitDeputaten(haushaltsjahrId, schuleId);
    const schulen = await getSchulen();

    // Daten zu Lehrer-Grid aggregieren
    const lehrerMap = new Map<number, {
      name: string;
      stammschule: string;
      monate: Map<number, number>;
    }>();

    for (const row of rawData) {
      if (!lehrerMap.has(row.lehrerId)) {
        lehrerMap.set(row.lehrerId, {
          name: row.name,
          stammschule: row.stammschuleCode ?? "—",
          monate: new Map(),
        });
      }
      lehrerMap.get(row.lehrerId)!.monate.set(row.monat, Number(row.deputatGesamt) || 0);
    }

    const lehrerListe = Array.from(lehrerMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    // Schul-Kurzname fuer Dateinamen
    const schuleName = schuleId
      ? schulen.find((s) => s.id === schuleId)?.kurzname ?? "Schule"
      : "Alle";

    if (format === "pdf") {
      return generatePdf(lehrerListe, haushaltsjahrId, schuleName);
    }
    return generateExcel(lehrerListe, haushaltsjahrId, schuleName);
  } catch (err) {
    console.error("Export-Fehler:", err);
    return new Response("Fehler beim Erstellen des Exports.", { status: 500 });
  }
}

// ============================================================
// TYPES
// ============================================================

interface LehrerRow {
  id: number;
  name: string;
  stammschule: string;
  monate: Map<number, number>;
}

// ============================================================
// EXCEL
// ============================================================

async function generateExcel(
  lehrerListe: LehrerRow[],
  haushaltsjahrId: number,
  schuleName: string
) {
  const wb = createWorkbook();
  const ws = wb.addWorksheet("Deputate");

  setColumnWidths(ws, [6, 28, 12, ...Array(12).fill(10), 10]);

  const headers = ["Nr", "Name", "Stammschule", ...MONATSNAMEN, "Durchschnitt"];
  addHeaderRow(ws, headers);

  // Summen fuer Fusszeile
  const monatsSummen = new Array(12).fill(0);
  let gesamtSumme = 0;

  lehrerListe.forEach((l, index) => {
    const monatswerte = [];
    let summe = 0;
    let anzahl = 0;

    for (let m = 1; m <= 12; m++) {
      const val = l.monate.get(m) ?? 0;
      monatswerte.push(val || null);
      if (val > 0) {
        summe += val;
        anzahl++;
        monatsSummen[m - 1] += val;
      }
    }

    const durchschnitt = anzahl > 0 ? summe / anzahl : 0;
    gesamtSumme += durchschnitt;

    ws.addRow([
      index + 1,
      l.name,
      l.stammschule,
      ...monatswerte.map((v) => v ?? ""),
      durchschnitt > 0 ? Math.round(durchschnitt * 100) / 100 : "",
    ]);
  });

  // Summenzeile
  addSummenRow(ws, [
    "",
    `Summe (${lehrerListe.length} Lehrkraefte)`,
    "",
    ...monatsSummen.map((s) => Math.round(s * 100) / 100),
    Math.round(gesamtSumme * 100) / 100,
  ]);

  const buffer = await workbookToBuffer(wb);
  return excelResponse(buffer, `Deputate_${schuleName}_HJ${haushaltsjahrId}.xlsx`);
}

// ============================================================
// PDF
// ============================================================

function generatePdf(
  lehrerListe: LehrerRow[],
  haushaltsjahrId: number,
  schuleName: string
) {
  const doc = createPdf(true); // Landscape
  let y = addPdfHeader(
    doc,
    `Deputatsuebersicht — ${schuleName}`,
    `Haushaltsjahr ${haushaltsjahrId} | ${lehrerListe.length} Lehrkraefte`
  );

  const head = [["Nr", "Name", "Stamm", ...MONATSNAMEN, "Ø"]];
  const body = lehrerListe.map((l, index) => {
    let summe = 0;
    let anzahl = 0;
    const monatswerte = [];

    for (let m = 1; m <= 12; m++) {
      const val = l.monate.get(m) ?? 0;
      monatswerte.push(val > 0 ? val.toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "—");
      if (val > 0) { summe += val; anzahl++; }
    }

    const avg = anzahl > 0 ? (summe / anzahl).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "—";

    return [String(index + 1), l.name, l.stammschule, ...monatswerte, avg];
  });

  addPdfTable(doc, y, head, body, {
    styles: { fontSize: 7 },
    headStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 12 },
    },
  });

  addPdfPageNumbers(doc);
  const buffer = pdfToBuffer(doc);
  return pdfResponse(buffer, `Deputate_${schuleName}_HJ${haushaltsjahrId}.pdf`);
}
