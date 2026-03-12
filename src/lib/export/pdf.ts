/**
 * jsPDF Helper-Funktionen fuer Export.
 * Wiederverwendbare PDF-Utilities mit autoTable.
 */

import { jsPDF } from "jspdf";
import autoTable, { type UserOptions, type RowInput } from "jspdf-autotable";

// ============================================================
// PDF ERSTELLEN
// ============================================================

export function createPdf(landscape = false): jsPDF {
  return new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
}

// ============================================================
// HEADER
// ============================================================

export function addPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle?: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Titel
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 20);

  // Untertitel
  let y = 28;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128); // #6B7280
    doc.text(subtitle, 14, y);
    y += 6;
  }

  // Datum rechts
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const datum = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Erstellt: ${datum}`, pageWidth - 14, 20, { align: "right" });

  // Trennlinie
  doc.setDrawColor(87, 87, 86); // #575756
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);

  doc.setTextColor(0, 0, 0); // Reset
  return y + 6;
}

// ============================================================
// SCHUL-HEADER (farbig)
// ============================================================

export function addPdfSchulHeader(
  doc: jsPDF,
  kurzname: string,
  name: string,
  farbe: string,
  y: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const r = parseInt(farbe.slice(1, 3), 16);
  const g = parseInt(farbe.slice(3, 5), 16);
  const b = parseInt(farbe.slice(5, 7), 16);

  // Farbiger Balken
  doc.setFillColor(r, g, b);
  doc.rect(14, y, pageWidth - 28, 8, "F");

  // Text
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${kurzname} — ${name}`, 17, y + 5.5);

  doc.setTextColor(0, 0, 0);
  return y + 12;
}

// ============================================================
// TABELLE
// ============================================================

export function addPdfTable(
  doc: jsPDF,
  startY: number,
  head: string[][],
  body: RowInput[],
  options?: Partial<UserOptions>
): number {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    headStyles: {
      fillColor: [87, 87, 86],  // #575756
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [26, 26, 26],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // #F9FAFB
    },
    margin: { left: 14, right: 14 },
    ...options,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable?.finalY ?? startY + 20;
}

// ============================================================
// TEXTBLOCK (fuer Berechnungsnachweis)
// ============================================================

export function addPdfText(
  doc: jsPDF,
  text: string,
  y: number,
  options?: { bold?: boolean; size?: number; indent?: number }
): number {
  const { bold = false, size = 10, indent = 0 } = options ?? {};
  doc.setFontSize(size);
  doc.setFont("helvetica", bold ? "bold" : "normal");

  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - 28 - indent;
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, 14 + indent, y);

  return y + lines.length * (size * 0.4) + 2;
}

// ============================================================
// SEITENNUMMERN
// ============================================================

export function addPdfPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Seite ${i} von ${totalPages}`,
      pageWidth - 14,
      pageHeight - 10,
      { align: "right" }
    );
    doc.text("Stellenistberechnung", 14, pageHeight - 10);
  }
}

// ============================================================
// PDF → BUFFER + RESPONSE
// ============================================================

export function pdfToBuffer(doc: jsPDF): Buffer {
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
