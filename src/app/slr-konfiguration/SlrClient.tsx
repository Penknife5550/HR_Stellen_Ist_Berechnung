"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

type SlrWert = {
  id: number;
  schuljahrId: number;
  schulformTyp: string;
  relation: string;
  quelle: string | null;
};

type Props = {
  schuljahre: Array<{ id: number; bezeichnung: string }>;
  slrBySchuljahr: Record<number, SlrWert[]>;
  defaultSchuljahrId: number;
};

export function SlrClient({ schuljahre, slrBySchuljahr, defaultSchuljahrId }: Props) {
  const [selectedSjId, setSelectedSjId] = useState(defaultSchuljahrId);

  const slrWerte = slrBySchuljahr[selectedSjId] ?? [];
  const selectedSj = schuljahre.find((sj) => sj.id === selectedSjId);

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[15px] font-medium text-[#1A1A1A]">Schuljahr:</label>
        <select
          value={selectedSjId}
          onChange={(e) => setSelectedSjId(Number(e.target.value))}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px]"
        >
          {schuljahre.map((sj) => (
            <option key={sj.id} value={sj.id}>
              {sj.bezeichnung}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {slrWerte.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schulform-Typ
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schueler je Stelle
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Quelle
                </th>
              </tr>
            </thead>
            <tbody>
              {slrWerte.map((slr, i) => (
                <tr key={slr.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                  <td className="py-3 px-4 text-[15px] font-medium">{slr.schulformTyp}</td>
                  <td className="py-3 px-4 text-[15px] text-right tabular-nums font-bold">
                    {Number(slr.relation).toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#6B7280]">
                    {slr.quelle ?? `VO zu § 93 Abs. 2 SchulG ${selectedSj?.bezeichnung}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[#6B7280] py-8 text-center">
            Fuer das Schuljahr {selectedSj?.bezeichnung} sind keine SLR-Werte hinterlegt.
          </p>
        )}
      </Card>
    </>
  );
}
