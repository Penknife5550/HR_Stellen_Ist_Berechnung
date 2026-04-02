"use client";

import { useState } from "react";
import { KPICard } from "@/components/ui/Card";

type Schule = { id: number; kurzname: string; name: string; farbe: string };
type Vergleich = { stellensoll: number; stellenist: number; differenz: number; status: string };
type SollZusammensetzung = {
  grundstellen: number;
  zuschlaegeSumme: number;
  stellensoll: number;
  details: Array<{ bezeichnung: string; kuerzel?: string; typ?: string; wert: number; eurBetrag?: number; wahlrecht?: string; istDeputatswirksam?: boolean }>;
};
type SaRow = { id: number; bezeichnung: string; kuerzel: string | null; typ: string; wert: number; eurBetrag: number | null; wahlrecht: string | null; status: string; befristetBis: string | null; lehrerName: string | null };
type Befristung = { id: number; bezeichnung: string; lehrerName: string | null; befristetBis: string | null; wert: number };

interface Props {
  schulen: Schule[];
  vergleichBySchule: Record<number, Vergleich>;
  sollBySchule: Record<number, SollZusammensetzung>;
  saBySchule: Record<number, SaRow[]>;
  istBySchule: Record<number, { gewichtetStunden: number; regeldeputat: number }>;
  lehrerCounts: Record<number, number>;
  regeldeputateMap: Record<string, number>;
  befristungenBySchule: Record<number, Befristung[]>;
  latestSyncDatum: string | null;
  hatBerechnung: boolean;
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  genehmigt: { color: "bg-green-500", label: "Genehmigt" },
  beantragt: { color: "bg-amber-400", label: "Beantragt" },
  abgelehnt: { color: "bg-red-500", label: "Abgelehnt" },
  zurueckgezogen: { color: "bg-gray-400", label: "Zurueckgezogen" },
};

