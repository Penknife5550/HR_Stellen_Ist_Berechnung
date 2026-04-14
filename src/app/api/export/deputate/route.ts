/**
 * GET /api/export/deputate?haushaltsjahrId=X&format=pdf|excel&schuleId=Y (optional)
 *
 * Deputatsuebersicht - monatliche Wochenstunden aller Lehrkraefte.
 * Gruppiert nach Stammschule. Bei Lehrern auf mehreren Schulen
 * wird die Aufteilung je Schule als Unterzeile dargestellt.
 */

import { NextRequest } from "next/server";
import { getOptionalSession } from "@/lib/auth/permissions";
import {
  getLehrerMitDeputaten,
  getSchulen,
  getDeputatAenderungen,
  getHaushaltsjahrById,
} from "@/lib/db/queries";
import { berechneLehrerDeputatEffektiv } from "@/lib/berechnungen/deputatEffektiv";
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

const MONATSNAMEN = ["Jan", "Feb", "Maer", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Schulkuerzel fuer die schulspezifischen Spalten
const SCHUL_SPALTEN = ["GES", "GYM", "BK"] as const;

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
    const [rawData, schulen, aenderungen, hj] = await Promise.all([
      getLehrerMitDeputaten(haushaltsjahrId, schuleId),
      getSchulen(),
      getDeputatAenderungen(haushaltsjahrId),
      getHaushaltsjahrById(haushaltsjahrId),
    ]);

    if (!hj) {
      return new Response("Haushaltsjahr nicht gefunden.", { status: 404 });
    }

    // Schulen-Lookup fuer Farben/Namen
    const schulenMap = new Map(schulen.map((s) => [s.kurzname, s]));

    // Aenderungen pro Lehrer indizieren
    const aenderungenByLehrer = new Map<number, typeof aenderungen>();
    for (const a of aenderungen) {
      const arr = aenderungenByLehrer.get(a.lehrerId) ?? [];
      arr.push(a);
      aenderungenByLehrer.set(a.lehrerId, arr);
    }

    // Daten zu Lehrer-Grid aggregieren
    const lehrerMap = new Map<number, LehrerRow>();

    for (const row of rawData) {
      if (!lehrerMap.has(row.lehrerId)) {
        lehrerMap.set(row.lehrerId, {
          id: row.lehrerId,
          name: row.name,
          stammschule: row.stammschuleCode ?? "-",
          stammschuleId: row.stammschuleId ?? 0,
          monate: new Map(),
          monateGes: new Map(),
          monateGym: new Map(),
          monateBk: new Map(),
          korrigierteMonate: new Set(),
        });
      }
      const l = lehrerMap.get(row.lehrerId)!;
      l.monate.set(row.monat, Number(row.deputatGesamt) || 0);
      l.monateGes.set(row.monat, Number(row.deputatGes) || 0);
      l.monateGym.set(row.monat, Number(row.deputatGym) || 0);
      l.monateBk.set(row.monat, Number(row.deputatBk) || 0);
    }

    // Taggenaue Korrekturen anwenden
    for (const l of lehrerMap.values()) {
      const monatsDaten = Array.from(l.monate.entries()).map(([monat, gesamt]) => ({
        monat,
        deputatGesamt: gesamt,
        deputatGes: l.monateGes.get(monat) ?? 0,
        deputatGym: l.monateGym.get(monat) ?? 0,
        deputatBk: l.monateBk.get(monat) ?? 0,
      }));
      const eff = berechneLehrerDeputatEffektiv(
        monatsDaten,
        aenderungenByLehrer.get(l.id) ?? [],
        hj.jahr,
      );
      for (const [monat, r] of eff) {
        if (!r.hatKorrektur) continue;
        l.monate.set(monat, r.effektiv.gesamt);
        l.monateGes.set(monat, r.effektiv.ges);
        l.monateGym.set(monat, r.effektiv.gym);
        l.monateBk.set(monat, r.effektiv.bk);
        l.korrigierteMonate.add(monat);
      }
    }

    const lehrerListe = Array.from(lehrerMap.values());

    // Nach Stammschule sortieren, dann nach Name
    lehrerListe.sort((a, b) => {
      const schulCompare = a.stammschule.localeCompare(b.stammschule, "de");
      if (schulCompare !== 0) return schulCompare;
      return a.name.localeCompare(b.name, "de");
    });

    // Gruppieren nach Stammschule
    const gruppen = new Map<string, LehrerRow[]>();
    for (const l of lehrerListe) {
      const key = l.stammschule;
      if (!gruppen.has(key)) gruppen.set(key, []);
      gruppen.get(key)!.push(l);
    }

    // Schul-Kurzname fuer Dateinamen
    const schuleName = schuleId
      ? schulen.find((s) => s.id === schuleId)?.kurzname ?? "Schule"
      : "Alle";

    const hatTaggenaueKorrekturen = lehrerListe.some((l) => l.korrigierteMonate.size > 0);

    if (format === "pdf") {
      return generatePdf(gruppen, schulenMap, lehrerListe.length, haushaltsjahrId, schuleName, hatTaggenaueKorrekturen);
    }
    return generateExcel(gruppen, schulenMap, lehrerListe.length, haushaltsjahrId, schuleName, hatTaggenaueKorrekturen);
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
  stammschuleId: number;
  monate: Map<number, number>;
  monateGes: Map<number, number>;
  monateGym: Map<number, number>;
  monateBk: Map<number, number>;
  /** Monate mit taggenauer Korrektur (fuer visuelle Markierung im Export) */
  korrigierteMonate: Set<number>;
}

