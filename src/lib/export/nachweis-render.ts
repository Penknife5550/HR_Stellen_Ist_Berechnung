/**
 * Rendering des Nachweises Bezirksregierung als PDF und Excel.
 *
 * Bewusst DB-frei: nimmt das fertige NachweisDaten-Modell (aus nachweis.ts +
 * Route) und erzeugt die Dateien. Dadurch ohne Auth/DB testbar.
 *
 * Layout: Kalenderjahr Januar–Dezember je Lehrkraft (tatsaechliche Wochenstunden
 * pro Monat, summiert), fachlich getrennt in altes Schuljahr (Jan–Jul) und neues
 * Schuljahr (Aug–Dez). Je Schule ein eigener Mehrarbeit- und Stellenanteil-Block.
 */

import type { RowInput } from "jspdf-autotable";
import type ExcelJS from "exceljs";
import type { NachweisDaten } from "./nachweis";
import { ALLE_MONATE } from "./nachweis";
import {
  createPdf,
  addPdfHeader,
  addPdfSchulHeader,
  addPdfTable,
  addPdfText,
  addPdfPageNumbers,
  pdfToBuffer,
} from "./pdf";
import {
  createWorkbook,
  addSchulHeader,
  addGruppenSubHeader,
  addSummenRow,
  addEmptyRow,
  setColumnWidths,
  workbookToBuffer,
} from "./excel";

const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function fmt(n: number, dec = 2): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Monatswert fuer die Tabelle: 0 → Gedankenstrich, sonst 2 Nachkommastellen. */
function fmtMonat(n: number): string {
  return n > 0.0001 ? fmt(n) : "–";
}

// ============================================================
// PDF
// ============================================================

