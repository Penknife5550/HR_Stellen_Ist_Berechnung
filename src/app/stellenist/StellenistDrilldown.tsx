"use client";

/**
 * Inline-Drilldown unter einer Stellenist-Karte. Zeigt pro Lehrer die
 * tagesgenauen Wochenstunden je Monat im gewaehlten Zeitraum, plus
 * separater Block fuer Mehrarbeit. Lazy-Load: erst beim Aufklappen.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getStellenistDrilldownAction } from "./actions";

const MONATE_KURZ = ["", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

type DrilldownData = {
  schuleKurzname: string;
  zeitraum: "aug-dez" | "jan-jul";
  monate: number[];
  regeldeputat: number;
  lehrer: Array<{
    lehrerId: number;
    vollname: string;
    stammschuleCode: string | null;
    stundenProMonat: Record<number, number>;
    korrekturMonate: number[];
    summeStunden: number;
    durchschnittWS: number;
    stellenAnteil: number;
  }>;
  mehrarbeitLehrer: Array<{
    lehrerId: number;
    vollname: string;
    summeStunden: number;
    stellenAnteil: number;
  }>;
  mehrarbeitSchuleStellen: number;
  summen: {
    stunden: number;
    durchschnittWS: number;
    stellenAusStunden: number;
    mehrarbeitStellen: number;
    gesamt: number;
  };
};

function fmt(n: number, dec = 2): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.001) return "—";
  return n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function StellenistDrilldown({
  schuleKurzname,
  haushaltsjahrId,
  zeitraum,
  open,
}: {
  schuleKurzname: string;
  haushaltsjahrId: number;
  zeitraum: "aug-dez" | "jan-jul";
  open: boolean;
}) {
  const [data, setData] = useState<DrilldownData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [requested, setRequested] = useState(false);

  // Lazy-Load: beim ersten Oeffnen Daten holen.
  // useEffect statt Render-Side-Effect — verhindert Doppel-Calls unter
  // StrictMode/Concurrent Rendering.
  useEffect(() => {
    if (!open || requested) return;
    setRequested(true);
    startTransition(async () => {
      const res = await getStellenistDrilldownAction(schuleKurzname, haushaltsjahrId, zeitraum);
      if ("error" in res) {
        setError(res.error ?? "Fehler beim Laden.");
      } else if (res.data) {
        setData(res.data as DrilldownData);
      }
    });
  }, [open, requested, schuleKurzname, haushaltsjahrId, zeitraum]);

  if (!open) return null;

  if (pending && !data) {
    return (
      <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] p-6 text-sm text-[#6B7280] italic">
        Lade Drilldown…
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-t border-[#E5E7EB] bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const exportHref = `/api/export/stellenist-drilldown?schule=${encodeURIComponent(
    schuleKurzname,
  )}&hj=${haushaltsjahrId}&zeitraum=${zeitraum}`;

  return (
    <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] p-4 lg:p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-[15px] text-[#1A1A1A]">
          Drilldown — {schuleKurzname} · {zeitraum === "aug-dez" ? "Aug–Dez" : "Jan–Jul"}
          <span className="ml-2 text-xs font-normal text-[#6B7280]">
            tagesgenau aus v_deputat_monat_tagesgenau
          </span>
        </h4>
        <a
          href={exportHref}
          download
          className="text-xs px-3 py-1.5 rounded border border-[#D1D5DB] bg-white text-[#1A1A1A] hover:bg-[#F3F4F6] inline-flex items-center gap-1"
        >
          <span>⬇</span> CSV exportieren
        </a>
      </div>

      {/* === Lehrer-Tabelle === */}
      {data.lehrer.length === 0 ? (
        <p className="text-sm text-[#6B7280] italic">
          Keine Lehrer mit positiven Wochenstunden in diesem Zeitraum.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#575756] text-xs uppercase tracking-wider text-[#575756]">
                <th className="text-left py-2 px-3">Lehrer</th>
                <th className="text-left py-2 px-3">Stamm</th>
                {data.monate.map((m) => (
                  <th key={m} className="text-right py-2 px-2 font-mono">
                    {MONATE_KURZ[m]}
                  </th>
                ))}
                <th className="text-right py-2 px-3">Σ WS</th>
                <th className="text-right py-2 px-3">⌀ WS</th>
                <th className="text-right py-2 px-3">Stellen</th>
                <th className="text-center py-2 px-2 w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {data.lehrer.map((l) => {
                const istKorrektur = l.korrekturMonate.length > 0;
                return (
                  <tr
                    key={l.lehrerId}
                    className={`border-b border-[#E5E7EB] hover:bg-white ${
                      istKorrektur ? "bg-[#FEF9E7]" : ""
                    }`}
                    title={
                      istKorrektur
                        ? `Tagesgenau-Korrektur in Monat(en): ${l.korrekturMonate
                            .map((m) => MONATE_KURZ[m])
                            .join(", ")}`
                        : undefined
                    }
                  >
                    <td className="py-2 px-3">
                      <Link
                        href={`/deputate/${l.lehrerId}`}
                        className="text-[#1A1A1A] hover:text-[#009AC6] hover:underline"
                      >
                        {l.vollname}
                      </Link>
                    </td>
                    <td className="py-2 px-3">
                      {l.stammschuleCode && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-[#E5E7EB] text-[#374151] text-[10px] font-bold">
                          {l.stammschuleCode}
                        </span>
                      )}
                    </td>
                    {data.monate.map((m) => {
                      const v = l.stundenProMonat[m] ?? 0;
                      const istKorrekturMonat = l.korrekturMonate.includes(m);
                      return (
                        <td
                          key={m}
                          className={`py-2 px-2 text-right tabular-nums font-mono text-xs ${
                            istKorrekturMonat ? "text-[#92400E] font-semibold" : ""
                          }`}
                        >
                          {v > 0 ? fmt(v) : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right tabular-nums font-bold">
                      {fmt(l.summeStunden)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmt(l.durchschnittWS)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmt(l.stellenAnteil, 4)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Link
                        href={`/deputate/${l.lehrerId}`}
                        className="text-[#9CA3AF] hover:text-[#009AC6]"
                        aria-label="Lehrer-Detailseite"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {/* Summenzeile Wochenstunden */}
              <tr className="border-t-2 border-[#575756] bg-[#F3F4F6] font-bold">
                <td colSpan={2} className="py-2 px-3 text-[#1A1A1A]">
                  Σ Wochenstunden ({data.lehrer.length} Lehrer)
                </td>
                {data.monate.map((m) => {
                  const monatsSumme = data.lehrer.reduce(
                    (acc, l) => acc + (l.stundenProMonat[m] ?? 0),
                    0,
                  );
                  return (
                    <td
                      key={m}
                      className="py-2 px-2 text-right tabular-nums font-mono text-xs"
                    >
                      {fmt(monatsSumme)}
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-right tabular-nums">
                  {fmt(data.summen.stunden)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {fmt(data.summen.durchschnittWS)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {fmt(data.summen.stellenAusStunden, 4)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* === Mehrarbeit-Block === */}
      {(data.mehrarbeitLehrer.length > 0 || data.mehrarbeitSchuleStellen > 0) && (
        <div className="mt-5">
          <h5 className="font-bold text-[14px] text-[#1A1A1A] mb-2">
            Mehrarbeit (zusätzlich zur regulären Stellenbesetzung)
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#575756] text-xs uppercase tracking-wider text-[#575756]">
                  <th className="text-left py-2 px-3">Quelle</th>
                  <th className="text-right py-2 px-3">Σ Stunden</th>
                  <th className="text-right py-2 px-3">Stellen-Anteil</th>
                </tr>
              </thead>
              <tbody>
                {data.mehrarbeitLehrer.map((m) => (
                  <tr key={m.lehrerId} className="border-b border-[#E5E7EB]">
                    <td className="py-2 px-3">
                      <Link
                        href={`/deputate/${m.lehrerId}`}
                        className="text-[#1A1A1A] hover:text-[#009AC6] hover:underline"
                      >
                        {m.vollname}
                      </Link>
                      <span className="ml-2 text-xs text-[#6B7280]">(lehrer-bezogen)</span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmt(m.summeStunden)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmt(m.stellenAnteil, 4)}
                    </td>
                  </tr>
                ))}
                {data.mehrarbeitSchuleStellen > 0 && (
                  <tr className="border-b border-[#E5E7EB]">
                    <td className="py-2 px-3 text-[#6B7280]">
                      Schulweite Mehrarbeit (ohne Lehrer)
                    </td>
                    <td className="py-2 px-3 text-right text-[#9CA3AF]">—</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmt(data.mehrarbeitSchuleStellen, 4)}
                    </td>
                  </tr>
                )}
                <tr className="bg-[#F3F4F6] font-bold">
                  <td className="py-2 px-3 text-[#1A1A1A]">Σ Mehrarbeit-Stellen</td>
                  <td></td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {fmt(data.summen.mehrarbeitStellen, 4)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Gesamt-Summe === */}
      <div className="mt-5 pt-3 border-t-2 border-[#575756] flex items-center justify-between">
        <span className="font-bold text-[#1A1A1A]">
          Gesamt-Stellen (Wochenstunden + Mehrarbeit)
        </span>
        <span className="text-xl font-bold tabular-nums text-[#1A1A1A]">
          {fmt(data.summen.gesamt, 4)}
        </span>
      </div>
      <p className="text-xs text-[#6B7280] mt-2">
        Berechnung: ⌀ Wochenstunden / Regelstundendeputat ({data.regeldeputat}) ÷ {data.monate.length}{" "}
        Monate. Tagesgenaue Werte aus v_deputat_monat_tagesgenau (Periodenmodell v0.7).
      </p>
    </div>
  );
}