/** Prueft ob ein Lehrer an mehreren Schulen unterrichtet */
function istMultiSchule(l: LehrerRow): boolean {
  let schulenMitStunden = 0;
  const hatGes = Array.from(l.monateGes.values()).some((v) => v > 0);
  const hatGym = Array.from(l.monateGym.values()).some((v) => v > 0);
  const hatBk = Array.from(l.monateBk.values()).some((v) => v > 0);
  if (hatGes) schulenMitStunden++;
  if (hatGym) schulenMitStunden++;
  if (hatBk) schulenMitStunden++;
  return schulenMitStunden > 1;
}

/** Liefert die Schulen an denen ein Lehrer Stunden hat */
function getAktiveSchulen(l: LehrerRow): { kuerzel: string; monate: Map<number, number> }[] {
  const result: { kuerzel: string; monate: Map<number, number> }[] = [];
  if (Array.from(l.monateGes.values()).some((v) => v > 0)) {
    result.push({ kuerzel: "GES", monate: l.monateGes });
  }
  if (Array.from(l.monateGym.values()).some((v) => v > 0)) {
    result.push({ kuerzel: "GYM", monate: l.monateGym });
  }
  if (Array.from(l.monateBk.values()).some((v) => v > 0)) {
    result.push({ kuerzel: "BK", monate: l.monateBk });
  }
  return result;
}

function monatsDurchschnitt(monate: Map<number, number>): number {
  let summe = 0;
  let anzahl = 0;
  for (const val of monate.values()) {
    if (val > 0) { summe += val; anzahl++; }
  }
  return anzahl > 0 ? summe / anzahl : 0;
}

function rund2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** PDF-sichere Zahlenformatierung */
function fmtDE(n: number, decimals = 1): string {
  if (n === 0) return "-";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).replace(/\u2212/g, "-").replace(/[\u00A0\u2009\u202F]/g, " ");
}

// ============================================================
// EXCEL
// ============================================================

