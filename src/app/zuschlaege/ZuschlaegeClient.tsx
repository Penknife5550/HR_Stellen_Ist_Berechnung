"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveZuschlaege } from "./actions";

type ZuschlagArt = { id: number; bezeichnung: string; istStandard: boolean };
type ExistingZuschlag = {
  id: number;
  zuschlagArtId: number;
  wert: string;
  bemerkung: string | null;
  bezeichnung: string;
  istStandard: boolean;
};
type SchuleDaten = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
  zuschlaege: ExistingZuschlag[];
};

type Props = {
  schulen: SchuleDaten[];
  zuschlagArten: ZuschlagArt[];
  haushaltsjahrId: number;
  haushaltsjahrLabel: string;
};

export function ZuschlaegeClient({
  schulen,
  zuschlagArten,
  haushaltsjahrId,
  haushaltsjahrLabel,
}: Props) {
  const [activeSchool, setActiveSchool] = useState(schulen[0]?.kurzname ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const active = schulen.find((s) => s.kurzname === activeSchool);

  const getExistingWert = (zuschlagArtId: number): string => {
    const existing = active?.zuschlaege.find((z) => z.zuschlagArtId === zuschlagArtId);
    return existing ? String(Number(existing.wert)) : "0";
  };

  const getExistingBemerkung = (zuschlagArtId: number): string => {
    const existing = active?.zuschlaege.find((z) => z.zuschlagArtId === zuschlagArtId);
    return existing?.bemerkung ?? "";
  };

  const handleSave = async (formData: FormData) => {
    setSaving(true);
    setMessage(null);
    const result = await saveZuschlaege(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Zuschlaege gespeichert!" });
    }
  };

  // Summe berechnen
  const summe = active?.zuschlaege.reduce((acc, z) => acc + Number(z.wert), 0) ?? 0;

  return (
    <>
      {/* School Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {schulen.map((schule) => {
          const isActive = schule.kurzname === activeSchool;
          return (
            <button
              key={schule.kurzname}
              onClick={() => {
                setActiveSchool(schule.kurzname);
                setMessage(null);
              }}
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

      {active && (
        <Card>
          <form action={handleSave}>
            <input type="hidden" name="schuleId" value={active.id} />
            <input type="hidden" name="haushaltsjahrId" value={haushaltsjahrId} />

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: active.farbe }}
                />
                <h3 className="text-lg font-bold">
                  {active.name} — Haushaltsjahr {haushaltsjahrLabel}
                </h3>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Speichere..." : "Speichern"}
              </Button>
            </div>

            {message && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#575756]">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Zuschlagsart
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[150px]">
                    Stellen
                  </th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Bemerkung
                  </th>
                </tr>
              </thead>
              <tbody>
                {zuschlagArten.map((za, i) => (
                  <tr key={za.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <td className="py-3 px-4 text-[15px]">
                      {za.bezeichnung}
                      {za.istStandard && (
                        <span className="ml-2 text-xs bg-[#575756] text-white px-2 py-0.5 rounded">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <input
                        type="number"
                        step="0.01"
                        name={`zuschlag_${za.id}`}
                        defaultValue={getExistingWert(za.id)}
                        className="w-full text-right tabular-nums border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        name={`bemerkung_${za.id}`}
                        defaultValue={getExistingBemerkung(za.id)}
                        placeholder="Optional"
                        className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#575756]">
                  <td className="py-3 px-4 text-[15px] font-bold">Summe</td>
                  <td
                    className="py-3 px-4 text-right text-lg tabular-nums font-bold"
                    style={{ color: active.farbe }}
                  >
                    {summe.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </form>
        </Card>
      )}
    </>
  );
}
