"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SCHULFORM_CONFIG } from "@/lib/constants";
import { updateRegeldeputatAction, createRegeldeputatAction } from "./actions";

type RegeldeputatRow = {
  id: number;
  schulformCode: string;
  schulformName: string;
  regeldeputat: string;
  rechtsgrundlage: string | null;
  bassFundstelle: string | null;
  gueltigAb: string | null;
  bemerkung: string | null;
};

type Props = {
  regeldeputate: RegeldeputatRow[];
};

export function RegeldeputateClient({ regeldeputate }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleAction(
    action: (fd: FormData) => Promise<{ success?: boolean; error?: string; message?: string }>,
    formData: FormData
  ) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await action(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: result.message ?? "Gespeichert!" });
        setEditingId(null);
        setShowAdd(false);
      }
    } catch {
      setMessage({ type: "error", text: "Netzwerkfehler. Bitte erneut versuchen." });
    } finally {
      setSaving(false);
    }
  }

  function getSchulfarbe(code: string): string {
    const config = SCHULFORM_CONFIG[code as keyof typeof SCHULFORM_CONFIG];
    return config?.farbe ?? "#575756";
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <div className="text-[15px] text-[#6B7280]">
          {regeldeputate.length} Schulform{regeldeputate.length !== 1 ? "en" : ""} konfiguriert
        </div>
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => { setShowAdd(true); setEditingId(null); setMessage(null); }}
            disabled={showAdd}
          >
            + Neue Schulform
          </Button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {showAdd && (
        <Card className="mb-4 border-[#6BAA24]">
          <form action={(fd) => handleAction(createRegeldeputatAction, fd)}>
            <h3 className="text-[15px] font-bold mb-3">Neues Regeldeputat hinzufuegen</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Schulform-Code</label>
                <input
                  type="text"
                  name="schulformCode"
                  placeholder="z.B. GES"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Schulform-Name</label>
                <input
                  type="text"
                  name="schulformName"
                  placeholder="z.B. Gesamtschule"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Regeldeputat (Std/Woche)</label>
                <input
                  type="text"
                  name="regeldeputat"
                  placeholder="z.B. 25,5"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] text-right tabular-nums min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Rechtsgrundlage</label>
                <input
                  type="text"
                  name="rechtsgrundlage"
                  placeholder="§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">BASS-Fundstelle</label>
                <input
                  type="text"
                  name="bassFundstelle"
                  placeholder="BASS 11-11 Nr. 1"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Gueltig ab</label>
                <input
                  type="date"
                  name="gueltigAb"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Bemerkung</label>
                <input
                  type="text"
                  name="bemerkung"
                  placeholder="z.B. Rundungsregel beachten"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Speichere..." : "Hinzufuegen"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {regeldeputate.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schulform
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Regeldeputat (Std/Wo)
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Rechtsgrundlage
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  BASS
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Bemerkung
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[120px]">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody>
              {regeldeputate.map((r, i) =>
                editingId === r.id ? (
                  <tr key={r.id} className="bg-[#FEF7CC]">
                    <td colSpan={6} className="p-4">
                      <form action={(fd) => handleAction(updateRegeldeputatAction, fd)}>
                        <input type="hidden" name="id" value={r.id} />
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="col-span-3">
                            <label className="block text-xs font-bold text-[#6B7280] mb-1">Schulform</label>
                            <div className="text-[15px] font-medium py-2 flex items-center gap-2">
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{ backgroundColor: getSchulfarbe(r.schulformCode) }}
                              />
                              {r.schulformName} ({r.schulformCode})
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-[#6B7280] mb-1">Regeldeputat (Std/Wo)</label>
                            <input
                              type="text"
                              name="regeldeputat"
                              defaultValue={Number(r.regeldeputat).toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                              required
                              className="w-full border border-[#FBC900] rounded px-3 py-2 text-[15px] text-right tabular-nums font-bold min-h-[44px] bg-white"
                              autoFocus
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="block text-xs font-bold text-[#6B7280] mb-1">Rechtsgrundlage</label>
                            <input
                              type="text"
                              name="rechtsgrundlage"
                              defaultValue={r.rechtsgrundlage ?? ""}
                              className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-[#6B7280] mb-1">BASS</label>
                            <input
                              type="text"
                              name="bassFundstelle"
                              defaultValue={r.bassFundstelle ?? ""}
                              className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-[#6B7280] mb-1">Bemerkung</label>
                            <input
                              type="text"
                              name="bemerkung"
                              defaultValue={r.bemerkung ?? ""}
                              className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-12 gap-3 mt-3">
                          <div className="col-span-3">
                            <label className="block text-xs font-bold text-[#6B7280] mb-1">Gueltig ab</label>
                            <input
                              type="date"
                              name="gueltigAb"
                              defaultValue={r.gueltigAb ?? ""}
                              className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button type="submit" size="sm" disabled={saving}>
                            {saving ? "Speichere..." : "Speichern"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            Abbrechen
                          </Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <td className="py-3 px-4 text-[15px] font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: getSchulfarbe(r.schulformCode) }}
                        />
                        <span>{r.schulformName}</span>
                        <span className="text-xs text-[#6B7280]">({r.schulformCode})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[15px] text-right tabular-nums font-bold">
                      {Number(r.regeldeputat).toLocaleString("de-DE", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#6B7280]">
                      {r.rechtsgrundlage ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#6B7280]">
                      {r.bassFundstelle ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#6B7280]">
                      {r.bemerkung ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingId(r.id); setMessage(null); }}
                      >
                        Bearbeiten
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        ) : (
          <p className="text-[#6B7280] py-8 text-center">
            Keine Regeldeputate konfiguriert. Bitte fuegen Sie die Schulformen hinzu.
          </p>
        )}
      </Card>
    </>
  );
}
