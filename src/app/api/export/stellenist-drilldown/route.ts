/**
 * GET /api/export/stellenist-drilldown?schule=GYM&hj=2026&zeitraum=aug-dez
 *
 * Exportiert den Drilldown einer Stellenist-Karte als CSV (UTF-8 mit BOM).
 * Eine Zeile pro Lehrer mit Stunden je Monat im gewaehlten Zeitraum +
 * separater Block fuer Mehrarbeit (lehrer-bezogen + schulweit).
 */

import { NextRequest } from "next/server";
import { getOptionalSession, ROLE_LEVEL } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import { getStellenistDrilldownAction } from "@/app/stellenist/actions";

const MONATE_KURZ = ["", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function csvEscape(value: string | number): string {
  let s = String(value);
  // Excel-Formula-Injection: Werte, die mit =, +, -, @, Tab oder CR beginnen,
  // werden in Excel als Formel ausgewertet. Mit ' praefixen und quoten.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmtDe(n: number, dec = 2): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return new Response("Nicht authentifiziert.", { status: 401 });
  if (ROLE_LEVEL[session.rolle] < ROLE_LEVEL["mitarbeiter"]) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const schule = searchParams.get("schule");
  const hjId = Number(searchParams.get("hj"));
  const zeitraum = searchParams.get("zeitraum");

  if (!schule || !hjId || (zeitraum !== "aug-dez" && zeitraum !== "jan-jul")) {
    return new Response("Parameter fehlen oder ungueltig (schule, hj, zeitraum).", { status: 400 });
  }

  const result = await getStellenistDrilldownAction(schule, hjId, zeitraum);
  if ("error" in result) return new Response(result.error, { status: 400 });
  const d = result.data!;

  await writeAuditLog(
    "export_stellenist_drilldown",
    hjId,
    "INSERT",
    null,
    { schule, zeitraum, format: "csv" },
    session.name,
  );

  // CSV bauen
  const monate = d.monate;
  const monatHeader = monate.map((m) => MONATE_KURZ[m] ?? String(m));
  const lines: string[] = [];
  lines.push(
    [
      "Lehrer",
      "Stammschule",
      ...monatHeader,
      "Summe WS",
      "Durchschnitt WS",
      "Stellen-Anteil",
      "Korrektur in Monaten",
    ].map(csvEscape).join(";"),
  );

  for (const l of d.lehrer) {
    lines.push(
      [
        l.vollname,
        l.stammschuleCode ?? "",
        ...monate.map((m) => fmtDe(l.stundenProMonat[m] ?? 0)),
        fmtDe(l.summeStunden),
        fmtDe(l.durchschnittWS),
        fmtDe(l.stellenAnteil, 4),
        l.korrekturMonate.length > 0
          ? l.korrekturMonate.map((m) => MONATE_KURZ[m]).join(", ")
          : "",
      ].map(csvEscape).join(";"),
    );
  }

  // Summenzeile
  lines.push(
    [
      "Summe Wochenstunden (alle Lehrer)",
      "",
      ...monate.map((m) =>
        fmtDe(d.lehrer.reduce((acc, l) => acc + (l.stundenProMonat[m] ?? 0), 0)),
      ),
      fmtDe(d.summen.stunden),
      fmtDe(d.summen.durchschnittWS),
      fmtDe(d.summen.stellenAusStunden, 4),
      "",
    ].map(csvEscape).join(";"),
  );

  // Mehrarbeit-Block
  if (d.mehrarbeitLehrer.length > 0 || d.mehrarbeitSchuleStellen > 0) {
    lines.push("");
    lines.push("Mehrarbeit");
    lines.push(["Lehrer", "", "Summe Stunden", "", "Stellen-Anteil"].map(csvEscape).join(";"));
    for (const m of d.mehrarbeitLehrer) {
      lines.push(
        [m.vollname, "", fmtDe(m.summeStunden), "", fmtDe(m.stellenAnteil, 4)]
          .map(csvEscape)
          .join(";"),
      );
    }
    if (d.mehrarbeitSchuleStellen > 0) {
      lines.push(
        ["Schulweite Mehrarbeit (ohne Lehrer)", "", "", "", fmtDe(d.mehrarbeitSchuleStellen, 4)]
          .map(csvEscape)
          .join(";"),
      );
    }
  }

  // Gesamt-Footer
  lines.push("");
  lines.push(
    ["Gesamt-Stellen (Wochenstunden + Mehrarbeit)", "", "", "", fmtDe(d.summen.gesamt, 4)]
      .map(csvEscape)
      .join(";"),
  );

  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  // Schule kommt aus URL — defensiv gegen Header-Injection sanitisieren.
  const schuleSafe = schule.replace(/[^A-Za-z0-9_\-.]/g, "_");
  const safeName = `stellenist_drilldown_${schuleSafe}_${zeitraum}_HJ${hjId}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
    },
  });
}
