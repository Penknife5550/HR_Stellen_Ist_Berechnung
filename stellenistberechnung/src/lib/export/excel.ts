/**
 * ExcelJS Helper-Funktionen fuer Export.
 * Wiederverwendbare Styling- und Formatierungs-Utilities.
 */

import ExcelJS from "exceljs";

// ============================================================
// WORKBOOK
// ============================================================

export function createWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Stellenistberechnung";
  wb.created = new Date();
  return wb;
}

// ============================================================
// HEADER
// ============================================================

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF575756" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
  name: "Calibri",
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  bottom: { style: "thin", color: { argb: "FF575756" } },
};

export function addHeaderRow(
  sheet: ExcelJS.Worksheet,
  columns: string[]
): ExcelJS.Row {
  const row = sheet.addRow(columns);
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  row.height = 28;
  return row;
}

// ============================================================
// SCHUL-HEADER (farbig)
// ============================================================

export function addSchulHeader(
  sheet: ExcelJS.Worksheet,
  kurzname: string,
  name: string,
  farbe: string,
  colSpan: number
): void {
  const row = sheet.addRow([`${kurzname} — ${name}`]);
  const argbFarbe = "FF" + farbe.replace("#", "");
  row.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: argbFarbe },
  };
  row.getCell(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 12,
    name: "Calibri",
  };
  if (colSpan > 1) {
    sheet.mergeCells(row.number, 1, row.number, colSpan);
  }
  row.height = 30;
}

// ============================================================
// SPALTENBREITEN
// ============================================================

export function setColumnWidths(
  sheet: ExcelJS.Worksheet,
  widths: number[]
): void {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

// ============================================================
// SUMMENZEILE
// ============================================================

export function addSummenRow(
  sheet: ExcelJS.Worksheet,
  values: (string | number | null)[],
  bold = true
): ExcelJS.Row {
  const row = sheet.addRow(values);
  row.eachCell((cell) => {
    cell.font = { bold, size: 11, name: "Calibri" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF575756" } },
    };
  });
  return row;
}

// ============================================================
// LEERZEILE
// ============================================================

export function addEmptyRow(sheet: ExcelJS.Worksheet): void {
  sheet.addRow([]);
}

// ============================================================
// ZAHLENFORMAT
// ============================================================

export function formatNumberCells(
  row: ExcelJS.Row,
  columns: number[],
  decimals: number
): void {
  const fmt = decimals === 0 ? "#,##0" : `#,##0.${"0".repeat(decimals)}`;
  columns.forEach((col) => {
    const cell = row.getCell(col);
    cell.numFmt = fmt;
    cell.alignment = { horizontal: "right" };
  });
}

// ============================================================
// WORKBOOK → BUFFER
// ============================================================

export async function workbookToBuffer(
  wb: ExcelJS.Workbook
): Promise<Buffer> {
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// ============================================================
// RESPONSE HELPER
// ============================================================

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
