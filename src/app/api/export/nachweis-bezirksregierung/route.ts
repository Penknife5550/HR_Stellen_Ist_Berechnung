/**
 * GET /api/export/nachweis-bezirksregierung?haushaltsjahrId=X&format=pdf|excel
 *
 * Nachweis fuer die Bezirksregierung. Je Schule untereinander, Lehrkraefte
 * getrennt nach Status (Beamte / Angestellte / Sonstige), getrennt nach den
 * Zeitraeumen Januar–Juli und August–Dezember. Zusaetzlich je Schule: das
 * Feld Mehrarbeit und die Aufstellung der zusaetzlichen Stellenanteile.
 *
 * Rechtsgrundlage: § 3 Abs. 1 FESchVO (tatsaechlich erteilte Unterrichts-
 * stunden bei der erteilenden Schule), § 2 Abs. 1 VO zu § 93 Abs. 2 SchulG NRW
 * (Regelstundendeputat).
 *
 * Enthaelt Klarnamen (PII) → Rollen-Gate "mitarbeiter" + Audit-Log (DSGVO Art. 30).
 */

import { NextRequest } from "next/server";
import { getOptionalSession, ROLE_LEVEL } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import {
  getSchulen,
  getHaushaltsjahrById,
  getRegeldeputateMap,
  getLehrerStatistikGruppen,
  getMehrarbeitByHaushaltsjahr,
  getStellenanteileBySchuleUndHj,
  getStellenistDrilldownByLehrer,
} from "@/lib/db/queries";
import { berechneStellenist } from "@/lib/berechnungen/stellenist";
import {
  gruppiereNachStatus,
  gewichteterJahreswert,
  summeNachweis,
  schuljahreFuerKalenderjahr,
  summeMonate,
  MONATE_JAN_JUL,
  MONATE_AUG_DEZ,
  ALLE_MONATE,
  type NachweisLehrerRow,
  type NachweisSchule,
  type NachweisMehrarbeit,
  type NachweisMehrarbeitLehrer,
  type NachweisStellenanteil,
  type NachweisDaten,
} from "@/lib/export/nachweis";
import { renderNachweisPdf, renderNachweisExcel } from "@/lib/export/nachweis-render";
import { pdfResponse } from "@/lib/export/pdf";
import { excelResponse } from "@/lib/export/excel";

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================
// DATEN LADEN
// ============================================================