function fmtNum(v: number, decimals = 1): string {
  return v.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtEur(v: number): string {
  return v.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("de-DE");
}

export function DashboardClient({
  schulen, vergleichBySchule, sollBySchule, saBySchule, istBySchule,
  lehrerCounts, regeldeputateMap, befristungenBySchule, latestSyncDatum, hatBerechnung,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<number | "alle">("alle");

  // ============================================================
  // AGGREGATION fuer "Alle"
  // ============================================================
  const gesamtSoll = Object.values(vergleichBySchule).reduce((s, v) => s + v.stellensoll, 0);
  const gesamtIst = Object.values(vergleichBySchule).reduce((s, v) => s + v.stellenist, 0);
  const gesamtDiff = Math.round((gesamtIst - gesamtSoll) * 10) / 10;
  const gesamtLehrer = Object.values(lehrerCounts).reduce((s, v) => s + v, 0);
  const gesamtSaGenehmigt = Object.values(saBySchule).flat().filter((s) => s.status === "genehmigt").length;
  const gesamtSaBeantragt = Object.values(saBySchule).flat().filter((s) => s.status === "beantragt").length;
  const alleBefristungen = Object.values(befristungenBySchule).flat();

  // Deputat-Gesamtwerte
  const gesamtDeputatSoll = schulen.reduce((s, sch) => {
    const vgl = vergleichBySchule[sch.id];
    const rd = regeldeputateMap[sch.kurzname] ?? 0;
    return s + (vgl && rd > 0 ? vgl.stellensoll * rd : 0);
  }, 0);
  const gesamtDeputatIst = schulen.reduce((s, sch) => {
    const ist = istBySchule[sch.id];
    return s + (ist ? Math.round((ist.gewichtetStunden / 12) * 100) / 100 : 0);
  }, 0);

  const activeSchule = activeFilter !== "alle" ? schulen.find((s) => s.id === activeFilter) : null;

  // ============================================================
  // RENDER: Einzelschul-Ansicht
  // ============================================================
  function renderSchule(schule: Schule) {
    const vgl = vergleichBySchule[schule.id];
    const soll = sollBySchule[schule.id];
    const saList = saBySchule[schule.id] ?? [];
    const ist = istBySchule[schule.id];
    const rd = regeldeputateMap[schule.kurzname] ?? 0;
    const lCount = lehrerCounts[schule.id] ?? 0;
    const befr = befristungenBySchule[schule.id] ?? [];

    const stellensoll = vgl?.stellensoll ?? 0;
    const stellenist = vgl?.stellenist ?? 0;
    const differenz = vgl?.differenz ?? 0;
    const diffStatus: "success" | "warning" | "danger" | "neutral" =
      !vgl ? "neutral" : differenz <= 0 ? "success" : differenz <= 0.5 ? "warning" : "danger";

    // Stellensoll-Zusammensetzung
    const grundstellen = soll?.grundstellen ?? 0;
    const detailsA = (soll?.details ?? []).filter((d) => d.typ === "A" || (!d.typ && d.istDeputatswirksam !== false && !d.kuerzel?.startsWith("DIGI")));
    const detailsA106 = (soll?.details ?? []).filter((d) => d.typ === "A_106" || (!d.typ && !d.istDeputatswirksam));
    const detailsB = (soll?.details ?? []).filter((d) => d.typ === "B");
    const sumA = detailsA.reduce((s, d) => s + d.wert, 0);
    const sumA106 = detailsA106.reduce((s, d) => s + d.wert, 0);
    const sumBStelle = detailsB.filter((d) => d.wahlrecht === "stelle").reduce((s, d) => s + d.wert, 0);
    const sumEur = saList.filter((s) => s.status === "genehmigt" && s.eurBetrag).reduce((s, r) => s + (r.eurBetrag ?? 0), 0);

    // Balken-Maximalwert
    const barMax = stellensoll > 0 ? stellensoll : grundstellen || 1;

    // Deputat
    const sollStunden = rd > 0 && stellensoll > 0 ? stellensoll * rd : null;
    const istStunden = ist ? Math.round((ist.gewichtetStunden / 12) * 100) / 100 : null;

    // Status-Zaehler
    const statusCounts: Record<string, number> = {};
    for (const sa of saList) {
      statusCounts[sa.status] = (statusCounts[sa.status] ?? 0) + 1;
    }

    return (
      <div className="space-y-5">
        {/* 1. Haupt-KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Stellensoll" value={vgl ? fmtNum(stellensoll) : "\u2014"} subtitle="Berechneter Bedarf" accentColor={schule.farbe} />
          <KPICard label="Stellenist" value={vgl ? fmtNum(stellenist) : "\u2014"} subtitle="Tatsaechliche Stellen" accentColor={schule.farbe} />
          <KPICard
            label="Differenz (Ist - Soll)"
            value={vgl ? (differenz > 0 ? "+" : "") + fmtNum(differenz) : "\u2014"}
            subtitle={diffStatus === "success" ? "Im Soll" : diffStatus === "warning" ? "Grenzbereich" : diffStatus === "danger" ? "Ueber Soll" : "Berechnung ausstehend"}
            status={diffStatus}
          />
          <KPICard label="Lehrkraefte" value={lCount > 0 ? String(lCount) : "\u2014"} subtitle="Aktive Lehrkraefte" status="neutral" />
        </div>

        {/* 2. Stellensoll-Zusammensetzung */}
        {soll && stellensoll > 0 && (
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-4">Stellensoll-Zusammensetzung</h3>
            <div className="space-y-2">
              <BarRow label="Grundstellen (SLR)" value={grundstellen} max={barMax} color="#94A3B8" />
              {sumA > 0 && <BarRow label="Abschnitt 2 (Zuschlaege)" value={sumA} max={barMax} color="#3B82F6" />}
              {sumA106 > 0 && <BarRow label="Abschnitt 4 (§106)" value={sumA106} max={barMax} color="#8B5CF6" />}
              {sumBStelle > 0 && <BarRow label="Wahlleistung (Stelle)" value={sumBStelle} max={barMax} color="#F59E0B" />}
              <div className="flex justify-between pt-2 border-t border-[#E5E7EB]">
                <span className="text-[15px] font-bold text-[#1A1A1A]">Stellensoll gesamt</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: schule.farbe }}>{fmtNum(stellensoll)}</span>
              </div>
              {sumEur > 0 && (
                <div className="flex justify-between pt-1">
                  <span className="text-sm text-emerald-700">Geldleistungen (Typ B/C)</span>
                  <span className="text-sm font-bold tabular-nums text-emerald-700">{fmtEur(sumEur)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Stellenanteile-Status */}
        {saList.length > 0 && (
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Stellenanteile</h3>
              <div className="flex items-center gap-4 text-sm">
                {statusCounts.genehmigt && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />{statusCounts.genehmigt} Genehmigt</span>}
                {statusCounts.beantragt && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />{statusCounts.beantragt} Beantragt</span>}
                {statusCounts.abgelehnt && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />{statusCounts.abgelehnt} Abgelehnt</span>}
              </div>
            </div>

            <div className="space-y-1">
              {saList.map((sa) => {
                const dot = STATUS_DOT[sa.status] ?? STATUS_DOT.beantragt;
                return (
                  <div key={sa.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[#F9FAFB] text-[14px]">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot.color}`} title={dot.label} />
                    {sa.kuerzel && <span className="font-mono text-xs font-bold text-[#6B7280] w-12">{sa.kuerzel}</span>}
                    <span className="flex-1 truncate">{sa.bezeichnung}</span>
                    {sa.lehrerName && <span className="text-xs text-[#6B7280] truncate max-w-[120px]">{sa.lehrerName}</span>}
                    <span className="tabular-nums font-bold text-right w-16">
                      {sa.typ === "C" || (sa.typ === "B" && sa.wahlrecht === "geld")
                        ? (sa.eurBetrag ? fmtEur(sa.eurBetrag) : "\u2014")
                        : fmtNum(sa.wert, 2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Befristungs-Warnung */}
            {befr.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <span className="font-bold text-amber-800">Befristung laeuft ab: </span>
                {befr.map((b, i) => (
                  <span key={b.id} className="text-amber-700">
                    {i > 0 && ", "}
                    {b.bezeichnung}{b.lehrerName ? ` (${b.lehrerName})` : ""} am {formatDate(b.befristetBis)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Deputatstundenrahmen */}
        {(sollStunden || istStunden) && (
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">Deputatstundenrahmen (Wochenstunden)</h3>
            <div className="space-y-3">
              {/* Soll-Balken */}
              {sollStunden && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#575756] w-[80px] flex-shrink-0">Soll</span>
                  <div className="flex-1 bg-[#F3F4F6] rounded-full h-6 overflow-hidden relative">
                    <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: `${schule.farbe}30` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#575756]">
                      {fmtNum(sollStunden)} Std.
                    </span>
                  </div>
                </div>
              )}
              {/* Ist-Balken (relativ zu Soll) */}
              {istStunden !== null && sollStunden && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#575756] w-[80px] flex-shrink-0">Ist</span>
                  <div className="flex-1 bg-[#F3F4F6] rounded-full h-6 overflow-hidden relative">
                    {(() => {
                      const pct = sollStunden > 0 ? Math.min((istStunden / sollStunden) * 100, 105) : 0;
                      const overBudget = istStunden > sollStunden;
                      return (
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: overBudget ? "#EF4444" : schule.farbe,
                          }}
                        />
                      );
                    })()}
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#575756]">
                      {fmtNum(istStunden)} Std.
                    </span>
                  </div>
                </div>
              )}
              {/* Differenz + Regeldeputat */}
              <div className="flex justify-between pt-2 border-t border-[#E5E7EB] text-sm">
                {sollStunden && istStunden !== null && (() => {
                  const diff = Math.round((istStunden - sollStunden) * 10) / 10;
                  return (
                    <span className={diff <= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      Differenz: {diff > 0 ? "+" : ""}{fmtNum(diff)} Std.
                      {diff <= 0 ? " (noch Kapazitaet)" : " (ueber Rahmen)"}
                    </span>
                  );
                })()}
                {rd > 0 && (
                  <span className="text-[#6B7280]">Regeldeputat: {fmtNum(rd)} Std./Stelle</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: Alle-Ansicht
  // ============================================================
  function renderAlle() {
    return (
      <div className="space-y-5">
        {/* Gesamt-KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard label="Stellensoll (gesamt)" value={gesamtSoll > 0 ? fmtNum(gesamtSoll) : "\u2014"} subtitle="Alle Schulen" status="neutral" />
          <KPICard label="Stellenist (gesamt)" value={gesamtIst > 0 ? fmtNum(gesamtIst) : "\u2014"} subtitle="Alle Schulen" status="neutral" />
          <KPICard label="Lehrkraefte (gesamt)" value={String(gesamtLehrer)} subtitle="Alle aktiven Lehrkraefte" status="neutral" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KPICard
            label="Deputat-Soll (gesamt)"
            value={gesamtDeputatSoll > 0 ? fmtNum(gesamtDeputatSoll) + " Std." : "\u2014"}
            subtitle="Wochenstundenrahmen alle Schulen"
            status="neutral"
          />
          <KPICard
            label="Deputat-Ist (gesamt)"
            value={gesamtDeputatIst > 0 ? fmtNum(gesamtDeputatIst) + " Std." : "\u2014"}
            subtitle="Tatsaechliche Wochenstunden"
            status={gesamtDeputatIst > gesamtDeputatSoll && gesamtDeputatSoll > 0 ? "danger" : "neutral"}
          />
          <KPICard
            label="Stellenanteile"
            value={`${gesamtSaGenehmigt} / ${gesamtSaGenehmigt + gesamtSaBeantragt}`}
            subtitle={`${gesamtSaGenehmigt} genehmigt, ${gesamtSaBeantragt} offen`}
            status={gesamtSaBeantragt > 0 ? "warning" : "success"}
          />
        </div>

        {/* Befristungs-Warnung global */}
        {alleBefristungen.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <div className="font-bold text-amber-800 mb-1">{alleBefristungen.length} Befristung(en) laufen in 90 Tagen ab:</div>
            {alleBefristungen.slice(0, 5).map((b) => (
              <div key={b.id} className="text-amber-700">
                {b.bezeichnung}{b.lehrerName ? ` (${b.lehrerName})` : ""} — {formatDate(b.befristetBis)}
              </div>
            ))}
          </div>
        )}

        {/* Schul-Tabelle */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="bg-[#F9FAFB] border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Schule</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Stellen Soll</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Stellen Ist</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Diff.</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Dep.-Soll</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Dep.-Ist</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Lehrkr.</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Zus. Stellen</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-10"></th>
              </tr>
            </thead>
            <tbody>
              {schulen.map((schule, i) => {
                const vgl = vergleichBySchule[schule.id];
                const saList = saBySchule[schule.id] ?? [];
                const genCount = saList.filter((s) => s.status === "genehmigt").length;
                const offenCount = saList.filter((s) => s.status === "beantragt").length;
                const diff = vgl?.differenz ?? null;
                const rd = regeldeputateMap[schule.kurzname] ?? 0;
                const depSoll = vgl && rd > 0 ? vgl.stellensoll * rd : null;
                const istData = istBySchule[schule.id];
                const depIst = istData ? Math.round((istData.gewichtetStunden / 12) * 100) / 100 : null;

                return (
                  <tr
                    key={schule.id}
                    className={`border-b border-[#E5E7EB] cursor-pointer hover:bg-[#F3F4F6] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}`}
                    onClick={() => setActiveFilter(schule.id)}
                  >
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: schule.farbe }} />
                        <span className="font-bold">{schule.kurzname}</span>
                        <span className="text-[#6B7280] text-sm hidden lg:inline">{schule.name}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold">{vgl ? fmtNum(vgl.stellensoll) : "\u2014"}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold">{vgl ? fmtNum(vgl.stellenist) : "\u2014"}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold">
                      {diff !== null ? (
                        <span className={diff <= 0 ? "text-green-600" : diff <= 0.5 ? "text-amber-600" : "text-red-600"}>
                          {diff > 0 ? "+" : ""}{fmtNum(diff)}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-sm">{depSoll ? fmtNum(depSoll) : "\u2014"}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-sm">
                      {depIst !== null && depSoll ? (
                        <span className={depIst > depSoll ? "text-red-600 font-bold" : ""}>{fmtNum(depIst)}</span>
                      ) : depIst !== null ? fmtNum(depIst) : "\u2014"}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">{lehrerCounts[schule.id] ?? "\u2014"}</td>
                    <td className="py-3 px-4 text-center">
                      {saList.length > 0 ? (
                        <span className="text-sm">
                          <span className="text-green-600 font-bold">{genCount}</span>
                          {offenCount > 0 && <span className="text-amber-600 ml-1">+{offenCount}</span>}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {diff !== null ? (
                        <span className={`inline-block w-3 h-3 rounded-full ${
                          diff <= 0 ? "bg-green-500" : diff <= 0.5 ? "bg-amber-400" : "bg-red-500"
                        }`} />
                      ) : <span className="inline-block w-3 h-3 rounded-full bg-gray-300" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#575756] bg-[#F3F4F6]">
                <td className="py-3 px-4 font-bold">Gesamt</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold">{gesamtSoll > 0 ? fmtNum(gesamtSoll) : "\u2014"}</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold">{gesamtIst > 0 ? fmtNum(gesamtIst) : "\u2014"}</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold">
                  {gesamtSoll > 0 ? (
                    <span className={gesamtDiff <= 0 ? "text-green-600" : "text-red-600"}>
                      {gesamtDiff > 0 ? "+" : ""}{fmtNum(gesamtDiff)}
                    </span>
                  ) : "\u2014"}
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-sm">{gesamtDeputatSoll > 0 ? fmtNum(gesamtDeputatSoll) : "\u2014"}</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold text-sm">{gesamtDeputatIst > 0 ? fmtNum(gesamtDeputatIst) : "\u2014"}</td>
                <td className="py-3 px-4 text-right tabular-nums font-bold">{gesamtLehrer}</td>
                <td className="py-3 px-4 text-center text-sm">
                  <span className="text-green-600 font-bold">{gesamtSaGenehmigt}</span>
                  {gesamtSaBeantragt > 0 && <span className="text-amber-600 ml-1">+{gesamtSaBeantragt}</span>}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Sync-Status */}
        <div className="bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] px-5 py-3 flex justify-between text-sm">
          <span className="text-[#6B7280]">Letzter n8n-Sync</span>
          <span className="font-medium">{latestSyncDatum ?? "Noch keine Synchronisation"}</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN
  // ============================================================
  return (
    <>
      {/* Schulfilter-Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        <button
          onClick={() => setActiveFilter("alle")}
          className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px ${
            activeFilter === "alle" ? "text-[#1A1A1A] font-bold border-b-[3px] border-[#575756]" : "text-[#6B7280] hover:text-[#1A1A1A]"
          }`}
        >
          Alle
        </button>
        {schulen.map((schule) => {
          const isActive = activeFilter === schule.id;
          return (
            <button
              key={schule.id}
              onClick={() => setActiveFilter(schule.id)}
              className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px ${
                isActive ? "text-[#1A1A1A] font-bold" : "text-[#6B7280] hover:text-[#1A1A1A]"
              }`}
              style={{ borderBottom: `3px solid ${isActive ? schule.farbe : "transparent"}` }}
            >
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: schule.farbe }} />
                {schule.kurzname}
              </span>
            </button>
          );
        })}
      </div>

      {/* Schulname bei Einzelansicht */}
      {activeSchule && (
        <div className="flex items-center gap-3 mb-4">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: activeSchule.farbe }} />
          <h2 className="text-lg font-bold text-[#1A1A1A]">{activeSchule.name}</h2>
        </div>
      )}

      {/* Inhalt */}
      {activeFilter === "alle" ? renderAlle() : activeSchule ? renderSchule(activeSchule) : null}

      {/* Hinweis wenn keine Berechnungen */}
      {!hatBerechnung && (
        <div className="mt-4 p-4 bg-[#FEF7CC] border border-[#FBC900] rounded-lg text-sm text-[#575756]">
          <strong>Hinweis:</strong> Es liegen noch keine Berechnungsergebnisse vor.
          Gehen Sie zur Seite &quot;Stellensoll&quot;, um die erste Berechnung durchzufuehren.
        </div>
      )}
    </>
  );
}

// ============================================================
// HELPER: Balken-Zeile
// ============================================================
function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[#575756] w-[200px] flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-[#F3F4F6] rounded-full h-5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-bold tabular-nums text-[#1A1A1A] w-12 text-right">
        {value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
