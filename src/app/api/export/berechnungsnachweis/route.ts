/**
 * GET /api/export/berechnungsnachweis?haushaltsjahrId=X
 *
 * Detaillierter Berechnungsnachweis als PDF.
 * Zeigt alle Zwischenschritte (Truncation, Rundung) fuer Pruefungszwecke.
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import {
  getSchulen,
  getAktuelleStellensollBySchule,
  getAktuelleStellenisteBySchule,
  getAktuelleVergleiche,
} from "@/lib/db/queries";
import {
  createPdf,
  addPdfHeader,
  addPdfSchulHeader,
  addPdfText,
  addPdfTable,
  addPdfPageNumbers,
  pdfToBuffer,
  pdfResponse,
} from "@/lib/export/pdf";

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
    const vergleiche = await getAktuelleVergleiche(haushaltsjahrId);

    const doc = createPdf(false); // Portrait
    let y = addPdfHeader(
      doc,
      "Berechnungsnachweis",
      `Haushaltsjahr ${haushaltsjahrId} -Alle Zwischenschritte`
    );

    // Inhaltsverzeichnis
    y = addPdfText(doc, "Inhalt:", y, { bold: true, size: 11 });
    for (const schule of schulen) {
      y = addPdfText(doc, `-${schule.kurzname} -${schule.name}`, y, { indent: 5 });
    }

    // Pro Schule eine Detail-Seite
    for (const schule of schulen) {
      doc.addPage();

      y = addPdfHeader(doc, `Berechnungsnachweis -${schule.kurzname}`, schule.name);

      // Stellensoll laden
      const sollErgebnisse = await getAktuelleStellensollBySchule(schule.id, haushaltsjahrId);
      const istErgebnisse = await getAktuelleStellenisteBySchule(schule.id, haushaltsjahrId);
      const vergleich = vergleiche.find((v) => v.schuleId === schule.id);

      if (sollErgebnisse.length === 0 && istErgebnisse.length === 0) {
        y = addPdfText(doc, "Keine Berechnungsdaten vorhanden.", y);
        continue;
      }

      let abschnitt = 1;

      // --- STELLENSOLL pro Zeitraum ---
      for (const soll of sollErgebnisse) {
        const zeitraumLabel = soll.zeitraum === "jan-jul" ? "Januar - Juli" : "August - Dezember";
        y = addPdfSchulHeader(doc, schule.kurzname, zeitraumLabel, schule.farbe, y);

        // 1. Grundstellen
        y = addPdfText(doc, `${abschnitt}. GRUNDSTELLEN (${zeitraumLabel})`, y, { bold: true, size: 11 });
        abschnitt++;

        const details = parseJsonArray(soll.grundstellenDetails);
        const grundstellenSumme = num(soll.grundstellenSumme);
        const grundstellenGerundet = num(soll.grundstellenGerundet);

        if (details.length > 0) {
          const grundHead = [["Stufe", "Schueler", "SLR", "Rohwert", "Abgeschnitten (2 Dez.)"]];
          const grundBody: (string | { content: string; styles?: Record<string, unknown> })[][] = details.map((d) => [
            String(d.stufe ?? d.schulformTyp ?? ""),
            String(d.schueler ?? 0),
            fmtNum(d.slr),
            fmtNum(d.rohErgebnis, 6),
            fmtNum(d.truncErgebnis),
          ]);
          // Summenzeilen direkt in die Tabelle
          grundBody.push([
            { content: "Summe (ungerundet)", styles: { fontStyle: "italic" } },
            "", "", "",
            { content: fmtNum(grundstellenSumme), styles: { fontStyle: "italic", halign: "right" } },
          ]);
          grundBody.push([
            { content: "Grundstellen (gerundet)", styles: { fontStyle: "bold" } },
            "", "", "",
            { content: fmtNum(grundstellenGerundet, 1), styles: { fontStyle: "bold", halign: "right" } },
          ]);
          y = addPdfTable(doc, y, grundHead, grundBody, {
            columnStyles: {
              1: { halign: "right" },
              2: { halign: "right" },
              3: { halign: "right" },
              4: { halign: "right" },
            },
          });
        }
        y += 2;

        // 2. Zuschlaege
        const zuschlaege = parseJsonArray(soll.zuschlaege_details);
        if (zuschlaege.length > 0) {
          y = addPdfText(doc, `${abschnitt}. ZUSCHLAEGE (${zeitraumLabel})`, y, { bold: true, size: 11 });
          abschnitt++;

          const zuHead = [["Bezeichnung", "Wert (Stellen)"]];
          const zuBody = zuschlaege.map((z) => [
            String(z.bezeichnung ?? ""),
            fmtNum(z.wert),
          ]);
          y = addPdfTable(doc, y, zuHead, zuBody, {
            columnStyles: { 1: { halign: "right" } },
          });

          y = addPdfText(doc, `Zuschlaege gesamt: ${fmtNum(soll.zuschlaegeSumme)}`, y, { indent: 5, bold: true });
          y += 2;
        }

        // 3. Stellensoll
        y = addPdfText(doc, `${abschnitt}. STELLENSOLL (${zeitraumLabel})`, y, { bold: true, size: 11 });
        abschnitt++;

        const zuschlaegeSumme = num(soll.zuschlaegeSumme);
        const stellensoll = num(soll.stellensoll);
        y = addPdfText(doc, `${fmtNum(grundstellenGerundet)} + ${fmtNum(zuschlaegeSumme)} = ${fmtNum(stellensoll)}`, y, { indent: 5, size: 11 });
        y += 4;

        // Seitenumbruch pruefen
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
      }

      // --- STELLENIST pro Zeitraum ---
      for (const ist of istErgebnisse) {
        const zeitraumLabel = ist.zeitraum === "jan-jul" ? "Januar - Juli" : "August - Dezember";

        y = addPdfText(doc, `${abschnitt}. STELLENIST (${zeitraumLabel})`, y, { bold: true, size: 11 });
        abschnitt++;

        y = addPdfText(doc, `Monatsdurchschnitt Stunden: ${fmtNum(ist.monatsDurchschnittStunden)}`, y, { indent: 5 });
        y = addPdfText(doc, `Regelstundendeputat: ${fmtNum(ist.regelstundendeputat)}`, y, { indent: 5 });
        y = addPdfText(doc, `Stellenist (roh): ${fmtNum(ist.stellenist)}`, y, { indent: 5 });
        y = addPdfText(doc, `Stellenist (gerundet): ${fmtNum(ist.stellenistGerundet)}`, y, { indent: 5 });
        y = addPdfText(doc, `Mehrarbeit (Stellen): ${fmtNum(ist.mehrarbeitStellen)}`, y, { indent: 5 });
        y = addPdfText(doc, `Stellenist gesamt: ${fmtNum(ist.stellenistGesamt)}`, y, { indent: 5, bold: true });
        y += 4;

        if (y > 250) {
          doc.addPage();
          y = 20;
        }
      }

      // --- VERGLEICH ---
      if (vergleich) {
        y = addPdfText(doc, `${abschnitt}. JAHRESVERGLEICH`, y, { bold: true, size: 11 });

        const vHead = [["Kennzahl", "Wert"]];
        const vBody = [
          ["Stellensoll (gewichtet)", fmtNum(vergleich.stellensoll)],
          ["Stellenist (gewichtet)", fmtNum(vergleich.stellenist)],
          ["Differenz (Ist - Soll)", fmtNum(vergleich.differenz)],
          ["Status", vergleich.status === "im_soll" ? "Im Soll" : vergleich.status === "grenzbereich" ? "Grenzbereich" : "Ueber Soll"],
          ["Refinanzierung", fmtNum(vergleich.refinanzierung)],
        ];
        y = addPdfTable(doc, y, vHead, vBody, {
          columnStyles: { 1: { halign: "right" } },
        });
      }
    }

    addPdfPageNumbers(doc);
    const buffer = pdfToBuffer(doc);
    return pdfResponse(buffer, `Berechnungsnachweis_HJ${haushaltsjahrId}.pdf`);
  } catch (err) {
    console.error("Export-Fehler:", err);
    return new Response("Fehler beim Erstellen des Exports.", { status: 500 });
  }
}

// ============================================================
// HELPERS
// ============================================================

function num(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val) || 0;
}

/**
 * Formatiert Zahlen PDF-sicher (ohne Unicode-Sonderzeichen).
 * jsPDF/Helvetica kann kein Unicode-Minus (U+2212), schmalen Leerraum etc.
 * → Ergebnis nur mit ASCII-Zeichen.
 */
function fmtNum(val: unknown, decimals = 2): string {
  const n = num(val);
  const formatted = n.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  });
  // Unicode-Minus (−) → ASCII-Hyphen (-), schmale Leerzeichen → normal
  return formatted
    .replace(/\u2212/g, "-")
    .replace(/[\u00A0\u2009\u202F]/g, " ");
}

function parseJsonArray(val: unknown): Record<string, unknown>[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}
