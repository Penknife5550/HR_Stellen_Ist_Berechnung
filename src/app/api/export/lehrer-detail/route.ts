/**
 * GET /api/export/lehrer-detail?lehrerId=X&hj=Y
 *
 * Komplette Lehrer-Detailseite als A4-Hochformat-PDF — Nachweis-Dokument fuer
 * die Bezirksregierung. Spiegelt die Web-Ansicht 1:1:
 *
 *   1. Kopf mit Lehrer-Stammdaten + Haushaltsjahr
 *   2. Warnung bei gehaltsrelevanter Aenderung
 *   3. Monatliche Deputatsverteilung nach Schulen (mit Tagesgenau-Marker)
 *   4. Echte Wertwechsel im Schuljahresverlauf (Periodenmodell)
 *   5. Untis-Periodenverlauf (alle deputat_pro_periode-Zeilen)
 *   6. Tagesgenaue Berechnung pro betroffenem Monat (Herleitung gem. § 3 FESchVO)
 *   7. Rechtsgrundlage
 */

import { NextRequest } from "next/server";
import { getOptionalSession, ROLE_LEVEL } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import {
  getLehrerDetail,
  getSchulen,
  getHaushaltsjahrById,
} from "@/lib/db/queries";
import {
  berechneLehrerDeputatEffektiv,
  adaptiereEchteAenderungen,
} from "@/lib/berechnungen/deputatEffektiv";
import {
  createPdf,
  addPdfHeader,
  addPdfTable,
  addPdfText,
  addPdfPageNumbers,
  pdfToBuffer,
  pdfResponse,
} from "@/lib/export/pdf";
import { jsPDF } from "jspdf";

