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

        // 2. Zuschlaege / Stellenanteile (gruppiert nach Typ)
        const zuschlaege = parseJsonArray(soll.zuschlaege_details);
        if (zuschlaege.length > 0) {
          // Abschnitt 2: Standard-Stellenzuschlaege (Typ A, deputatswirksam)
          const typA = zuschlaege.filter((z) => z.typ === "A" || (!z.typ && !z.istIsoliert));
          const typA106 = zuschlaege.filter((z) => z.typ === "A_106" || (!z.typ && z.istIsoliert));
          const typB = zuschlaege.filter((z) => z.typ === "B");
          const typC = zuschlaege.filter((z) => z.typ === "C");

          type PdfCell = string | { content: string; styles?: Record<string, unknown> };

          if (typA.length > 0) {
            y = addPdfText(doc, `${abschnitt}. ABSCHNITT 2 - STANDARDZUSCHLAEGE (${zeitraumLabel})`, y, { bold: true, size: 11 });
            abschnitt++;
            const zuHead = [["Kuerzel", "Bezeichnung", "Stellen"]];
            const zuBody: PdfCell[][] = typA.map((z) => [
              String(z.kuerzel ?? ""),
              String(z.bezeichnung ?? ""),
              z.istDeputatswirksam !== false ? fmtNum(z.wert) : "0,00",
            ]);
            const summeA = typA.filter((z) => z.istDeputatswirksam !== false).reduce((s, z) => s + num(z.wert), 0);
            zuBody.push([
              { content: "", styles: {} },
              { content: "Summe Abschnitt 2", styles: { fontStyle: "bold" } },
              { content: fmtNum(summeA), styles: { fontStyle: "bold", halign: "right" } },
            ]);
            y = addPdfTable(doc, y, zuHead, zuBody, {
              columnStyles: { 2: { halign: "right" } },
            });
            y += 2;
          }

          if (typA106.length > 0) {
            y = addPdfText(doc, `${abschnitt}. ABSCHNITT 4 - SONDERBEDARFE PAR. 106 ABS. 10 (${zeitraumLabel})`, y, { bold: true, size: 11 });
            abschnitt++;
            const zuHead = [["Kuerzel", "Bezeichnung", "Stellen"]];
            const zuBody: PdfCell[][] = typA106.map((z) => [
              String(z.kuerzel ?? ""),
              String(z.bezeichnung ?? ""),
              fmtNum(z.wert),
            ]);
            const summe106 = typA106.reduce((s, z) => s + num(z.wert), 0);
            zuBody.push([
              { content: "", styles: {} },
              { content: "Summe Abschnitt 4 (isoliert)", styles: { fontStyle: "bold" } },
              { content: fmtNum(summe106), styles: { fontStyle: "bold", halign: "right" } },
            ]);
            y = addPdfTable(doc, y, zuHead, zuBody, {
              columnStyles: { 2: { halign: "right" } },
            });
            y = addPdfText(doc, "Hinweis: Stellen nach Par. 106 Abs. 10 SchulG erhoehen die Personalbedarfspauschale NICHT.", y, { indent: 5, size: 8 });
            y += 2;
          }

          if (typB.length > 0) {
            y = addPdfText(doc, `${abschnitt}. WAHLLEISTUNGEN - GELD ODER STELLE (${zeitraumLabel})`, y, { bold: true, size: 11 });
            abschnitt++;
            const zuHead = [["Kuerzel", "Bezeichnung", "Wahl", "Stellen", "EUR"]];
            const zuBody = typB.map((z) => [
              String(z.kuerzel ?? ""),
              String(z.bezeichnung ?? ""),
              z.wahlrecht === "stelle" ? "Stelle" : z.wahlrecht === "geld" ? "Geld" : "-",
              z.wahlrecht === "stelle" ? fmtNum(z.wert) : "-",
              z.eurBetrag ? fmtEur(num(z.eurBetrag)) : "-",
            ]);
            y = addPdfTable(doc, y, zuHead, zuBody, {
              columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
            });
            y += 2;
          }

          if (typC.length > 0) {
            y = addPdfText(doc, `${abschnitt}. GELDLEISTUNGEN (${zeitraumLabel})`, y, { bold: true, size: 11 });
            abschnitt++;
            const zuHead = [["Kuerzel", "Bezeichnung", "EUR-Betrag"]];
            const zuBody: PdfCell[][] = typC.map((z) => [
              String(z.kuerzel ?? ""),
              String(z.bezeichnung ?? ""),
              z.eurBetrag ? fmtEur(num(z.eurBetrag)) : fmtEur(0),
            ]);
            const summeC = typC.reduce((s, z) => s + num(z.eurBetrag), 0);
            zuBody.push([
              { content: "", styles: {} },
              { content: "Summe Geldleistungen", styles: { fontStyle: "bold" } },
              { content: fmtEur(summeC), styles: { fontStyle: "bold", halign: "right" } },
            ]);
            y = addPdfTable(doc, y, zuHead, zuBody, {
              columnStyles: { 2: { halign: "right" } },
            });
            y = addPdfText(doc, "Hinweis: Geldleistungen haben keinen Stellensoll-Effekt.", y, { indent: 5, size: 8 });
            y += 2;
          }

          y = addPdfText(doc, `Stellenwirksame Zuschlaege gesamt: ${fmtNum(soll.zuschlaegeSumme)}`, y, { indent: 5, bold: true });
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

function fmtEur(val: unknown): string {
  const n = num(val);
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
    .replace(/\u00A0/g, " ")
    .replace(/\u2212/g, "-");
}

function parseJsonArray(val: unknown): Record<string, unknown>[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch (err) {
      console.error("Berechnungsnachweis: JSON-Parse-Fehler in zuschlaege_details:", err);
      return [];
    }
  }
  return [];
}