export function renderNachweisPdf(daten: NachweisDaten): Buffer {
  const doc = createPdf(true); // Querformat — 12 Monatsspalten + Summen
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = addPdfHeader(
    doc,
    "Nachweis Bezirksregierung",
    `Kalenderjahr ${daten.haushaltsjahr} · Freie Evangelische Schule Minden`,
  );

  y = addPdfText(
    doc,
    `Januar–Juli = altes Schuljahr ${daten.altesSchuljahr} · August–Dezember = neues Schuljahr ` +
      `${daten.neuesSchuljahr}. Ausgewiesen sind die tatsaechlich geleisteten Wochenstunden je Monat ` +
      `(§ 3 Abs. 1 FESchVO), Regelstundendeputat nach § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW. ` +
      `Lehrkraefte erscheinen bei der Schule, an der sie unterrichten; die Stammschule steht je Zeile.`,
    y + 1,
    { size: 8 },
  );
  y += 2;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 14) {
      doc.addPage();
      y = 18;
    }
  };

  // Spaltenbreiten (mm) fuer die 12-Monats-Tabelle (16 Spalten). Summe muss in
  // Querformat-A4 (Nutzbreite bei 8mm-Rand ~281mm) passen: 34+10+12*12.5+2*14 = 224.
  const monthWidth = 12.5;
  const columnStyles: Record<number, { cellWidth?: number; halign?: "left" | "center" | "right"; fontStyle?: "bold" }> = {
    0: { cellWidth: 34, halign: "left" },
    1: { cellWidth: 10, halign: "center" },
    14: { cellWidth: 14, halign: "right", fontStyle: "bold" },
    15: { cellWidth: 14, halign: "right", fontStyle: "bold" },
  };
  for (let i = 2; i <= 13; i++) columnStyles[i] = { cellWidth: monthWidth, halign: "right" };

  const anzCols = 16;

  for (const schule of daten.schulen) {
    ensureSpace(50);
    y = addPdfSchulHeader(doc, schule.kurzname, schule.name, schule.farbe, y);
    y = addPdfText(doc, `Regelstundendeputat: ${fmt(schule.regeldeputat, 1)} Wochenstunden`, y, {
      size: 8,
    });

    // Kopf mit Schuljahr-Ueberschriften (zweizeilig).
    const head: RowInput[] = [
      [
        { content: "Lehrkraft", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Stamm", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: `altes Schuljahr ${daten.altesSchuljahr}`, colSpan: 7, styles: { halign: "center" } },
        { content: `neues Schuljahr ${daten.neuesSchuljahr}`, colSpan: 5, styles: { halign: "center" } },
        { content: "Σ Jan–Jul", rowSpan: 2, styles: { valign: "middle", halign: "right" } },
        { content: "Σ Aug–Dez", rowSpan: 2, styles: { valign: "middle", halign: "right" } },
      ],
      MONATE_KURZ.map((m) => ({ content: m, styles: { halign: "right" as const } })),
    ];

    const body: RowInput[] = [];
    for (const g of schule.gruppen) {
      body.push([
        { content: `${g.label} (${g.anzahl})`, colSpan: anzCols, styles: { fontStyle: "bold", fillColor: [229, 231, 235], textColor: [55, 65, 81] } },
      ]);
      for (const l of g.lehrer) {
        body.push([
          l.vollname,
          l.stammschuleCode ?? "",
          ...ALLE_MONATE.map((m) => fmtMonat(l.stundenProMonat[m] ?? 0)),
          fmt(l.summeJanJul),
          fmt(l.summeAugDez),
        ]);
      }
      body.push([
        { content: `Σ ${g.label}`, colSpan: 2, styles: { fontStyle: "bold" } },
        ...ALLE_MONATE.map((m) => ({ content: fmtMonat(g.monatsSummen[m] ?? 0), styles: { fontStyle: "bold" as const, halign: "right" as const } })),
        { content: fmt(g.summeJanJul), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmt(g.summeAugDez), styles: { fontStyle: "bold", halign: "right" } },
      ]);
    }
    // Schul-Gesamtzeile
    body.push([
      { content: `Σ ${schule.kurzname} gesamt`, colSpan: 2, styles: { fontStyle: "bold", fillColor: [243, 244, 246] } },
      ...ALLE_MONATE.map((m) => ({ content: fmtMonat(schule.monatsSummen[m] ?? 0), styles: { fontStyle: "bold" as const, halign: "right" as const, fillColor: [243, 244, 246] as [number, number, number] } })),
      { content: fmt(schule.summeJanJul), styles: { fontStyle: "bold", halign: "right", fillColor: [243, 244, 246] } },
      { content: fmt(schule.summeAugDez), styles: { fontStyle: "bold", halign: "right", fillColor: [243, 244, 246] } },
    ]);

    y = addPdfTable(doc, y + 1, head as string[][], body, {
      styles: { fontSize: 7, cellPadding: 1, overflow: "linebreak" },
      headStyles: { fillColor: [87, 87, 86], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      columnStyles,
      margin: { left: 8, right: 8 },
      tableWidth: "wrap",
    });

    // Stellenist-Summe des Schuljahres-Halbjahres
    y = addPdfText(
      doc,
      `Stellenist ${schule.kurzname}: Jan–Jul ${fmt(schule.stellenJanJul, 4)} + Mehrarbeit ${fmt(
        schule.mehrarbeit.stellenJanJul,
        4,
      )} = ${fmt(schule.gesamtStellenJanJul, 4)} Stellen · Aug–Dez ${fmt(
        schule.stellenAugDez,
        4,
      )} + Mehrarbeit ${fmt(schule.mehrarbeit.stellenAugDez, 4)} = ${fmt(
        schule.gesamtStellenAugDez,
        4,
      )} Stellen · gewichteter Jahreswert ${fmt(schule.jahreswertGewichtet, 4)}`,
      y + 2,
      { size: 8, bold: true },
    );

    // Mehrarbeit-Block (je Schule)
    ensureSpace(20);
    y = addPdfText(doc, "Mehrarbeit", y + 2, { bold: true, size: 9 });
    if (schule.mehrarbeit.hatDaten) {
      const maBody: RowInput[] = schule.mehrarbeit.lehrer.map((l) => [
        l.vollname,
        fmt(l.janJulStunden),
        fmt(l.augDezStunden),
      ]);
      if (schule.mehrarbeit.schulweitJanJulStellen > 0 || schule.mehrarbeit.schulweitAugDezStellen > 0) {
        maBody.push([
          "Schulweite Mehrarbeit (Stellenanteil)",
          `${fmt(schule.mehrarbeit.schulweitJanJulStellen, 4)} Stellen`,
          `${fmt(schule.mehrarbeit.schulweitAugDezStellen, 4)} Stellen`,
        ]);
      }
      maBody.push([
        { content: "Σ Mehrarbeit-Stellen", styles: { fontStyle: "bold" } },
        { content: fmt(schule.mehrarbeit.stellenJanJul, 4), styles: { fontStyle: "bold", halign: "right" } },
        { content: fmt(schule.mehrarbeit.stellenAugDez, 4), styles: { fontStyle: "bold", halign: "right" } },
      ]);
      y = addPdfTable(
        doc,
        y + 1,
        [["Quelle", "Jan–Jul (Std. / Stellen)", "Aug–Dez (Std. / Stellen)"]],
        maBody,
        { styles: { fontSize: 8 }, columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } },
      );
    } else {
      y = addPdfText(doc, "keine", y, { size: 8, indent: 2 });
    }

    // Stellenanteile-Block (je Schule)
    ensureSpace(20);
    y = addPdfText(doc, "Zusätzliche Stellenanteile", y + 2, { bold: true, size: 9 });
    if (schule.stellenanteile.length > 0) {
      const saBody: RowInput[] = schule.stellenanteile.map((s) => [
        s.bezeichnung + (s.kuerzel ? ` (${s.kuerzel})` : ""),
        s.lehrerName ?? "—",
        s.zeitraum,
        s.status,
        fmt(s.wert, 4),
        s.aktenzeichen ?? "—",
      ]);
      y = addPdfTable(
        doc,
        y + 1,
        [["Bezeichnung", "Lehrkraft", "Zeitraum", "Status", "Stellenanteil", "Aktenzeichen"]],
        saBody,
        { styles: { fontSize: 8 }, columnStyles: { 4: { halign: "right" } } },
      );
    } else {
      y = addPdfText(doc, "keine", y, { size: 8, indent: 2 });
    }

    y += 4;
  }

  // Gesamtzeile ueber alle Schulen
  ensureSpace(16);
  addPdfText(
    doc,
    `Gesamt über alle Schulen: Jan–Jul (altes SJ ${daten.altesSchuljahr}) ${fmt(
      daten.gesamt.janJul,
      4,
    )} · Aug–Dez (neues SJ ${daten.neuesSchuljahr}) ${fmt(daten.gesamt.augDez, 4)} · gewichteter ` +
      `Jahreswert ${fmt(daten.gesamt.jahreswert, 4)} Stellen`,
    y + 2,
    { bold: true, size: 10 },
  );

  addPdfPageNumbers(doc);
  return pdfToBuffer(doc);
}