async function ladeNachweisDaten(haushaltsjahrId: number, jahr: number): Promise<NachweisDaten> {
  const [schulen, regelMap, gruppenRows] = await Promise.all([
    getSchulen(),
    getRegeldeputateMap(),
    getLehrerStatistikGruppen(),
  ]);
  const gruppeByLehrer = new Map<number, string | null>(
    gruppenRows.map((g) => [g.id, g.statistikGruppe]),
  );

  const schulenNachweis: NachweisSchule[] = [];

  for (const schule of schulen) {
    const regeldeputat = regelMap.get(schule.kurzname);
    if (regeldeputat === undefined) continue; // ohne Regeldeputat nicht berechenbar

    // Tatsaechliche Wochenstunden je Lehrkraft und Monat (Kalenderjahr 1..12),
    // schulspezifisch + tagesgenau — dieselbe Datenquelle wie der Drilldown.
    const [drilldownRows, mehrarbeitRows] = await Promise.all([
      getStellenistDrilldownByLehrer(haushaltsjahrId, schule.kurzname, [...ALLE_MONATE]),
      getMehrarbeitByHaushaltsjahr(haushaltsjahrId, schule.id),
    ]);

    // Pro Lehrer: Wochenstunden je Monat + Halbjahres-Summen.
    const perLehrer = new Map<number, NachweisLehrerRow>();
    for (const r of drilldownRows) {
      let agg = perLehrer.get(r.lehrerId);
      if (!agg) {
        agg = {
          lehrerId: r.lehrerId,
          vollname: r.vollname,
          stammschuleCode: r.stammschuleCode,
          gruppe: gruppeByLehrer.get(r.lehrerId) ?? null,
          stundenProMonat: {},
          summeJanJul: 0,
          summeAugDez: 0,
        };
        perLehrer.set(r.lehrerId, agg);
      }
      agg.stundenProMonat[r.monat] = round3(Number(r.wochenstunden));
    }
    for (const agg of perLehrer.values()) {
      agg.summeJanJul = round3(summeMonate(agg.stundenProMonat, MONATE_JAN_JUL));
      agg.summeAugDez = round3(summeMonate(agg.stundenProMonat, MONATE_AUG_DEZ));
    }

    const gruppen = gruppiereNachStatus([...perLehrer.values()]);

    // Schul-Monatssummen ueber alle Gruppen.
    const monatsSummen: Record<number, number> = {};
    for (const m of ALLE_MONATE) {
      monatsSummen[m] = round3(gruppen.reduce((s, g) => s + (g.monatsSummen[m] ?? 0), 0));
    }
    const summeJanJul = round3(gruppen.reduce((s, g) => s + g.summeJanJul, 0));
    const summeAugDez = round3(gruppen.reduce((s, g) => s + g.summeAugDez, 0));

    // Autoritative Stellen — identische Formel wie berechneStellenisteAction.
    const libResult = berechneStellenist({
      monatlicheStunden: ALLE_MONATE.map((m) => ({ monat: m, stunden: monatsSummen[m] ?? 0 })),
      regeldeputat,
      mehrarbeitStunden: mehrarbeitRows
        .filter((m) => m.lehrerId !== null)
        .map((m) => ({ monat: m.monat, stunden: Number(m.stunden) })),
      mehrarbeitStellen: mehrarbeitRows
        .filter((m) => m.lehrerId === null && m.stellenanteil !== null)
        .map((m) => ({ monat: m.monat, stellen: Number(m.stellenanteil) })),
    });

    // Mehrarbeit-Block je Schule.
    const maLehrerMap = new Map<string, NachweisMehrarbeitLehrer>();
    for (const m of mehrarbeitRows) {
      if (m.lehrerId === null) continue;
      const std = Number(m.stunden ?? 0);
      if (std === 0) continue;
      const name = m.lehrerName ?? "—";
      const ex = maLehrerMap.get(name) ?? { vollname: name, janJulStunden: 0, augDezStunden: 0 };
      if (MONATE_JAN_JUL.includes(m.monat)) ex.janJulStunden += std;
      else ex.augDezStunden += std;
      maLehrerMap.set(name, ex);
    }
    const maLehrer = [...maLehrerMap.values()]
      .map((l) => ({
        vollname: l.vollname,
        janJulStunden: round3(l.janJulStunden),
        augDezStunden: round3(l.augDezStunden),
      }))
      .sort((a, b) => a.vollname.localeCompare(b.vollname, "de"));
    const schulweitJanJul = round4(
      mehrarbeitRows
        .filter((m) => m.lehrerId === null && m.stellenanteil !== null && MONATE_JAN_JUL.includes(m.monat))
        .reduce((s, m) => s + Number(m.stellenanteil), 0),
    );
    const schulweitAugDez = round4(
      mehrarbeitRows
        .filter((m) => m.lehrerId === null && m.stellenanteil !== null && MONATE_AUG_DEZ.includes(m.monat))
        .reduce((s, m) => s + Number(m.stellenanteil), 0),
    );
    const mehrarbeit: NachweisMehrarbeit = {
      lehrer: maLehrer,
      schulweitJanJulStellen: schulweitJanJul,
      schulweitAugDezStellen: schulweitAugDez,
      stellenJanJul: round4(libResult.mehrarbeitStellen.janJul),
      stellenAugDez: round4(libResult.mehrarbeitStellen.augDez),
      hatDaten: maLehrer.length > 0 || schulweitJanJul > 0 || schulweitAugDez > 0,
    };

    const stellenanteilRows = await getStellenanteileBySchuleUndHj(schule.id, haushaltsjahrId);
    const stellenanteile: NachweisStellenanteil[] = stellenanteilRows.map((s) => ({
      bezeichnung: s.stellenartBezeichnung,
      kuerzel: s.stellenartKuerzel ?? null,
      typ: s.stellenartTyp,
      wert: Number(s.wert),
      eurBetrag: s.eurBetrag !== null ? Number(s.eurBetrag) : null,
      zeitraum: s.zeitraum,
      status: s.status,
      lehrerName: s.lehrerName ?? null,
      aktenzeichen: s.aktenzeichen ?? null,
    }));

    // Schule nur aufnehmen, wenn es tatsaechlich etwas nachzuweisen gibt.
    const hatDaten = gruppen.length > 0 || mehrarbeit.hatDaten || stellenanteile.length > 0;
    if (!hatDaten) continue;

    const gesamtJanJul = round4(libResult.gesamtStellen.janJul);
    const gesamtAugDez = round4(libResult.gesamtStellen.augDez);

    schulenNachweis.push({
      schuleId: schule.id,
      kurzname: schule.kurzname,
      name: schule.name,
      farbe: schule.farbe,
      regeldeputat,
      gruppen,
      monatsSummen,
      summeJanJul,
      summeAugDez,
      stellenJanJul: round4(libResult.janJul.stellen),
      stellenAugDez: round4(libResult.augDez.stellen),
      mehrarbeit,
      gesamtStellenJanJul: gesamtJanJul,
      gesamtStellenAugDez: gesamtAugDez,
      jahreswertGewichtet: gewichteterJahreswert(gesamtJanJul, gesamtAugDez),
      stellenanteile,
    });
  }

  const sj = schuljahreFuerKalenderjahr(jahr);
  return {
    haushaltsjahr: jahr,
    altesSchuljahr: sj.altes,
    neuesSchuljahr: sj.neues,
    erstelltAm: new Date().toISOString(),
    schulen: schulenNachweis,
    gesamt: summeNachweis(schulenNachweis),
  };
}

