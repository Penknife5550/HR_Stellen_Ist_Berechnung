/**
 * GET /api/export/stellenplan?haushaltsjahrId=X&format=pdf|excel
 *
 * Stellenplanuebersicht (Anlage 2a) — offizielles Format fuer die Bezirksregierung.
 * Pro Schule: Grundstellen, Zuschlaege, Stellensoll, Stellenist, Differenz.
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import {
  getSchulen,
  getAktuelleStellensollBySchule,
  getAktuelleStellenisteAlleSchulen,
  getAktuelleVergleiche,
} from "@/lib/db/queries";
import {
  createWorkbook,
  addHeaderRow,
  addSchulHeader,
  setColumnWidths,
  addSummenRow,
  addEmptyRow,
  workbookToBuffer,
  excelResponse,
} from "@/lib/export/excel";
import {
  createPdf,
  addPdfHeader,
  addPdfSchulHeader,
  addPdfTable,
  addPdfPageNumbers,
  pdfToBuffer,
  pdfResponse,
} from "@/lib/export/pdf";
import { num, numStr, fmtNum, parseJsonArray, statusLabel } from "@/lib/export/helpers";

export async function GET(request: NextRequest) {
  // Auth pruefen
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Nicht authentifiziert.", { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const haushaltsjahrId = Number(searchParams.get("haushaltsjahrId"));
  const format = searchParams.get("format") ?? "excel";

  if (!haushaltsjahrId || haushaltsjahrId <= 0) {
    return new Response("haushaltsjahrId fehlt.", { status: 400 });
  }

  try {
    // Daten laden
    const schulen = await getSchulen();
    const vergleiche = await getAktuelleVergleiche(haushaltsjahrId);
    const istDaten = await getAktuelleStellenisteAlleSchulen(haushaltsjahrId);

    // Pro Schule Soll-Daten mit Details laden
    const sollProSchule = await Promise.all(
      schulen.map(async (s) => ({
        schule: s,
        ergebnisse: await getAktuelleStellensollBySchule(s.id, haushaltsjahrId),
      }))
    );

    if (format === "pdf") {
      return generatePdf(sollProSchule, istDaten, vergleiche, haushaltsjahrId);
    }
    return generateExcel(sollProSchule, istDaten, vergleiche, haushaltsjahrId);
  } catch (err) {
    console.error("Export-Fehler:", err);
    return new Response("Fehler beim Erstellen des Exports.", { status: 500 });
  }
}

// ============================================================
// EXCEL
// ============================================================

interface SchulSollDaten {
  schule: { id: number; kurzname: string; name: string; farbe: string };
  ergebnisse: {
    zeitraum: string;
    grundstellenDetails: unknown;
    grundstellenGerundet: string | null;
    zuschlaegeSumme: string | null;
    stellensoll: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IstRow = { schuleId: number; schulKurzname: string; zeitraum: string; stellenistGesamt: string | null; [key: string]: any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VergleichRow = { schulKurzname: string; stellensoll: string | null; stellenist: string | null; differenz: string | null; status: string | null; refinanzierung: string | null; [key: string]: any };

async function generateExcel(
  sollProSchule: SchulSollDaten[],
  istDaten: IstRow[],
  vergleiche: VergleichRow[],
  haushaltsjahrId: number
) {
  const wb = createWorkbook();

  // --- Sheet 1: Uebersicht ---
  const ueb = wb.addWorksheet("Uebersicht");
  setColumnWidths(ueb, [18, 20, 18, 18, 18, 18]);
  addHeaderRow(ueb, ["Schule", "Stellensoll", "Stellenist", "Differenz", "Status", "Refinanzierung"]);

  for (const v of vergleiche) {
    const statusText = statusLabel(v.status);

    ueb.addRow([
      v.schulKurzname,
      num(v.stellensoll),
      num(v.stellenist),
      num(v.differenz),
      statusText,
      num(v.refinanzierung),
    ]);
  }

  // --- Sheet pro Schule ---
  for (const { schule, ergebnisse } of sollProSchule) {
    if (ergebnisse.length === 0) continue;

    const ws = wb.addWorksheet(schule.kurzname);
    setColumnWidths(ws, [16, 24, 14, 12, 16, 16]);

    for (const erg of ergebnisse) {
      const zeitraumLabel = erg.zeitraum === "jan-jul" ? "Januar – Juli" : "August – Dezember";
      addSchulHeader(ws, schule.kurzname, `${schule.name} — ${zeitraumLabel}`, schule.farbe, 6);

      // Grundstellen-Details
      addHeaderRow(ws, ["Zeitraum", "Stufe", "Schueler", "SLR", "Rohwert", "Abgeschnitten"]);

      const details = parseJsonArray(erg.grundstellenDetails);
      for (const d of details) {
        ws.addRow([
          zeitraumLabel,
          d.stufe ?? d.schulformTyp ?? "",
          d.schueler ?? 0,
          num(d.slr),
          numStr(d.rohErgebnis),
          numStr(d.truncErgebnis),
        ]);
      }

      addSummenRow(ws, ["", "Grundstellen gesamt", "", "", "", num(erg.grundstellenGerundet)]);

      // Zuschlaege
      const zuschlaege = parseJsonArray(erg.zuschlaege_details);
      if (zuschlaege.length > 0) {
        addEmptyRow(ws);
        addHeaderRow(ws, ["", "Zuschlag", "", "", "", "Wert"]);
        for (const z of zuschlaege) {
          ws.addRow(["", z.bezeichnung ?? "", "", "", "", num(z.wert)]);
        }
        addSummenRow(ws, ["", "Zuschlaege gesamt", "", "", "", num(erg.zuschlaegeSumme)]);
      }

      // Stellensoll
      addEmptyRow(ws);
      const sollRow = addSummenRow(ws, ["", "STELLENSOLL", "", "", "", num(erg.stellensoll)]);
      sollRow.eachCell((cell) => { cell.font = { bold: true, size: 12, name: "Calibri" }; });

      // Stellenist fuer diese Schule + Zeitraum
      const ist = istDaten.find(
        (i) => i.schuleId === schule.id && i.zeitraum === erg.zeitraum
      );
      if (ist) {
        ws.addRow(["", "Stellenist", "", "", "", num(ist.stellenistGesamt)]);
      }

      addEmptyRow(ws);
      addEmptyRow(ws);
    }

    // Vergleich fuer diese Schule
    const vgl = vergleiche.find((v) => v.schulKurzname === schule.kurzname);
    if (vgl) {
      addHeaderRow(ws, ["", "Jahresvergleich", "", "", "", "Wert"]);
      ws.addRow(["", "Stellensoll (gewichtet)", "", "", "", num(vgl.stellensoll)]);
      ws.addRow(["", "Stellenist (gewichtet)", "", "", "", num(vgl.stellenist)]);
      const diffRow = addSummenRow(ws, ["", "Differenz", "", "", "", num(vgl.differenz)]);
      diffRow.eachCell((cell) => { cell.font = { bold: true, size: 11, name: "Calibri" }; });
      ws.addRow(["", "Refinanzierung", "", "", "", num(vgl.refinanzierung)]);
    }
  }

  const buffer = await workbookToBuffer(wb);
  return excelResponse(buffer, `Stellenplan_HJ${haushaltsjahrId}.xlsx`);
}

// ============================================================
// PDF
// ============================================================

function generatePdf(
  sollProSchule: SchulSollDaten[],
  istDaten: IstRow[],
  vergleiche: VergleichRow[],
  haushaltsjahrId: number
) {
  const doc = createPdf(true); // Landscape
  let y = addPdfHeader(doc, "Stellenplanuebersicht (Anlage 2a)", `Haushaltsjahr ${haushaltsjahrId}`);

  // Uebersicht-Tabelle
  const head = [["Schule", "Stellensoll", "Stellenist", "Differenz", "Status", "Refinanzierung"]];
  const body = vergleiche.map((v) => [
    v.schulKurzname,
    fmtNum(v.stellensoll),
    fmtNum(v.stellenist),
    fmtNum(v.differenz),
    statusLabel(v.status),
    fmtNum(v.refinanzierung),
  ]);
  y = addPdfTable(doc, y, head, body);

  // Pro Schule eine Detail-Seite
  for (const { schule, ergebnisse } of sollProSchule) {
    if (ergebnisse.length === 0) continue;

    doc.addPage();
    y = addPdfHeader(doc, `Stellenplan — ${schule.kurzname}`, schule.name);

    for (const erg of ergebnisse) {
      const zeitraumLabel = erg.zeitraum === "jan-jul" ? "Januar – Juli" : "August – Dezember";
      y = addPdfSchulHeader(doc, schule.kurzname, zeitraumLabel, schule.farbe, y);

      // Grundstellen
      const details = parseJsonArray(erg.grundstellenDetails);
      const grundHead = [["Stufe", "Schueler", "SLR", "Rohwert", "Abgeschnitten"]];
      const grundBody = details.map((d) => [
        d.stufe ?? d.schulformTyp ?? "",
        String(d.schueler ?? 0),
        fmtNum(d.slr),
        fmtNum(d.rohErgebnis),
        fmtNum(d.truncErgebnis),
      ]);
      grundBody.push(["Grundstellen gesamt", "", "", "", fmtNum(erg.grundstellenGerundet)]);
      y = addPdfTable(doc, y, grundHead, grundBody);

      // Zuschlaege
      const zuschlaege = parseJsonArray(erg.zuschlaege_details);
      if (zuschlaege.length > 0) {
        const zuHead = [["Zuschlag", "Wert"]];
        const zuBody = zuschlaege.map((z) => [z.bezeichnung ?? "", fmtNum(z.wert)]);
        zuBody.push(["Zuschlaege gesamt", fmtNum(erg.zuschlaegeSumme)]);
        y = addPdfTable(doc, y, zuHead, zuBody, {
          columnStyles: { 1: { halign: "right" } },
        });
      }

      // Ergebnis
      const ist = istDaten.find((i) => i.schuleId === schule.id && i.zeitraum === erg.zeitraum);
      const ergHead = [["", "Wert"]];
      const ergBody = [
        ["Stellensoll", fmtNum(erg.stellensoll)],
        ["Stellenist", ist ? fmtNum(ist.stellenistGesamt) : "—"],
      ];
      y = addPdfTable(doc, y, ergHead, ergBody, {
        columnStyles: { 1: { halign: "right" } },
      });
      y += 4;
    }
  }

  addPdfPageNumbers(doc);
  const buffer = pdfToBuffer(doc);
  return pdfResponse(buffer, `Stellenplan_HJ${haushaltsjahrId}.pdf`);
}