// ============================================================
// EXCEL
// ============================================================

export async function renderNachweisExcel(daten: NachweisDaten): Promise<Buffer> {
  const wb = createWorkbook();
  const sheet = wb.addWorksheet("Nachweis");
  // 16 Spalten: Lehrkraft, Stamm, 12 Monate, Σ Jan–Jul, Σ Aug–Dez
  setColumnWidths(sheet, [26, 8, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 12, 12]);

  sheet.addRow([`Nachweis Bezirksregierung — Kalenderjahr ${daten.haushaltsjahr}`]);
  sheet.getRow(sheet.rowCount).font = { bold: true, size: 14 };
  sheet.addRow([
    `Jan–Jul = altes Schuljahr ${daten.altesSchuljahr} · Aug–Dez = neues Schuljahr ${daten.neuesSchuljahr} · ` +
      "§ 3 Abs. 1 FESchVO · tatsaechliche Wochenstunden je Monat",
  ]);
  sheet.getRow(sheet.rowCount).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  addEmptyRow(sheet);

  const NUM2 = "#,##0.00";
  const NUM4 = "#,##0.0000";

  for (const schule of daten.schulen) {
    addSchulHeader(sheet, schule.kurzname, schule.name, schule.farbe, 16);
    sheet.addRow([`Regelstundendeputat: ${fmt(schule.regeldeputat, 1)} WS`]);

    // Kopf: Schuljahr-Ueberschrift + Monatszeile
    const superRow = sheet.addRow([
      "", "", `altes Schuljahr ${daten.altesSchuljahr}`, "", "", "", "", "", "",
      `neues Schuljahr ${daten.neuesSchuljahr}`, "", "", "", "", "", "",
    ]);
    sheet.mergeCells(superRow.number, 3, superRow.number, 9);   // Jan..Jul
    sheet.mergeCells(superRow.number, 10, superRow.number, 14); // Aug..Dez
    superRow.font = { bold: true, size: 9 };
    superRow.eachCell((c) => (c.alignment = { horizontal: "center" }));

    const headRow = sheet.addRow(["Lehrkraft", "Stamm", ...MONATE_KURZ, "Σ Jan–Jul", "Σ Aug–Dez"]);
    headRow.font = { bold: true, size: 9 };

    const setNum = (row: ExcelJS.Row) => {
      for (let c = 3; c <= 14; c++) row.getCell(c).numFmt = NUM2;
      row.getCell(15).numFmt = NUM2;
      row.getCell(16).numFmt = NUM2;
    };

    for (const g of schule.gruppen) {
      addGruppenSubHeader(sheet, `${g.label} (${g.anzahl})`, 16);
      for (const l of g.lehrer) {
        const row = sheet.addRow([
          l.vollname,
          l.stammschuleCode ?? "",
          ...ALLE_MONATE.map((m) => l.stundenProMonat[m] ?? 0),
          l.summeJanJul,
          l.summeAugDez,
        ]);
        setNum(row);
      }
      const sub = addSummenRow(sheet, [
        `Σ ${g.label}`,
        "",
        ...ALLE_MONATE.map((m) => g.monatsSummen[m] ?? 0),
        g.summeJanJul,
        g.summeAugDez,
      ]);
      setNum(sub);
    }
    const total = addSummenRow(sheet, [
      `Σ ${schule.kurzname} gesamt`,
      "",
      ...ALLE_MONATE.map((m) => schule.monatsSummen[m] ?? 0),
      schule.summeJanJul,
      schule.summeAugDez,
    ]);
    setNum(total);
    total.font = { bold: true, size: 11 };

    // Stellenist-Zusammenfassung
    const stRow = sheet.addRow([
      `Stellenist ${schule.kurzname} (inkl. Mehrarbeit)`,
      "",
      "Jan–Jul:",
      schule.gesamtStellenJanJul,
      "Aug–Dez:",
      schule.gesamtStellenAugDez,
      "gew. Jahreswert:",
      schule.jahreswertGewichtet,
    ]);
    stRow.font = { bold: true };
    stRow.getCell(4).numFmt = NUM4;
    stRow.getCell(6).numFmt = NUM4;
    stRow.getCell(8).numFmt = NUM4;

    // Mehrarbeit-Block
    addEmptyRow(sheet);
    addGruppenSubHeader(sheet, "Mehrarbeit", 16);
    if (schule.mehrarbeit.hatDaten) {
      const mh = sheet.addRow(["Quelle", "", "Jan–Jul (Std./Stellen)", "", "Aug–Dez (Std./Stellen)"]);
      mh.font = { bold: true, size: 9 };
      for (const l of schule.mehrarbeit.lehrer) {
        const row = sheet.addRow([l.vollname, "", l.janJulStunden, "", l.augDezStunden]);
        row.getCell(3).numFmt = NUM2;
        row.getCell(5).numFmt = NUM2;
      }
      if (schule.mehrarbeit.schulweitJanJulStellen > 0 || schule.mehrarbeit.schulweitAugDezStellen > 0) {
        const row = sheet.addRow([
          "Schulweite Mehrarbeit (Stellenanteil)",
          "",
          schule.mehrarbeit.schulweitJanJulStellen,
          "",
          schule.mehrarbeit.schulweitAugDezStellen,
        ]);
        row.getCell(3).numFmt = NUM4;
        row.getCell(5).numFmt = NUM4;
      }
      const maSum = addSummenRow(sheet, [
        "Σ Mehrarbeit-Stellen",
        "",
        schule.mehrarbeit.stellenJanJul,
        "",
        schule.mehrarbeit.stellenAugDez,
      ]);
      maSum.getCell(3).numFmt = NUM4;
      maSum.getCell(5).numFmt = NUM4;
    } else {
      sheet.addRow(["keine"]);
    }

    // Stellenanteile-Block
    addEmptyRow(sheet);
    addGruppenSubHeader(sheet, "Zusätzliche Stellenanteile", 16);
    if (schule.stellenanteile.length > 0) {
      const sh = sheet.addRow(["Bezeichnung", "Lehrkraft", "Zeitraum", "Status", "Stellenanteil", "Aktenzeichen"]);
      sh.font = { bold: true, size: 9 };
      for (const s of schule.stellenanteile) {
        const row = sheet.addRow([
          s.bezeichnung + (s.kuerzel ? ` (${s.kuerzel})` : ""),
          s.lehrerName ?? "—",
          s.zeitraum,
          s.status,
          s.wert,
          s.aktenzeichen ?? "—",
        ]);
        row.getCell(5).numFmt = NUM4;
      }
    } else {
      sheet.addRow(["keine"]);
    }

    addEmptyRow(sheet);
  }

  const gesamtRow = addSummenRow(sheet, [
    "Gesamt über alle Schulen (gewichteter Jahreswert)",
    "",
    `Jan–Jul: ${fmt(daten.gesamt.janJul, 4)}`,
    "",
    `Aug–Dez: ${fmt(daten.gesamt.augDez, 4)}`,
    "",
    daten.gesamt.jahreswert,
  ]);
  gesamtRow.font = { bold: true, size: 12 };
  gesamtRow.getCell(7).numFmt = NUM4;

  return workbookToBuffer(wb);
}