// ============================================================
// ROUTE
// ============================================================

export async function GET(request: NextRequest) {
  const session = await getOptionalSession();
  if (!session) return new Response("Nicht authentifiziert.", { status: 401 });
  if (ROLE_LEVEL[session.rolle] < ROLE_LEVEL["mitarbeiter"]) {
    return new Response("Keine Berechtigung.", { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const haushaltsjahrId = Number(searchParams.get("haushaltsjahrId"));
  const format = searchParams.get("format") ?? "pdf";

  if (!haushaltsjahrId || haushaltsjahrId <= 0) {
    return new Response("haushaltsjahrId fehlt.", { status: 400 });
  }
  if (format !== "pdf" && format !== "excel") {
    return new Response("format muss pdf oder excel sein.", { status: 400 });
  }

  try {
    const hj = await getHaushaltsjahrById(haushaltsjahrId);
    if (!hj) return new Response("Haushaltsjahr nicht gefunden.", { status: 404 });

    const daten = await ladeNachweisDaten(haushaltsjahrId, hj.jahr);

    await writeAuditLog(
      "export_nachweis_bezirksregierung",
      haushaltsjahrId,
      "INSERT",
      null,
      { jahr: hj.jahr, format, anzahlSchulen: daten.schulen.length },
      session.name,
    );

    if (format === "excel") {
      const buffer = await renderNachweisExcel(daten);
      return excelResponse(buffer, `Nachweis_Bezirksregierung_${hj.jahr}.xlsx`);
    }
    const buffer = renderNachweisPdf(daten);
    return pdfResponse(buffer, `Nachweis_Bezirksregierung_${hj.jahr}.pdf`);
  } catch (err) {
    console.error("[/api/export/nachweis-bezirksregierung] Fehler:", err);
    return new Response("Interner Serverfehler beim Erstellen des Nachweises.", { status: 500 });
  }
}
