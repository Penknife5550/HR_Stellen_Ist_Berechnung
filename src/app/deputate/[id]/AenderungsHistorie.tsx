"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MONATE_KURZ } from "@/lib/constants";
import { korrigiereDatumAction } from "../actions";

type Aenderung = {
  id: number;
  monat: number;
  aenderungstyp: string;
  istGehaltsrelevant: boolean;
  deputatGesamtAlt: string | null;
  deputatGesamtNeu: string | null;
  deputatGesAlt: string | null;
  deputatGesNeu: string | null;
  deputatGymAlt: string | null;
  deputatGymNeu: string | null;
  deputatBkAlt: string | null;
  deputatBkNeu: string | null;
  termIdAlt: number | null;
  termIdNeu: number | null;
  geaendertAm: string; // serialisiert
  tatsaechlichesDatum: string | null;
  datumKorrigiertVon: string | null;
};

export function AenderungsHistorie({ aenderungen }: { aenderungen: Aenderung[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await korrigiereDatumAction(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Gespeichert." });
      setEditingId(null);
    }
  }

  if (aenderungen.length === 0) {
    return (
      <Card className="mb-6">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Aenderungshistorie</h3>
        <p className="text-[#6B7280] py-6 text-center text-sm">
          Keine Aenderungen fuer diese Lehrkraft im aktuellen Haushaltsjahr protokolliert.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">
        Aenderungshistorie
        <span className="ml-2 text-sm font-normal text-[#6B7280]">
          ({aenderungen.length} Eintraege)
        </span>
      </h3>

      <p className="text-sm text-[#6B7280] mb-4">
        <strong>Hinweis:</strong> Untis erlaubt Aenderungen nur zum Montag.
        Korrigieren Sie das <strong>tatsaechliche Aenderungsdatum</strong> in der Spalte
        &quot;Tats. Datum&quot; fuer die tagegenaue Dokumentation
        (§ 3 Abs. 1 FESchVO).
      </p>

      {message && (
        <div className={`mb-3 p-2.5 rounded text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#575756]">
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Sync-Datum</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#E2001A] font-bold">Tats. Datum</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Monat</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Typ</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Gesamt alt</th>
              <th className="text-center py-2 px-3" />
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Gesamt neu</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">GES</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">GYM</th>
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">BK</th>
              <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Periode</th>
            </tr>
          </thead>
          <tbody>
            {aenderungen.map((a, i) => {
              const isGehalt = a.istGehaltsrelevant;
              const isEditing = editingId === a.id;

              return (
                <tr
                  key={a.id}
                  className={`border-b border-[#E5E7EB] ${isGehalt ? "bg-red-50" : i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}`}
                >
                  {/* Sync-Datum (automatisch, nicht editierbar) */}
                  <td className="py-2.5 px-3 text-[#9CA3AF] tabular-nums text-xs">
                    {a.geaendertAm}
                  </td>

                  {/* Tatsaechliches Datum (editierbar!) */}
                  <td className="py-1.5 px-3">
                    {isEditing ? (
                      <form action={handleSave} className="flex items-center gap-1">
                        <input type="hidden" name="aenderungId" value={a.id} />
                        <input
                          type="date"
                          name="tatsaechlichesDatum"
                          defaultValue={a.tatsaechlichesDatum ?? ""}
                          required
                          autoFocus
                          className="border border-[#E2001A] rounded px-2 py-1 text-sm tabular-nums w-[130px] min-h-[36px]"
                        />
                        <Button type="submit" size="sm" disabled={saving}>
                          {saving ? "..." : "OK"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          ×
                        </Button>
                      </form>
                    ) : (
                      <button
                        onClick={() => { setEditingId(a.id); setMessage(null); }}
                        className="flex items-center gap-1 group"
                        title="Tatsaechliches Datum korrigieren"
                      >
                        {a.tatsaechlichesDatum ? (
                          <span className="tabular-nums font-medium text-[#1A1A1A]">
                            {new Date(a.tatsaechlichesDatum + "T00:00:00").toLocaleDateString("de-DE")}
                          </span>
                        ) : (
                          <span className="text-[#E2001A] font-medium">
                            Datum setzen
                          </span>
                        )}
                        <span className="text-[#9CA3AF] group-hover:text-[#575756] transition-colors text-xs">
                          ✎
                        </span>
                      </button>
                    )}
                    {a.datumKorrigiertVon && !isEditing && (
                      <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                        von {a.datumKorrigiertVon}
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 font-medium">{MONATE_KURZ[a.monat - 1]}</td>
                  <td className="py-2.5 px-3">
                    {isGehalt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#E2001A] text-white">
                        Gehaltsrelevant
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF7CC] text-[#575756]">
                        Verteilung
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums line-through text-[#E2001A]">
                    {Number(a.deputatGesamtAlt).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-center text-[#6B7280]">→</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#22C55E]">
                    {Number(a.deputatGesamtNeu).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-xs tabular-nums">
                    {Number(a.deputatGesAlt).toFixed(1)}→{Number(a.deputatGesNeu).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-xs tabular-nums">
                    {Number(a.deputatGymAlt).toFixed(1)}→{Number(a.deputatGymNeu).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-xs tabular-nums">
                    {Number(a.deputatBkAlt).toFixed(1)}→{Number(a.deputatBkNeu).toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-center text-xs text-[#6B7280] tabular-nums">
                    {a.termIdAlt}→{a.termIdNeu}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
