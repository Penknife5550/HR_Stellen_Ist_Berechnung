"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createLehrerAction, updateLehrerAction, toggleLehrerAktivAction } from "./actions";

type Lehrer = {
  id: number;
  untisTeacherId: number | null;
  personalnummer: string | null;
  vollname: string;
  vorname: string | null;
  nachname: string | null;
  stammschuleId: number | null;
  schuleKurzname: string | null;
  schuleName: string | null;
  schuleFarbe: string | null;
  quelle: string;
  aktiv: boolean;
  deputat: number | null;
};

type Schule = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
};

type Props = {
  lehrer: Lehrer[];
  schulen: Schule[];
};

export function MitarbeiterClient({ lehrer, schulen }: Props) {
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<number | "alle">("alle");
  const [quelleFilter, setQuelleFilter] = useState<"alle" | "untis" | "manuell">("alle");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter logic
  const filtered = lehrer.filter((l) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      l.vollname.toLowerCase().includes(searchLower) ||
      (l.personalnummer && l.personalnummer.toLowerCase().includes(searchLower));
    const matchesSchool = schoolFilter === "alle" || l.stammschuleId === schoolFilter;
    const matchesQuelle = quelleFilter === "alle" || l.quelle === quelleFilter;
    return matchesSearch && matchesSchool && matchesQuelle;
  });

  async function handleAction(
    action: (fd: FormData) => Promise<{ success?: boolean; error?: string; message?: string }>,
    formData: FormData
  ) {
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
    }
  }

  return (
    <>
      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <input
          type="text"
          placeholder="Name oder Personalnummer suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px] w-72"
        />

        {/* School filter */}
        <select
          value={schoolFilter === "alle" ? "alle" : schoolFilter}
          onChange={(e) =>
            setSchoolFilter(e.target.value === "alle" ? "alle" : Number(e.target.value))
          }
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px]"
        >
          <option value="alle">Alle Schulen</option>
          {schulen.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kurzname} - {s.name}
            </option>
          ))}
        </select>

        {/* Quelle filter */}
        <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
          {(["alle", "untis", "manuell"] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQuelleFilter(q)}
              className={`px-4 py-2.5 text-[15px] min-h-[44px] transition-colors ${
                quelleFilter === q
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white text-[#575756] hover:bg-gray-50"
              }`}
            >
              {q === "alle" ? "Alle" : q === "untis" ? "Untis" : "Manuell"}
            </button>
          ))}
        </div>

        {/* Add button */}
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingId(null);
            setMessage(null);
          }}
          className="ml-auto"
        >
          + Neue Lehrkraft
        </Button>

        {/* Count */}
        <span className="text-sm text-[#6B7280]">
          {filtered.length} von {lehrer.length} Lehrkraefte
        </span>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="mb-6 border-green-300 border-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleAction(createLehrerAction, fd);
            }}
          >
            <h3 className="text-[15px] font-semibold text-[#1A1A1A] mb-4">
              Neue Lehrkraft anlegen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#575756] mb-1">Vorname *</label>
                <input
                  name="vorname"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Nachname *</label>
                <input
                  name="nachname"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Personalnummer</label>
                <input
                  name="personalnummer"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Stammschule *</label>
                <select
                  name="stammschuleId"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                >
                  <option value="">Bitte waehlen...</option>
                  {schulen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.kurzname} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Deputat (Wochenstunden)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="45"
                  name="deputat"
                  placeholder="z.B. 28"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px] tabular-nums"
                />
                <span className="text-xs text-[#9CA3AF]">Wird fuer alle 12 Monate uebernommen</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Speichern..." : "Speichern"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAdd(false);
                  setMessage(null);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Personalnr.</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Stammschule</th>
                <th className="text-right py-3 px-4 font-semibold text-[#575756]">Deputat</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Quelle</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-[#575756]">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#6B7280]">
                    Keine Lehrkraefte gefunden.
                  </td>
                </tr>
              )}
              {filtered.map((l, idx) => {
                const isEditing = editingId === l.id;
                const isManuell = l.quelle === "manuell";
                const rowBg = idx % 2 === 1 ? "bg-[#F9FAFB]" : "bg-white";

                if (isEditing && isManuell) {
                  return (
                    <tr key={l.id} className="bg-yellow-50 border-y border-yellow-200">
                      <td colSpan={7} className="py-3 px-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            handleAction(updateLehrerAction, fd);
                          }}
                        >
                          <input type="hidden" name="id" value={l.id} />
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Vorname</label>
                              <input
                                name="vorname"
                                defaultValue={l.vorname ?? ""}
                                required
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Nachname</label>
                              <input
                                name="nachname"
                                defaultValue={l.nachname ?? ""}
                                required
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Personalnr.</label>
                              <input
                                name="personalnummer"
                                defaultValue={l.personalnummer ?? ""}
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Stammschule</label>
                              <select
                                name="stammschuleId"
                                defaultValue={l.stammschuleId ?? ""}
                                required
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              >
                                <option value="">Bitte waehlen...</option>
                                {schulen.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.kurzname}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Deputat (Std.)</label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="45"
                                name="deputat"
                                defaultValue={l.deputat ?? ""}
                                placeholder="z.B. 28"
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px] tabular-nums"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" disabled={saving}>
                                {saving ? "..." : "Speichern"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  setEditingId(null);
                                  setMessage(null);
                                }}
                              >
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={l.id} className={`${rowBg} border-b border-[#E5E7EB] last:border-b-0`}>
                    {/* Name */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#1A1A1A]">{l.vollname}</span>
                    </td>

                    {/* Personalnummer */}
                    <td className="py-3 px-4 text-[#575756]">
                      {l.personalnummer || <span className="text-[#D1D5DB]">-</span>}
                    </td>

                    {/* Stammschule */}
                    <td className="py-3 px-4">
                      {l.schuleKurzname ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: l.schuleFarbe ?? "#6B7280" }}
                          />
                          <span className="text-[#575756]">{l.schuleKurzname}</span>
                        </span>
                      ) : (
                        <span className="text-[#D1D5DB]">-</span>
                      )}
                    </td>

                    {/* Deputat */}
                    <td className="py-3 px-4 text-right tabular-nums">
                      {l.deputat !== null && l.deputat > 0 ? (
                        <span className="font-bold">{l.deputat.toLocaleString("de-DE", { minimumFractionDigits: 1 })}</span>
                      ) : (
                        <span className="text-[#D1D5DB]">{"\u2014"}</span>
                      )}
                    </td>

                    {/* Quelle */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          l.quelle === "untis"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {l.quelle === "untis" ? "Untis" : "Manuell"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            l.aktiv ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-sm text-[#575756]">
                          {l.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isManuell ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(l.id);
                                setShowAdd(false);
                                setMessage(null);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => {
                                const fd = new FormData();
                                fd.set("id", String(l.id));
                                fd.set("aktiv", String(!l.aktiv));
                                handleAction(toggleLehrerAktivAction, fd);
                              }}
                              className={`text-sm hover:underline ${
                                l.aktiv
                                  ? "text-red-600 hover:text-red-800"
                                  : "text-green-600 hover:text-green-800"
                              }`}
                            >
                              {l.aktiv ? "Deaktivieren" : "Aktivieren"}
                            </button>
                          </>
                        ) : (
                          <span
                            className="text-xs text-[#D1D5DB] cursor-default"
                            title="Wird aus Untis synchronisiert"
                          >
                            Untis-Sync
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
