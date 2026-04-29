"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MONATE_KURZ } from "@/lib/constants";

type MonatDetail = {
  gesamt: number;
  ges: number;
  gym: number;
  bk: number;
};

type LehrerDeputat = {
  lehrerId: number;
  name: string;
  stammschuleCode: string | null;
  stammschuleId: number | null;
  stunden: (number | null)[];
  monatsDetails: (MonatDetail | null)[];
  hatGehaltsaenderung?: boolean;
  hatVerteilungsaenderung?: boolean;
  /** Array[12]: true wenn Monat i taggenau korrigiert wurde */
  taggenauKorrektur?: boolean[];
};

type Schule = {
  id: number;
  kurzname: string;
  farbe: string;
};

interface DeputateClientProps {
  lehrerListe: LehrerDeputat[];
  schulen: Schule[];
  schulFarben: Record<string, string>;
  anzahlGehaltsaenderungen: number;
}

// Helle Hintergrundfarben brauchen dunklen Text fuer ausreichenden Kontrast
const needsDarkText = (color: string) => ['#FBC900', '#FEF7CC'].includes(color.toUpperCase());

type FilterTyp = "alle" | "gehaltsaenderung" | number;

export function DeputateClient({
  lehrerListe,
  schulen,
  schulFarben,
  anzahlGehaltsaenderungen,
}: DeputateClientProps) {
  const [filter, setFilter] = useState<FilterTyp>("alle");

  const gefilterteListe = (() => {
    if (filter === "gehaltsaenderung") {
      return lehrerListe.filter((l) => l.hatGehaltsaenderung);
    }
    if (typeof filter === "number") {
      return lehrerListe.filter((l) => l.stammschuleId === filter);
    }
    return lehrerListe;
  })();

  // Aktuellste schulspezifische Deputate pro Lehrer (letzter Monat mit Daten)
  function getAktuelleVerteilung(lehrer: LehrerDeputat): MonatDetail | null {
    for (let i = 11; i >= 0; i--) {
      if (lehrer.monatsDetails[i]) return lehrer.monatsDetails[i];
    }
    return null;
  }

  // Schulkuerzel fuer Fremdschulen (nicht Stammschule)
  function getFremdschulen(lehrer: LehrerDeputat): string[] {
    const v = getAktuelleVerteilung(lehrer);
    if (!v) return [];
    const stamm = lehrer.stammschuleCode?.toUpperCase();
    const result: string[] = [];
    if (v.ges > 0 && stamm !== "GES") result.push(`GES ${v.ges}`);
    if (v.gym > 0 && stamm !== "GYM") result.push(`GYM ${v.gym}`);
    if (v.bk > 0 && stamm !== "BK") result.push(`BK ${v.bk}`);
    return result;
  }

  function getStammDeputat(lehrer: LehrerDeputat): number {
    const v = getAktuelleVerteilung(lehrer);
    if (!v) return 0;
    const stamm = lehrer.stammschuleCode?.toUpperCase();
    if (stamm === "GES") return v.ges;
    if (stamm === "GYM") return v.gym;
    if (stamm === "BK") return v.bk;
    return v.gesamt;
  }

  /**
   * Prueft ob Untis-Gesamtdeputat von der Summe der Einzelwerte abweicht.
   * Abweichung > 0.01 = nicht zugeordnete Stunden in Untis.
   */
  function getDeputatAbweichung(detail: MonatDetail | null): number | null {
    if (!detail) return null;
    const summeEinzel = detail.ges + detail.gym + detail.bk;
    const diff = Math.abs(detail.gesamt - summeEinzel);
    if (diff > 0.01) return detail.gesamt - summeEinzel;
    return null;
  }

  return (
    <>
      {/* Filter-Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap" role="tablist">
        <button
          role="tab"
          aria-selected={filter === "alle"}
          aria-controls="deputate-panel"
          onClick={() => setFilter("alle")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            filter === "alle"
              ? "bg-[#575756] text-white"
              : "bg-[#F3F4F6] text-[#575756] hover:bg-[#E5E7EB]"
          }`}
        >
          Alle ({lehrerListe.length})
        </button>
        {schulen.map((s) => {
          const count = lehrerListe.filter((l) => l.stammschuleId === s.id).length;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={filter === s.id}
              aria-controls="deputate-panel"
              onClick={() => setFilter(s.id)}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              style={{
                backgroundColor: filter === s.id ? s.farbe : "#F3F4F6",
                color: filter === s.id ? (needsDarkText(s.farbe) ? "#1A1A1A" : "white") : "#575756",
              }}
            >
              {s.kurzname} ({count})
            </button>
          );
        })}

        {/* Gehaltsaenderungen-Filter */}
        {anzahlGehaltsaenderungen > 0 && (
          <button
            role="tab"
            aria-selected={filter === "gehaltsaenderung"}
            aria-controls="deputate-panel"
            onClick={() => setFilter("gehaltsaenderung")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${
              filter === "gehaltsaenderung"
                ? "bg-[#E2001A] text-white"
                : "bg-red-50 text-[#E2001A] border-2 border-[#E2001A] hover:bg-red-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            Gehaltsaenderungen ({anzahlGehaltsaenderungen})
          </button>
        )}
      </div>

      <div id="deputate-panel" role="tabpanel"><Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold sticky left-0 bg-white min-w-[280px] z-10">
                  Lehrkraft
                </th>
                <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[60px]">
                  Schule
                </th>
                {MONATE_KURZ.map((m) => (
                  <th
                    key={m}
                    className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[65px]"
                  >
                    {m}
                  </th>
                ))}
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[65px] bg-[#F3F4F6]">
                  Ø
                </th>
              </tr>
            </thead>
            <tbody>
              {gefilterteListe.map((lehrer, i) => {
                const filled = lehrer.stunden.filter((s): s is number => s !== null && s > 0);
                const avg = filled.length > 0 ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;
                const bgColor = lehrer.hatGehaltsaenderung
                  ? "#FEF2F2"
                  : i % 2 === 0
                    ? "white"
                    : "#F9FAFB";

                const stammDep = getStammDeputat(lehrer);
                const hatAbweichung = lehrer.monatsDetails.some((d) => getDeputatAbweichung(d) !== null);
                const fremd = getFremdschulen(lehrer);

                return (
                  <tr
                    key={lehrer.lehrerId}
                    className="border-b border-[#E5E7EB]"
                    style={{ backgroundColor: bgColor }}
                  >
                    <td
                      className="py-2.5 px-3 sticky left-0 z-10"
                      style={{ backgroundColor: bgColor }}
                    >
                      <div className="flex items-center gap-1.5">
                        {lehrer.hatGehaltsaenderung && (
                          <span className="w-2 h-2 rounded-full bg-[#E2001A] flex-shrink-0" title="Gehaltsrelevante Aenderung" />
                        )}
                        {lehrer.hatVerteilungsaenderung && !lehrer.hatGehaltsaenderung && (
                          <span className="w-2 h-2 rounded-full bg-[#FBC900] flex-shrink-0" title="Verteilungsaenderung" />
                        )}
                        {hatAbweichung && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Untis-Gesamt weicht von Summe der Schuldeputate ab — nicht zugeordnete Stunden in Untis" />
                        )}
                        <a
                          href={`/deputate/${lehrer.lehrerId}`}
                          className="font-medium hover:text-[#009AC6] hover:underline transition-colors"
                        >
                          {lehrer.name}
                        </a>
                        {/* Aktuelle Deputat-Info */}
                        <span className="text-xs text-[#6B7280] ml-1">
                          ({stammDep > 0 ? stammDep.toFixed(2) : "—"}
                          {fremd.length > 0 && (
                            <span className="text-[#9CA3AF]">
                              {" + "}
                              {fremd.join(", ")}
                            </span>
                          )}
                          )
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {lehrer.stammschuleCode ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                          style={{
                            backgroundColor:
                              schulFarben[lehrer.stammschuleCode] ?? "#575756",
                            color: needsDarkText(schulFarben[lehrer.stammschuleCode] ?? "#575756") ? "#1A1A1A" : "white",
                          }}
                        >
                          {lehrer.stammschuleCode}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">—</span>
                      )}
                    </td>
                    {lehrer.stunden.map((std, j) => {
                      const abw = getDeputatAbweichung(lehrer.monatsDetails[j]);
                      const korr = lehrer.taggenauKorrektur?.[j] ?? false;
                      return (
                        <td
                          key={j}
                          className={`py-2.5 px-3 text-right tabular-nums ${abw !== null ? "bg-amber-50" : ""} ${korr ? "text-[#E2001A] font-semibold" : ""}`}
                          title={korr ? "Taggenau korrigiert (siehe Detailseite fuer Herleitung)" : undefined}
                        >
                          {std !== null && std > 0 ? (
                            <span className="inline-flex items-center gap-0.5 justify-end">
                              {std.toFixed(2)}
                              {korr && <sup className="text-[10px] text-[#E2001A]">*</sup>}
                              {abw !== null && (
                                <span
                                  className="text-amber-600 cursor-help text-xs"
                                  title={`Untis-Gesamt (${lehrer.monatsDetails[j]!.gesamt}) weicht von Summe der Schulen ab (${(lehrer.monatsDetails[j]!.ges + lehrer.monatsDetails[j]!.gym + lehrer.monatsDetails[j]!.bk).toFixed(2)}). ${Math.abs(abw).toFixed(2)} Std. nicht zugeordnet.`}
                                >
                                  !
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[#D1D5DB]">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold bg-[#F3F4F6]">
                      {avg > 0 ? avg.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#575756] bg-[#F3F4F6]">
                <td className="py-3 px-3 font-bold" colSpan={2}>
                  Summe Wochenstunden
                </td>
                {Array.from({ length: 12 }, (_, j) => {
                  const sum = gefilterteListe.reduce(
                    (acc, l) => acc + (l.stunden[j] ?? 0),
                    0
                  );
                  return (
                    <td
                      key={j}
                      className="py-3 px-3 text-right tabular-nums font-bold"
                    >
                      {sum > 0 ? sum.toFixed(2) : "—"}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right tabular-nums font-bold bg-[#E5E7EB]">
                  {(() => {
                    const totalAll = gefilterteListe.reduce(
                      (acc, l) =>
                        acc + l.stunden.reduce<number>((a, b) => a + (b ?? 0), 0),
                      0
                    );
                    return totalAll > 0 ? (totalAll / 12).toFixed(2) : "—";
                  })()}
                </td>
              </tr>
              <tr className="bg-[#E5E7EB]">
                <td className="py-3 px-3 font-bold" colSpan={2}>
                  Anzahl Lehrkraefte
                </td>
                {Array.from({ length: 12 }, (_, j) => {
                  const count = gefilterteListe.filter(
                    (l) => l.stunden[j] !== null && l.stunden[j]! > 0
                  ).length;
                  return (
                    <td
                      key={j}
                      className="py-3 px-3 text-right tabular-nums font-bold"
                    >
                      {count > 0 ? count : "—"}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right tabular-nums font-bold bg-[#D1D5DB]">
                  {gefilterteListe.length}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card></div>
    </>
  );
}
