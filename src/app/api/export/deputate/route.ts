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
  getEchteAenderungenAlleLehrer,
  getLehrerStatistikGruppen,
  getHaushaltsjahrById,
} from "@/lib/db/queries";
import {
  berechneLehrerDeputatEffektiv,
  adaptiereEchteAenderungen,
} from "@/lib/berechnungen/deputatEffektiv";
import {
  gruppenSortRank,
  gruppenLabel,
  vergleicheLehrerNachSchuleGruppeName,
} from "@/lib/statistikCode";
import {
  createWorkbook,
  addHeaderRow,
  addSchulHeader,
  addGruppenSubHeader,
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
    const [rawData, schulen, echteAenderungen, lehrerGruppen, hj] = await Promise.all([
      getLehrerMitDeputaten(haushaltsjahrId, schuleId),
      getSchulen(),
      getEchteAenderungenAlleLehrer(),
      getLehrerStatistikGruppen(),
      getHaushaltsjahrById(haushaltsjahrId),
    ]);

    if (!hj) {
      return new Response("Haushaltsjahr nicht gefunden.", { status: 404 });
    }

    // Schulen-Lookup fuer Farben/Namen
    const schulenMap = new Map(schulen.map((s) => [s.kurzname, s]));

    // Echte Wertwechsel pro Lehrer indizieren (Periodenmodell + Korrektur-Layer)
    const aenderungenByLehrer = new Map<number, typeof echteAenderungen>();
    for (const a of echteAenderungen) {
      const arr = aenderungenByLehrer.get(a.lehrer_id) ?? [];
      arr.push(a);
      aenderungenByLehrer.set(a.lehrer_id, arr);
    }

    // Statistik-Gruppe pro Lehrer (Beamte/Angestellte/Sonstige) fuer Sortierung + Sub-Header
    const gruppeByLehrer = new Map<number, string | null>();
    for (const ld of lehrerGruppen) {
      gruppeByLehrer.set(ld.id, ld.statistikGruppe);
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
          gruppe: gruppeByLehrer.get(row.lehrerId) ?? null,
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

    // Taggenaue Korrekturen aus dem Periodenmodell anwenden
    for (const l of lehrerMap.values()) {
      const monatsDaten = Array.from(l.monate.entries()).map(([monat, gesamt]) => ({
        monat,
        deputatGesamt: gesamt,
        deputatGes: l.monateGes.get(monat) ?? 0,
        deputatGym: l.monateGym.get(monat) ?? 0,
        deputatBk: l.monateBk.get(monat) ?? 0,
      }));
      const adaptiert = adaptiereEchteAenderungen(
        aenderungenByLehrer.get(l.id) ?? [],
        hj.jahr,
      );
      const eff = berechneLehrerDeputatEffektiv(monatsDaten, adaptiert, hj.jahr);
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

    // Sortierung: Schule -> Gruppe (Beamte vor Angestellten vor Sonstigen) -> Name
    lehrerListe.sort((a, b) =>
      vergleicheLehrerNachSchuleGruppeName(
        { stammschule: a.stammschule, gruppe: a.gruppe, name: a.name },
        { stammschule: b.stammschule, gruppe: b.gruppe, name: b.name },
      ),
    );

    // Gruppieren in zwei Ebenen: Stammschule -> Statistik-Gruppe
    const gruppen = new Map<string, Map<string, LehrerRow[]>>();
    for (const l of lehrerListe) {
      const schulKey = l.stammschule;
      if (!gruppen.has(schulKey)) gruppen.set(schulKey, new Map());
      const schulGruppen = gruppen.get(schulKey)!;
      // Schluessel "beamter" | "angestellter" | "sonstiges" (null wird zu "sonstiges")
      const gruppeKey = l.gruppe ?? "sonstiges";
      if (!schulGruppen.has(gruppeKey)) schulGruppen.set(gruppeKey, []);
      schulGruppen.get(gruppeKey)!.push(l);
    }
    // Gruppen-Reihenfolge innerhalb einer Schule sortieren
    for (const [schule, schulGruppen] of gruppen) {
      const sortiert = new Map(
        [...schulGruppen.entries()].sort(
          ([a], [b]) => gruppenSortRank(a) - gruppenSortRank(b),
        ),
      );
      gruppen.set(schule, sortiert);
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
  /** "beamter" | "angestellter" | "sonstiges" | null */
  gruppe: string | null;
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
function fmtDE(n: number, decimals = 2): string {
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
  gruppen: Map<string, Map<string, LehrerRow[]>>,
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

  for (const [stammschuleCode, schulGruppen] of gruppen) {
    // Stammschul-Header
    const schule = schulenMap.get(stammschuleCode);
    const farbe = schule?.farbe ?? "#575756";
    const schulName = schule?.name ?? stammschuleCode;
    addSchulHeader(ws, stammschuleCode, `Stammschule: ${schulName}`, farbe, colCount);

    let schulDurchschnitt = 0;
    const schulMonatsSummen = new Array(12).fill(0);
    let schulAnzahl = 0;

    for (const [gruppeKey, lehrerInGruppe] of schulGruppen) {
      // Sub-Header pro Statistik-Gruppe (Beamte / Angestellte / Sonstige)
      addGruppenSubHeader(ws, `${gruppenLabel(gruppeKey)} (${lehrerInGruppe.length})`, colCount);

      for (const l of lehrerInGruppe) {
        laufendeNr++;
        schulAnzahl++;
        const multiSchule = istMultiSchule(l);

        // Hauptzeile: Gesamt-Deputat
        const monatswerte: (number | string)[] = [];
        for (let m = 1; m <= 12; m++) {
          const val = l.monate.get(m) ?? 0;
          monatswerte.push(val > 0 ? rund2(val) : "");
          if (val > 0) {
            monatsSummen[m - 1] += val;
            schulMonatsSummen[m - 1] += val;
          }
        }
        const avg = monatsDurchschnitt(l.monate);
        gesamtDurchschnitt += avg;
        schulDurchschnitt += avg;

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
    }

    // Schul-Gesamtsumme (alle Statistik-Gruppen zusammen)
    addSummenRow(ws, [
      "",
      `Summe ${stammschuleCode} (${schulAnzahl})`,
      "",
      ...schulMonatsSummen.map((s) => rund2(s)),
      rund2(schulDurchschnitt),
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
  gruppen: Map<string, Map<string, LehrerRow[]>>,
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
    `Haushaltsjahr ${haushaltsjahrId} | ${gesamtAnzahl} Lehrkraefte | Schule -> Beamte/Angestellte`
  );

  const monatsSummen = new Array(12).fill(0);
  let gesamtDurchschnitt = 0;
  let laufendeNr = 0;

  for (const [stammschuleCode, schulGruppen] of gruppen) {
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

    const schulMonatsSummen = new Array(12).fill(0);
    let schulDurchschnitt = 0;
    let schulAnzahl = 0;

    for (const [gruppeKey, lehrerInGruppe] of schulGruppen) {
      // Sub-Header-Zeile pro Statistik-Gruppe — colSpan ueber alle Spalten
      // (insgesamt 16: Nr, Name, Schule, 12 Monate, Schnitt)
      body.push([
        {
          content: `${gruppenLabel(gruppeKey)} (${lehrerInGruppe.length})`,
          colSpan: 16,
          styles: {
            fillColor: [229, 231, 235] as [number, number, number],
            textColor: [55, 65, 81] as [number, number, number],
            fontStyle: "italic" as const,
            fontSize: 7,
          },
        },
      ]);

      for (const l of lehrerInGruppe) {
        laufendeNr++;
        schulAnzahl++;
        const multiSchule = istMultiSchule(l);

        const monatswerte: string[] = [];
        for (let m = 1; m <= 12; m++) {
          const val = l.monate.get(m) ?? 0;
          monatswerte.push(fmtDE(val));
          if (val > 0) {
            monatsSummen[m - 1] += val;
            schulMonatsSummen[m - 1] += val;
          }
        }
        const avg = monatsDurchschnitt(l.monate);
        gesamtDurchschnitt += avg;
        schulDurchschnitt += avg;

        if (multiSchule) {
          body.push([
            { content: String(laufendeNr), styles: { fontStyle: "bold" } },
            { content: l.name, styles: { fontStyle: "bold" } },
            { content: l.stammschule, styles: { fontStyle: "bold" } },
            ...monatswerte.map((v) => ({ content: v, styles: { fontStyle: "bold" as const } })),
            { content: fmtDE(avg), styles: { fontStyle: "bold" } },
          ]);

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
    }

    // Schul-Gesamtsumme
    body.push([
      { content: "", styles: { fontStyle: "bold" } },
      { content: `Summe ${stammschuleCode} (${schulAnzahl})`, styles: { fontStyle: "bold" } },
      "",
      ...schulMonatsSummen.map((s) => ({
        content: fmtDE(rund2(s)), styles: { fontStyle: "bold" as const },
      })),
      { content: fmtDE(rund2(schulDurchschnitt)), styles: { fontStyle: "bold" } },
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
