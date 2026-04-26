"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Check } from "lucide-react";
import {
  createStatistikCodeAction,
  updateStatistikCodeAction,
  toggleStatistikCodeAktivAction,
} from "./actions";

interface StatistikCode {
  id: number;
  code: string;
  bezeichnung: string;
  gruppe: string;
  istTeilzeit: boolean;
  sortierung: number;
  aktiv: boolean;
  bemerkung: string | null;
  anzahlLehrer: number;
}

interface Props {
  codes: StatistikCode[];
}

const GRUPPE_LABEL: Record<string, string> = {
  beamter: "Beamte",
  angestellter: "Angestellte",
  sonstiges: "Sonstiges",
};

const GRUPPE_BADGE: Record<string, string> = {
  beamter: "bg-[#E0F2FB] text-[#005C7A] border-[#009AC6]/30",
  angestellter: "bg-[#FEF7CC] text-[#78580A] border-[#FBC900]/40",
  sonstiges: "bg-gray-100 text-gray-700 border-gray-200",
};

export function StatistikCodesClient({ codes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [addForm, setAddForm] = useState({
    code: "",
    bezeichnung: "",
    gruppe: "beamter",
    istTeilzeit: false,
    sortierung: 0,
    bemerkung: "",
  });

  const [editForm, setEditForm] = useState({
    bezeichnung: "",
    gruppe: "beamter",
    istTeilzeit: false,
    sortierung: 0,
    bemerkung: "",
  });

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreate = () => {
    const fd = new FormData();
    fd.set("code", addForm.code);
    fd.set("bezeichnung", addForm.bezeichnung);
    fd.set("gruppe", addForm.gruppe);
    fd.set("istTeilzeit", String(addForm.istTeilzeit));
    fd.set("sortierung", String(addForm.sortierung));
    fd.set("bemerkung", addForm.bemerkung);

    startTransition(async () => {
      const result = await createStatistikCodeAction(fd);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", result.message ?? "Code angelegt.");
        setShowAdd(false);
        setAddForm({ code: "", bezeichnung: "", gruppe: "beamter", istTeilzeit: false, sortierung: 0, bemerkung: "" });
        router.refresh();
      }
    });
  };

  const startEdit = (c: StatistikCode) => {
    setEditingCode(c.code);
    setEditForm({
      bezeichnung: c.bezeichnung,
      gruppe: c.gruppe,
      istTeilzeit: c.istTeilzeit,
      sortierung: c.sortierung,
      bemerkung: c.bemerkung ?? "",
    });
  };

  const handleUpdate = (c: StatistikCode) => {
    const fd = new FormData();
    fd.set("code", c.code);
    fd.set("bezeichnung", editForm.bezeichnung);
    fd.set("gruppe", editForm.gruppe);
    fd.set("istTeilzeit", String(editForm.istTeilzeit));
    fd.set("sortierung", String(editForm.sortierung));
    fd.set("bemerkung", editForm.bemerkung);

    startTransition(async () => {
      const result = await updateStatistikCodeAction(fd);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", result.message ?? "Code aktualisiert.");
        setEditingCode(null);
        router.refresh();
      }
    });
  };

  const handleToggleAktiv = (c: StatistikCode) => {
    if (c.aktiv && c.anzahlLehrer > 0) {
      if (!confirm(`Code "${c.code}" wird derzeit von ${c.anzahlLehrer} Lehrkraft/Lehrkraeften verwendet. Wirklich deaktivieren?`)) {
        return;
      }
    }
    const fd = new FormData();
    fd.set("code", c.code);
    fd.set("aktiv", String(!c.aktiv));

    startTransition(async () => {
      const result = await toggleStatistikCodeAktivAction(fd);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", result.message ?? "Status geaendert.");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#575756] text-white rounded-lg hover:bg-[#444] transition-colors text-sm font-medium cursor-pointer"
        >
          <Plus size={16} />
          Neuen Code anlegen
        </button>
      )}

      {showAdd && (
        <div className="border-2 border-green-400 rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">Neuen Statistik-Code anlegen</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Code *</label>
              <input
                type="text"
                value={addForm.code}
                onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })}
                maxLength={5}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
                placeholder="z.B. L, LT, U"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Sortierung</label>
              <input
                type="number"
                min={0}
                value={addForm.sortierung}
                onChange={(e) => setAddForm({ ...addForm, sortierung: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#374151] mb-1">Bezeichnung *</label>
              <input
                type="text"
                value={addForm.bezeichnung}
                onChange={(e) => setAddForm({ ...addForm, bezeichnung: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
                placeholder="z.B. Beamter Lebenszeit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Gruppe *</label>
              <select
                value={addForm.gruppe}
                onChange={(e) => setAddForm({ ...addForm, gruppe: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none bg-white"
              >
                <option value="beamter">Beamte</option>
                <option value="angestellter">Angestellte</option>
                <option value="sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer mt-7">
                <input
                  type="checkbox"
                  checked={addForm.istTeilzeit}
                  onChange={(e) => setAddForm({ ...addForm, istTeilzeit: e.target.checked })}
                  className="rounded border-[#D1D5DB]"
                />
                Teilzeit
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#374151] mb-1">Bemerkung</label>
              <input
                type="text"
                value={addForm.bemerkung}
                onChange={(e) => setAddForm({ ...addForm, bemerkung: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleCreate}
              disabled={isPending || !addForm.code.trim() || !addForm.bezeichnung.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium cursor-pointer transition-colors"
            >
              {isPending ? "Wird gespeichert..." : "Anlegen"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-[#D1D5DB] text-[#374151] rounded-lg hover:bg-gray-50 text-sm cursor-pointer transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Code</th>
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Bezeichnung</th>
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Gruppe</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Teilzeit</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Sortierung</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Lehrer</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Aktiv</th>
              <th className="text-right px-4 py-3 font-semibold text-[#374151]">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {codes.map((c) => {
              const isEditing = editingCode === c.code;
              const gruppeLabel = GRUPPE_LABEL[c.gruppe] ?? c.gruppe;
              const gruppeBadge = GRUPPE_BADGE[c.gruppe] ?? "bg-gray-50 text-gray-700 border-gray-200";

              if (isEditing) {
                return (
                  <tr key={c.code} className="bg-amber-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#1A1A1A]">{c.code}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editForm.bezeichnung}
                        onChange={(e) => setEditForm({ ...editForm, bezeichnung: e.target.value })}
                        className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-sm focus:ring-1 focus:ring-[#575756]/30 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editForm.gruppe}
                        onChange={(e) => setEditForm({ ...editForm, gruppe: e.target.value })}
                        className="px-2 py-1 border border-[#D1D5DB] rounded text-sm bg-white outline-none"
                      >
                        <option value="beamter">Beamte</option>
                        <option value="angestellter">Angestellte</option>
                        <option value="sonstiges">Sonstiges</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={editForm.istTeilzeit}
                        onChange={(e) => setEditForm({ ...editForm, istTeilzeit: e.target.checked })}
                        className="rounded border-[#D1D5DB]"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        value={editForm.sortierung}
                        onChange={(e) => setEditForm({ ...editForm, sortierung: Number(e.target.value) })}
                        className="w-20 px-2 py-1 border border-[#D1D5DB] rounded text-sm text-center focus:ring-1 focus:ring-[#575756]/30 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-[#6B7280]">{c.anzahlLehrer}</td>
                    <td className="px-4 py-3 text-center">
                      {c.aktiv ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleUpdate(c)}
                          disabled={isPending}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors cursor-pointer"
                          title="Speichern"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingCode(null)}
                          className="p-1.5 text-[#6B7280] hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title="Abbrechen"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={c.code} className={`hover:bg-[#F9FAFB] transition-colors ${!c.aktiv ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-[#1A1A1A]">{c.code}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#1A1A1A] font-medium">{c.bezeichnung}</span>
                    {c.bemerkung && (
                      <p className="text-xs text-[#6B7280] mt-0.5">{c.bemerkung}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${gruppeBadge}`}>
                      {gruppeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.istTeilzeit ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-[#6B7280]">{c.sortierung}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-[#1A1A1A]">{c.anzahlLehrer}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleAktiv(c)}
                      disabled={isPending}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                        c.aktiv ? "bg-green-500" : "bg-gray-300"
                      }`}
                      title={c.aktiv ? "Deaktivieren" : "Aktivieren"}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          c.aktiv ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(c)}
                      disabled={isPending}
                      className="p-1.5 text-[#6B7280] hover:text-[#1A1A1A] hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      title="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {codes.length === 0 && (
          <div className="px-6 py-12 text-center text-[#6B7280] text-sm">
            Noch keine Statistik-Codes vorhanden.
          </div>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Hinweis:</strong> Der Code selbst kann nach Anlage nicht mehr geaendert werden, da er von Lehrer-Datensaetzen referenziert wird.
        Zum Aendern: neuen Code anlegen, betroffene Lehrkraefte umbuchen, alten Code deaktivieren.
      </div>
    </div>
  );
}
