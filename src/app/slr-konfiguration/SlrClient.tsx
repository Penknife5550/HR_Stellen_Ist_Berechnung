"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { updateSlrWertAction, createSlrWertAction, deleteSlrWertAction } from "./actions";

type SlrWert = {
  id: number;
  schuljahrId: number;
  schulformTyp: string;
  relation: string;
  quelle: string | null;
};

type HistorieEintrag = {
  id: number;
  schulformTyp: string;
  relationAlt: string;
  relationNeu: string;
  quelleAlt: string | null;
  quelleNeu: string | null;
  grund: string | null;
  geaendertVon: string;
  geaendertAm: string;
};

type Props = {
  schuljahre: Array<{ id: number; bezeichnung: string }>;
  slrBySchuljahr: Record<number, SlrWert[]>;
  historieBySchuljahr: Record<number, HistorieEintrag[]>;
  defaultSchuljahrId: number;
};

export function SlrClient({ schuljahre, slrBySchuljahr, historieBySchuljahr, defaultSchuljahrId }: Props) {
  const [selectedSjId, setSelectedSjId] = useState(defaultSchuljahrId);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showHistorie, setShowHistorie] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const slrWerte = slrBySchuljahr[selectedSjId] ?? [];
  const historie = historieBySchuljahr[selectedSjId] ?? [];
  const selectedSj = schuljahre.find((sj) => sj.id === selectedSjId);

  async function handleAction(action: (fd: FormData) => Promise<{ success?: boolean; error?: string; message?: string }>, formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await action(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Gespeichert!" });
      setEditingId(null);
      setShowAdd(false);
      setConfirmDelete(null);
    }
  }

  return (
    <>
      {/* Schuljahr-Auswahl + Aktionen */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[15px] font-medium text-[#1A1A1A]">Schuljahr:</label>
        <select
          value={selectedSjId}
          onChange={(e) => {
            setSelectedSjId(Number(e.target.value));
            setEditingId(null);
            setShowAdd(false);
            setMessage(null);
          }}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px]"
        >
          {schuljahre.map((sj) => (
            <option key={sj.id} value={sj.id}>
              {sj.bezeichnung}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHistorie(!showHistorie)}
          >
            {showHistorie ? "Tabelle anzeigen" : `Historie (${historie.length})`}
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowAdd(true); setEditingId(null); setMessage(null); }}
            disabled={showAdd}
          >
            + Neuen SLR-Wert
          </Button>
        </div>
      </div>

      {/* Meldung */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Neuen Wert hinzufuegen */}
      {showAdd && (
        <Card className="mb-4 border-[#6BAA24]">
          <form action={(fd) => handleAction(createSlrWertAction, fd)}>
            <input type="hidden" name="schuljahrId" value={selectedSjId} />
            <h3 className="text-[15px] font-bold mb-3">Neuen SLR-Wert hinzufuegen</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Schulform-Typ</label>
                <input
                  type="text"
                  name="schulformTyp"
                  placeholder="z.B. Berufskolleg Vollzeit"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Schueler je Stelle</label>
                <input
                  type="text"
                  name="relation"
                  placeholder="z.B. 18,63"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] text-right tabular-nums min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] mb-1">Quelle / Rechtsgrundlage</label>
                <input
                  type="text"
                  name="quelle"
                  placeholder="z.B. § 8 VO zu § 93 Abs. 2 SchulG"
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

      {/* HISTORIE-ANSICHT */}
      {showHistorie ? (
        <Card>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
            Aenderungshistorie — {selectedSj?.bezeichnung}
          </h3>
          {historie.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#575756]">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Datum</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Schulform</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Alt</th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Neu</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Grund</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Von</th>
                </tr>
              </thead>
              <tbody>
                {historie.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <td className="py-3 px-3 text-sm text-[#6B7280] tabular-nums">{h.geaendertAm}</td>
                    <td className="py-3 px-3 text-[15px] font-medium">{h.schulformTyp}</td>
                    <td className="py-3 px-3 text-[15px] text-right tabular-nums text-[#E2001A] line-through">
                      {Number(h.relationAlt).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center text-[#6B7280]">→</td>
                    <td className="py-3 px-3 text-[15px] text-right tabular-nums font-bold text-[#22C55E]">
                      {Number(h.relationNeu).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-sm text-[#575756]">{h.grund ?? "—"}</td>
                    <td className="py-3 px-3 text-sm text-[#6B7280]">{h.geaendertVon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[#6B7280] py-6 text-center text-sm">
              Keine Aenderungen fuer dieses Schuljahr protokolliert.
            </p>
          )}
        </Card>
      ) : (
        /* SLR-TABELLE MIT INLINE-EDITING */
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
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[180px]">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {slrWerte.map((slr, i) => (
                  editingId === slr.id ? (
                    /* EDIT-MODUS */
                    <tr key={slr.id} className="bg-[#FEF7CC]">
                      <td colSpan={4} className="p-4">
                        <form action={(fd) => handleAction(updateSlrWertAction, fd)}>
                          <input type="hidden" name="id" value={slr.id} />
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="col-span-3">
                              <label className="block text-xs font-bold text-[#6B7280] mb-1">Schulform</label>
                              <div className="text-[15px] font-medium py-2">{slr.schulformTyp}</div>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-[#6B7280] mb-1">Neuer Wert</label>
                              <input
                                type="text"
                                name="relation"
                                defaultValue={Number(slr.relation).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                                required
                                className="w-full border border-[#FBC900] rounded px-3 py-2 text-[15px] text-right tabular-nums font-bold min-h-[44px] bg-white"
                                autoFocus
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-bold text-[#6B7280] mb-1">Quelle</label>
                              <input
                                type="text"
                                name="quelle"
                                defaultValue={slr.quelle ?? ""}
                                className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className="block text-xs font-bold text-[#E2001A] mb-1">Aenderungsgrund *</label>
                              <input
                                type="text"
                                name="grund"
                                placeholder="z.B. Bewirtschaftungserlass 2026/27"
                                required
                                className="w-full border border-[#E2001A] rounded px-3 py-2 text-[15px] min-h-[44px]"
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
                    /* ANZEIGE-MODUS */
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
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingId(slr.id); setMessage(null); }}
                          >
                            Bearbeiten
                          </Button>
                          {confirmDelete === slr.id ? (
                            <form action={(fd) => handleAction(deleteSlrWertAction, fd)} className="flex gap-1">
                              <input type="hidden" name="id" value={slr.id} />
                              <Button type="submit" variant="danger" size="sm" disabled={saving}>
                                Ja, loeschen
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                                Nein
                              </Button>
                            </form>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDelete(slr.id)}
                              className="text-[#E2001A] hover:text-[#E2001A]"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[#6B7280] py-8 text-center">
              Fuer das Schuljahr {selectedSj?.bezeichnung} sind keine SLR-Werte hinterlegt.
            </p>
          )}
        </Card>
      )}
    </>
  );
}