async function generateExcel(
  gruppen: Map<string, LehrerRow[]>,
  schulenMap: Map<string, { kurzname: string; name: string; farbe: string }>,
  gesamtAnzahl: number,
  haushaltsjahrId: number,
  schuleName: string,
  hatTaggenaueKorrekturen: boolean,
) {
  const wb = createWorkbook();
  const ws = wb.addWorksheet("Deputate");

  // Spaltenbreiten: Nr, Name, Schule, 12x Monat, Durchschnitt
  setColumnWidths(ws, [6, 30, 10, ...Array(12).fill(10), 11]);

  const headers = ["Nr", "Name", "Schule", ...MONATSNAMEN, "Schnitt"];
  addHeaderRow(ws, headers);

  const colCount = headers.length;
  const monatsSummen = new Array(12).fill(0);
  let gesamtDurchschnitt = 0;
  let laufendeNr = 0;

  for (const [stammschuleCode, lehrerInGruppe] of gruppen) {
    // Stammschul-Header
    const schule = schulenMap.get(stammschuleCode);
    const farbe = schule?.farbe ?? "#575756";
    const schulName = schule?.name ?? stammschuleCode;
    addSchulHeader(ws, stammschuleCode, `Stammschule: ${schulName}`, farbe, colCount);

    let gruppenDurchschnitt = 0;
    const gruppenMonatsSummen = new Array(12).fill(0);

    for (const l of lehrerInGruppe) {
      laufendeNr++;
      const multiSchule = istMultiSchule(l);

      // Hauptzeile: Gesamt-Deputat
      const monatswerte: (number | string)[] = [];
      for (let m = 1; m <= 12; m++) {
        const val = l.monate.get(m) ?? 0;
        monatswerte.push(val > 0 ? rund2(val) : "");
        if (val > 0) {
          monatsSummen[m - 1] += val;
          gruppenMonatsSummen[m - 1] += val;
        }
      }
      const avg = monatsDurchschnitt(l.monate);
      gesamtDurchschnitt += avg;
      gruppenDurchschnitt += avg;

      const row = ws.addRow([
        laufendeNr,
        l.name,
        l.stammschule,
        ...monatswerte,
        avg > 0 ? rund2(avg) : "",
      ]);

      // Bei Multi-Schul-Lehrern: fett markieren
      if (multiSchule) {
        row.eachCell((cell) => {
          cell.font = { bold: true, size: 10, name: "Calibri" };
        });

        // Unterzeilen pro Schule
        for (const s of getAktiveSchulen(l)) {
          const subWerte: (number | string)[] = [];
          for (let m = 1; m <= 12; m++) {
            const val = s.monate.get(m) ?? 0;
            subWerte.push(val > 0 ? rund2(val) : "");
          }
          const subAvg = monatsDurchschnitt(s.monate);
          const subRow = ws.addRow([
            "",
            `  davon ${s.kuerzel}`,
            s.kuerzel,
            ...subWerte,
            subAvg > 0 ? rund2(subAvg) : "",
          ]);
          // Unterzeilen in Grau und kleiner
          subRow.eachCell((cell) => {
            cell.font = { size: 9, name: "Calibri", color: { argb: "FF6B7280" } };
          });
        }
      }
    }

    // Gruppen-Summe
    addSummenRow(ws, [
      "",
      `Summe ${stammschuleCode} (${lehrerInGruppe.length})`,
      "",
      ...gruppenMonatsSummen.map((s) => rund2(s)),
      rund2(gruppenDurchschnitt),
    ]);

    addEmptyRow(ws);
  }

  // Gesamtsumme
  addEmptyRow(ws);
  addSummenRow(ws, [
    "",
    `GESAMT (${gesamtAnzahl} Lehrkraefte)`,
    "",
    ...monatsSummen.map((s) => rund2(s)),
    rund2(gesamtDurchschnitt),
  ]);

  if (hatTaggenaueKorrekturen) {
    addEmptyRow(ws);
    const note = ws.addRow([
      "",
      "Hinweis: Fuer einzelne Lehrkraefte wurden Monatswerte taggenau gewichtet (tatsaechliches Aenderungsdatum gesetzt). Herleitung siehe Detailseite.",
    ]);
    note.eachCell((c) => { c.font = { italic: true, size: 9, color: { argb: "FF575756" } }; });
  }

  const buffer = await workbookToBuffer(wb);
  return excelResponse(buffer, `Deputate_${schuleName}_HJ${haushaltsjahrId}.xlsx`);
}

// ============================================================
// PDF
// ============================================================