const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function fmtDeDate(iso: string): string {
  const d = new Date(iso);
  return `${WOCHENTAG[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function fmtDeDateKurz(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Zahl mit n Nachkommastellen (de-DE Format), 0 → "—". */
function fmt(n: number, dec = 2): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.001) return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .replace(/−/g, "-")
    .replace(/[   ]/g, " ");
}

/** Stellt sicher, dass am gegebenen y-Wert noch Platz ist. Bricht Seite um wenn nicht. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 18) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) {
    return new Response("Nicht authentifiziert.", { status: 401 });
  }
  // DSGVO: PII-Export (Personalnummer, Statistik-Code, Gehaltshistorie)
  // erfordert Mitarbeiter-Rolle. Betrachter haben keinen Zugriff.
  if (ROLE_LEVEL[session.rolle] < ROLE_LEVEL["mitarbeiter"]) {
    return new Response("Keine Berechtigung fuer Lehrer-Detail-Export.", { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const lehrerId = Number(searchParams.get("lehrerId"));
  const haushaltsjahrId = Number(searchParams.get("hj") ?? searchParams.get("haushaltsjahrId"));

  if (!lehrerId || lehrerId <= 0) {
    return new Response("lehrerId fehlt.", { status: 400 });
  }
  if (!haushaltsjahrId || haushaltsjahrId <= 0) {
    return new Response("hj (haushaltsjahrId) fehlt.", { status: 400 });
  }

  // DSGVO Art. 30: Verarbeitungsverzeichnis — jeder PII-Export wird protokolliert.
  await writeAuditLog(
    "export_lehrer_detail",
    lehrerId,
    "INSERT",
    null,
    { haushaltsjahrId, format: "pdf" },
    session.name,
  );

  try {
    const [detail, schulen, hj] = await Promise.all([
      getLehrerDetail(lehrerId, haushaltsjahrId),
      getSchulen(),
      getHaushaltsjahrById(haushaltsjahrId),
    ]);

    if (!detail) return new Response("Lehrer nicht gefunden.", { status: 404 });
    if (!hj) return new Response("Haushaltsjahr nicht gefunden.", { status: 404 });

    const { lehrer: l, statistik, monatsDaten, periodenverlauf, echteAenderungen } = detail;
    const schulenByCode = new Map(schulen.map((s) => [s.kurzname, s]));

    // Effektive Monatswerte berechnen (genau wie auf der Detailseite)
    const adaptiert = adaptiereEchteAenderungen(echteAenderungen, hj.jahr);
    const effektivByMonat = berechneLehrerDeputatEffektiv(
      monatsDaten.map((m) => ({
        monat: m.monat,
        deputatGesamt: m.deputatGesamt,
        deputatGes: m.deputatGes,
        deputatGym: m.deputatGym,
        deputatBk: m.deputatBk,
      })),
      adaptiert,
      hj.jahr,
    );

    const korrigierteMonate = Array.from(effektivByMonat.values()).filter((e) => e.hatKorrektur);
    const hatGehaltsrelevante = adaptiert.some(
      (a) => Math.abs(Number(a.deputatGesamtAlt ?? 0) - Number(a.deputatGesamtNeu ?? 0)) > 0.001,
    );

    // ============================================================
    // PDF aufbauen
    // ============================================================
    const doc = createPdf(false); // A4 Hochformat
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Kopf
    let y = addPdfHeader(
      doc,
      l.vollname,
      `Deputatsverlauf — Haushaltsjahr ${hj.jahr}`,
    );

    // Stammdaten-Block
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(55, 65, 81);
    const stammdaten = [
      `Personalnr.: ${l.personalnummer ?? "—"}`,
      `Stammschule: ${l.stammschuleCode ?? "—"}`,
      `Statistik-Code: ${statistik ? `${statistik.code} — ${statistik.bezeichnung}` : "—"}`,
      `Untis-Teacher-ID: ${l.untisTeacherId ?? "—"}`,
    ];
    for (const z of stammdaten) {
      doc.text(z, 14, y);
      y += 4.5;
    }
    y += 2;
    doc.setTextColor(0, 0, 0);

    // 2. Warnung Gehaltsrelevant
    if (hatGehaltsrelevante) {
      y = ensureSpace(doc, y, 22);
      doc.setFillColor(254, 226, 226); // rot-50
      doc.setDrawColor(226, 0, 26); // FES-Rot
      doc.setLineWidth(0.5);
      doc.rect(14, y, pageWidth - 28, 18, "FD");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(226, 0, 26);
      doc.text("Gehaltsrelevante Deputatsaenderung erkannt", 17, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(87, 87, 86);
      const note = doc.splitTextToSize(
        "Das Gesamtdeputat (PlannedWeek) dieser Lehrkraft hat sich geaendert. Dies hat Auswirkungen auf die Verguetung und muss mit der Gehaltsabrechnung abgestimmt werden. Rechtsgrundlage: § 3 Abs. 1 FESchVO — Personalkosten werden auf Basis der tatsaechlich erteilten Stunden refinanziert.",
        pageWidth - 32,
      );
      doc.text(note, 17, y + 11);
      doc.setTextColor(0, 0, 0);
      y += 22;
    }

    // 3. Monatliche Deputatsverteilung nach Schulen
    y = ensureSpace(doc, y, 60);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Monatliche Deputatsverteilung", 14, y);
    y += 5;

    type Zeile = "gesamt" | "ges" | "gym" | "bk";
    const monatsArr = Array.from({ length: 12 }, (_, i) => {
      const m = monatsDaten.find((d) => d.monat === i + 1);
      return m ?? null;
    });

    const zellWert = (col: Zeile, monat: number, fallback: number): { content: string; korr: boolean } => {
      const e = effektivByMonat.get(monat);
      if (!e) return { content: fallback === 0 ? "—" : fmt(fallback), korr: false };
      const val = e.hatKorrektur ? e.effektiv[col] : e.pauschal[col];
      const korr = e.hatKorrektur && Math.abs(e.korrektur[col]) > 0.001;
      return { content: val < 0.001 ? "—" : fmt(val), korr };
    };

    const zelleZuRowCell = (z: { content: string; korr: boolean }) => z.korr
      ? { content: z.content + "*", styles: { textColor: [226, 0, 26] as [number, number, number], fontStyle: "bold" as const } }
      : z.content;

    // Tabelle: Zeile pro Schul-Aufschluesselung
    const head = [["", ...MONATE_KURZ, "Ø"]];

    // Helper: Durchschnitt pro Zeile
    const avgFor = (col: Zeile): number => {
      const vals: number[] = [];
      for (let m = 1; m <= 12; m++) {
        const md = monatsArr[m - 1];
        if (!md) continue;
        const e = effektivByMonat.get(m);
        const val = e?.hatKorrektur ? e.effektiv[col] : Number(md[
          col === "gesamt" ? "deputatGesamt" :
          col === "ges" ? "deputatGes" :
          col === "gym" ? "deputatGym" : "deputatBk"
        ] ?? 0);
        if (val > 0.001) vals.push(val);
      }
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any[][] = [];

    // Gesamt-Zeile
    const gesamtRow: unknown[] = [{ content: "Gesamt", styles: { fontStyle: "bold" } }];
    for (let m = 1; m <= 12; m++) {
      const md = monatsArr[m - 1];
      const z = zellWert("gesamt", m, Number(md?.deputatGesamt ?? 0));
      gesamtRow.push(zelleZuRowCell(z));
    }
    gesamtRow.push({ content: fmt(avgFor("gesamt")), styles: { fontStyle: "bold" } });
    body.push(gesamtRow);

    // Schul-Zeilen (nur falls dort Werte vorhanden)
    for (const schul of ["GES", "GYM", "BK"] as const) {
      const col: Zeile = schul.toLowerCase() as Zeile;
      const hasAny = monatsArr.some((md) => md && Number(md[
        col === "ges" ? "deputatGes" : col === "gym" ? "deputatGym" : "deputatBk"
      ] ?? 0) > 0.001);
      if (!hasAny) continue;

      const farbe = schulenByCode.get(schul)?.farbe ?? "#575756";
      const r = parseInt(farbe.slice(1, 3), 16);
      const g = parseInt(farbe.slice(3, 5), 16);
      const b = parseInt(farbe.slice(5, 7), 16);

      const row: unknown[] = [
        { content: schul, styles: { fillColor: [r, g, b] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold" as const, halign: "center" as const } },
      ];
      for (let m = 1; m <= 12; m++) {
        const md = monatsArr[m - 1];
        const fb = Number(md?.[
          col === "ges" ? "deputatGes" : col === "gym" ? "deputatGym" : "deputatBk"
        ] ?? 0);
        const z = zellWert(col, m, fb);
        row.push(zelleZuRowCell(z));
      }
      row.push("—"); // Avg-Spalte für Schule leer (nur Gesamt-Avg sinnvoll)
      body.push(row);
    }

    // Periode-Zeile (Term-IDs, nur Information)
    const periodeRow: unknown[] = [{ content: "Periode", styles: { fontSize: 6, textColor: [107, 114, 128] as [number, number, number], fillColor: [249, 250, 251] as [number, number, number] } }];
    for (let m = 1; m <= 12; m++) {
      const md = monatsArr[m - 1];
      periodeRow.push({ content: md?.untisTermId != null ? `T${md.untisTermId}` : "—", styles: { fontSize: 6, textColor: [107, 114, 128] as [number, number, number], fillColor: [249, 250, 251] as [number, number, number] } });
    }
    periodeRow.push({ content: "", styles: { fillColor: [249, 250, 251] as [number, number, number] } });
    body.push(periodeRow);

    y = addPdfTable(doc, y, head, body, {
      styles: { fontSize: 7, halign: "right", cellPadding: 1.2 },
      headStyles: { fontSize: 7, halign: "center", fillColor: [87, 87, 86] },
      columnStyles: {
        0: { halign: "left", cellWidth: 16, fontStyle: "bold" },
        13: { halign: "right", cellWidth: 12, fillColor: [243, 244, 246] },
      },
    });

    // Legende: * = tagesgenaue Korrektur
    if (korrigierteMonate.length > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(226, 0, 26);
      doc.text("* = tagesgenaue Korrektur (siehe Herleitung unten)", 14, y + 2);
      doc.setTextColor(0, 0, 0);
      y += 4;
    }
    y += 4;

    // 4. Echte Wertwechsel
    if (echteAenderungen.length > 0) {
      y = ensureSpace(doc, y, 30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Echte Wertwechsel im Schuljahresverlauf", 14, y);
      y += 5;

      const ahead = [["Untis-Montag", "Tats. Datum", "Term-Wechsel", "Wert alt", "Wert neu", "Diff WS", "Korrigiert von"]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const abody: any[][] = echteAenderungen.map((a) => {
        const delta = Number(a.delta_gesamt);
        return [
          fmtDeDate(a.wirksam_ab),
          a.tatsaechliches_datum
            ? { content: fmtDeDate(a.tatsaechliches_datum), styles: { textColor: [226, 0, 26] as [number, number, number], fontStyle: "bold" as const } }
            : "—",
          `T${a.term_alt} -> T${a.term_neu}`,
          fmt(Number(a.gesamt_alt)),
          { content: fmt(Number(a.gesamt_neu)), styles: { fontStyle: "bold" as const } },
          {
            content: (delta > 0 ? "+" : "") + fmt(delta),
            styles: {
              textColor: (delta > 0
                ? [107, 170, 36]
                : delta < 0
                  ? [226, 0, 26]
                  : [0, 0, 0]) as [number, number, number],
              fontStyle: "bold" as const,
            },
          },
          a.korrigiert_von ?? "—",
        ];
      });
      y = addPdfTable(doc, y, ahead, abody, {
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
        },
      });
      y += 4;
    }

    // 5. Periodenverlauf
    if (periodenverlauf.length > 0) {
      y = ensureSpace(doc, y, 30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Untis-Periodenverlauf (Quelle der Wahrheit)", 14, y);
      y += 5;

      const phead = [["SY/Term", "Periode", "Gültig von", "Gültig bis", "Gesamt", "GES", "GYM", "BK"]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pbody: any[][] = periodenverlauf.map((p) => [
        `${p.schoolYearId} · T${p.termId}`,
        p.isBPeriod
          ? { content: `${p.termName ?? "—"} (b)`, styles: { fontStyle: "italic" as const } }
          : (p.termName ?? "—"),
        fmtDeDateKurz(String(p.gueltigVon)),
        fmtDeDateKurz(String(p.gueltigBis)),
        { content: fmt(Number(p.deputatGesamt)), styles: { fontStyle: "bold" as const } },
        fmt(Number(p.deputatGes)),
        fmt(Number(p.deputatGym)),
        fmt(Number(p.deputatBk)),
      ]);
      y = addPdfTable(doc, y, phead, pbody, {
        styles: { fontSize: 7, cellPadding: 1.2 },
        columnStyles: {
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right" },
          7: { halign: "right" },
        },
      });
      y += 4;
    }

    // 6. Tagesgenaue Berechnung pro Monat (Herleitung)
    if (korrigierteMonate.length > 0) {
      y = ensureSpace(doc, y, 30);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Tagesgenaue Deputatsberechnung (§ 3 Abs. 1 FESchVO)", 14, y);
      y += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(87, 87, 86);
      const formelText = doc.splitTextToSize(
        "Formel: effektiv = (alt / Monatstage × Tage vor Aenderung) + (neu / Monatstage × Tage ab Aenderung). Bei mehreren Aenderungen im Monat wird der Monat in Zeitsegmente zerlegt.",
        pageWidth - 28,
      );
      doc.text(formelText, 14, y);
      y += formelText.length * 3.5 + 2;
      doc.setTextColor(0, 0, 0);

      // Eine kompakte Tabelle pro Monat: Aenderungs-Aufschluesselung
      // (Pauschal/Effektiv-Summary als Tabellen-Footer, damit nichts abgeschnitten wird)
      for (const e of korrigierteMonate.sort((a, b) => a.monat - b.monat)) {
        y = ensureSpace(doc, y, 22 + e.aenderungen.length * 8);

        // Monatsname + Tage als kleiner Block-Header (linksbuendig, voller Breite)
        doc.setFillColor(243, 244, 246);
        doc.rect(14, y, pageWidth - 28, 6.5, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`${MONATE_KURZ[e.monat - 1]} ${hj.jahr} (${e.monatsTage} Tage)`, 17, y + 4.5);
        y += 8;

        const dthead = [["Aenderung am", "Vor (alt)", "Ab (neu)", "Anteil alt", "Anteil neu", "Summe"]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dtbody: any[][] = e.aenderungen.map((a) => [
          `${new Date(a.datum + "T00:00:00").toLocaleDateString("de-DE")} (Tag ${a.tag}/${e.monatsTage})`,
          `${fmt(a.alt.gesamt)} x ${a.tageVor} T`,
          `${fmt(a.neu.gesamt)} x ${a.tageNach} T`,
          fmt(a.anteilAlt.gesamt, 3),
          fmt(a.anteilNeu.gesamt, 3),
          {
            content: fmt(a.anteilAlt.gesamt + a.anteilNeu.gesamt, 3),
            styles: { fontStyle: "bold" as const, textColor: [226, 0, 26] as [number, number, number] },
          },
        ]);

        // Footer-Zeile mit Pauschal/Effektiv/Korrektur
        const korrText = (e.korrektur.gesamt >= 0 ? "+" : "") + fmt(e.korrektur.gesamt, 3);
        dtbody.push([
          {
            content: `Pauschal: ${fmt(e.pauschal.gesamt)}   ->   Effektiv: ${fmt(e.effektiv.gesamt)}   (Korrektur: ${korrText})`,
            colSpan: 6,
            styles: {
              fontStyle: "bold" as const,
              fillColor: [254, 242, 242] as [number, number, number],
              textColor: [120, 0, 0] as [number, number, number],
              halign: "left" as const,
            },
          },
        ]);

        y = addPdfTable(doc, y, dthead, dtbody, {
          styles: { fontSize: 8, cellPadding: 1.4 },
          columnStyles: {
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
          },
        });
        y += 3;
      }
    }

    // 7. Rechtsgrundlage
    y = ensureSpace(doc, y, 30);
    y += 4;
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.3);
    const rgHeight = 26;
    doc.rect(14, y, pageWidth - 28, rgHeight, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Rechtsgrundlage", 17, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(87, 87, 86);
    const rgText = doc.splitTextToSize(
      "Gemaess § 3 Abs. 1 FESchVO werden die Personalkosten auf Basis der tatsaechlich erteilten Unterrichtsstunden refinanziert. Bei Aenderungen des Deputats (PlannedWeek) aendert sich die Bezugsgrundlage fuer die Verguetung nach § 107 Abs. 2 SchulG NRW. Verschiebungen zwischen Schulen (Verteilungsaenderungen) beeinflussen die schulspezifische Stellenistberechnung, nicht aber das Gesamtgehalt. Jeder Monat fliesst einzeln in die gewichtete Jahresberechnung ein: (Jan-Jul × 7 + Aug-Dez × 5) / 12.",
      pageWidth - 34,
    );
    doc.text(rgText, 17, y + 9);
    doc.setTextColor(0, 0, 0);

    // Seitennummern + Fuss
    addPdfPageNumbers(doc);

    const buffer = pdfToBuffer(doc);
    const safeName = l.vollname.replace(/[^a-zA-Z0-9_-]/g, "_");
    return pdfResponse(buffer, `Lehrer_${safeName}_HJ${hj.jahr}.pdf`);
  } catch (err) {
    console.error("Lehrer-Detail-Export-Fehler:", err);
    return new Response("Fehler beim Erstellen des PDF.", { status: 500 });
  }
}
