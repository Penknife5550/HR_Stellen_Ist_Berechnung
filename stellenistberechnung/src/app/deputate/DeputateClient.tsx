"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { MONATE_KURZ } from "@/lib/constants";

type LehrerDeputat = {
  lehrerId: number;
  name: string;
  stammschuleCode: string | null;
  stammschuleId: number | null;
  stunden: (number | null)[];
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
}

export function DeputateClient({ lehrerListe, schulen, schulFarben }: DeputateClientProps) {
  const [filterSchule, setFilterSchule] = useState<number | null>(null);

  const gefilterteListe = filterSchule
    ? lehrerListe.filter((l) => l.stammschuleId === filterSchule)
    : lehrerListe;

  return (
    <>
      {/* Schulfilter-Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterSchule(null)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            filterSchule === null
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
              onClick={() => setFilterSchule(s.id)}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-colors text-white"
              style={{
                backgroundColor: filterSchule === s.id ? s.farbe : "#F3F4F6",
                color: filterSchule === s.id ? "white" : "#575756",
              }}
            >
              {s.kurzname} ({count})
            </button>
          );
        })}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold sticky left-0 bg-white min-w-[200px] z-10">
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
                const bgColor = i % 2 === 0 ? "white" : "#F9FAFB";

                return (
                  <tr
                    key={lehrer.lehrerId}
                    className={`border-b border-[#E5E7EB]`}
                    style={{ backgroundColor: bgColor }}
                  >
                    <td
                      className="py-2.5 px-3 font-medium sticky left-0 z-10"
                      style={{ backgroundColor: bgColor }}
                    >
                      {lehrer.name}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {lehrer.stammschuleCode ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                          style={{
                            backgroundColor:
                              schulFarben[lehrer.stammschuleCode] ?? "#575756",
                          }}
                        >
                          {lehrer.stammschuleCode}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF]">—</span>
                      )}
                    </td>
                    {lehrer.stunden.map((std, j) => (
                      <td key={j} className="py-2.5 px-3 text-right tabular-nums">
                        {std !== null && std > 0 ? (
                          std.toFixed(1)
                        ) : (
                          <span className="text-[#D1D5DB]">—</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold bg-[#F3F4F6]">
                      {avg > 0 ? avg.toFixed(1) : "—"}
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
                      {sum > 0 ? sum.toFixed(1) : "—"}
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
                    return totalAll > 0 ? (totalAll / 12).toFixed(1) : "—";
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
      </Card>
    </>
  );
}