function generatePdf(
  gruppen: Map<string, LehrerRow[]>,
  schulenMap: Map<string, { kurzname: string; name: string; farbe: string }>,
  gesamtAnzahl: number,
  haushaltsjahrId: number,
  schuleName: string,
  hatTaggenaueKorrekturen: boolean,
) {
  const doc = createPdf(true); // Landscape
  let y = addPdfHeader(
    doc,
    `Deputatsuebersicht - ${schuleName}`,
    `Haushaltsjahr ${haushaltsjahrId} | ${gesamtAnzahl} Lehrkraefte | Gruppiert nach Stammschule`
  );

  const monatsSummen = new Array(12).fill(0);
  let gesamtDurchschnitt = 0;
  let laufendeNr = 0;

  for (const [stammschuleCode, lehrerInGruppe] of gruppen) {
    const schule = schulenMap.get(stammschuleCode);
    const farbe = schule?.farbe ?? "#575756";
    const schulName = schule?.name ?? stammschuleCode;

    // Seitenumbruch wenn zu wenig Platz
    if (y > 160) {
      doc.addPage();
      y = 20;
    }

    y = addPdfSchulHeader(doc, stammschuleCode, `Stammschule: ${schulName}`, farbe, y);

    const head = [["Nr", "Name", "Schule", ...MONATSNAMEN, "Schnitt"]];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any[][] = [];

    const gruppenMonatsSummen = new Array(12).fill(0);
    let gruppenDurchschnitt = 0;

    for (const l of lehrerInGruppe) {
      laufendeNr++;
      const multiSchule = istMultiSchule(l);

      const monatswerte: string[] = [];
      for (let m = 1; m <= 12; m++) {
        const val = l.monate.get(m) ?? 0;
        monatswerte.push(fmtDE(val));
        if (val > 0) {
          monatsSummen[m - 1] += val;
          gruppenMonatsSummen[m - 1] += val;
        }
      }
      const avg = monatsDurchschnitt(l.monate);
      gesamtDurchschnitt += avg;
      gruppenDurchschnitt += avg;

      if (multiSchule) {
        // Hauptzeile fett
        body.push([
          { content: String(laufendeNr), styles: { fontStyle: "bold" } },
          { content: l.name, styles: { fontStyle: "bold" } },
          { content: l.stammschule, styles: { fontStyle: "bold" } },
          ...monatswerte.map((v) => ({ content: v, styles: { fontStyle: "bold" as const } })),
          { content: fmtDE(avg), styles: { fontStyle: "bold" } },
        ]);

        // Unterzeilen je Schule
        for (const s of getAktiveSchulen(l)) {
          const subWerte: string[] = [];
          for (let m = 1; m <= 12; m++) {
            subWerte.push(fmtDE(s.monate.get(m) ?? 0));
          }
          const subAvg = monatsDurchschnitt(s.monate);
          body.push([
            "",
            { content: `  davon ${s.kuerzel}`, styles: { textColor: [107, 114, 128], fontSize: 7 } },
            { content: s.kuerzel, styles: { textColor: [107, 114, 128], fontSize: 7 } },
            ...subWerte.map((v) => ({ content: v, styles: { textColor: [107, 114, 128] as [number, number, number], fontSize: 7 } })),
            { content: fmtDE(subAvg), styles: { textColor: [107, 114, 128], fontSize: 7 } },
          ]);
        }
      } else {
        body.push([
          String(laufendeNr), l.name, l.stammschule,
          ...monatswerte, fmtDE(avg),
        ]);
      }
    }

    // Gruppensum
    body.push([
      { content: "", styles: { fontStyle: "bold" } },
      { content: `Summe ${stammschuleCode} (${lehrerInGruppe.length})`, styles: { fontStyle: "bold" } },
      "",
      ...gruppenMonatsSummen.map((s) => ({
        content: fmtDE(rund2(s)), styles: { fontStyle: "bold" as const },
      })),
      { content: fmtDE(rund2(gruppenDurchschnitt)), styles: { fontStyle: "bold" } },
    ]);

    y = addPdfTable(doc, y, head, body, {
      styles: { fontSize: 7 },
      headStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 33 },
        2: { cellWidth: 10 },
      },
    });

    y += 4;
  }

  // Gesamtsumme als eigene Mini-Tabelle
  if (y > 170) { doc.addPage(); y = 20; }

  const totalHead = [["", "", "", ...MONATSNAMEN, "Schnitt"]];
  const totalBody: string[][] = [[
    "",
    `GESAMT (${gesamtAnzahl})`,
    "",
    ...monatsSummen.map((s) => fmtDE(rund2(s))),
    fmtDE(rund2(gesamtDurchschnitt)),
  ]];
  addPdfTable(doc, y, totalHead, totalBody, {
    bodyStyles: { fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 8 },
    headStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 33 },
      2: { cellWidth: 10 },
    },
  });

  if (hatTaggenaueKorrekturen) {
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(
      "Hinweis: Einzelne Monatswerte sind taggenau gewichtet (tatsaechliches Aenderungsdatum gesetzt). Herleitung siehe Detailseite.",
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  addPdfPageNumbers(doc);
  const buffer = pdfToBuffer(doc);
  return pdfResponse(buffer, `Deputate_${schuleName}_HJ${haushaltsjahrId}.pdf`);
}
