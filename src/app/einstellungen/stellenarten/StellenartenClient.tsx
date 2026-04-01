"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Check } from "lucide-react";
import { BINDUNGSTYP_LABELS } from "@/lib/constants";
import {
  createStellenartAction,
  updateStellenartAction,
  toggleStellenartAktivAction,
} from "./actions";

interface Stellenart {
  id: number;
  bezeichnung: string;
  kurzbezeichnung: string | null;
  beschreibung: string | null;
  rechtsgrundlage: string | null;
  bindungstyp: string;
  istIsoliert: boolean;
  istStandard: boolean;
  aktiv: boolean;
  sortierung: number;
}

interface Props {
  stellenarten: Stellenart[];
}

export function StellenartenClient({ stellenarten }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add-Form State
  const [addForm, setAddForm] = useState({
    bezeichnung: "",
    kurzbezeichnung: "",
    beschreibung: "",
    rechtsgrundlage: "",
    bindungstyp: "schule",
    istIsoliert: false,
  });

  // Edit-Form State
  const [editForm, setEditForm] = useState({
    bezeichnung: "",
    kurzbezeichnung: "",
    beschreibung: "",
    rechtsgrundlage: "",
    bindungstyp: "schule",
    istIsoliert: false,
  });

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreate = () => {
    const formData = new FormData();
    formData.set("bezeichnung", addForm.bezeichnung);
    formData.set("kurzbezeichnung", addForm.kurzbezeichnung);
    formData.set("beschreibung", addForm.beschreibung);
    formData.set("rechtsgrundlage", addForm.rechtsgrundlage);
    formData.set("bindungstyp", addForm.bindungstyp);
    formData.set("istIsoliert", String(addForm.istIsoliert));

    startTransition(async () => {
      const result = await createStellenartAction(formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", result.message ?? "Stellenart angelegt.");
        setShowAdd(false);
        setAddForm({
          bezeichnung: "",
          kurzbezeichnung: "",
          beschreibung: "",
          rechtsgrundlage: "",
          bindungstyp: "schule",
          istIsoliert: false,
        });
        router.refresh();
      }
    });
  };

  const startEdit = (sa: Stellenart) => {
    setEditingId(sa.id);
    setEditForm({
      bezeichnung: sa.bezeichnung,
      kurzbezeichnung: sa.kurzbezeichnung ?? "",
      beschreibung: sa.beschreibung ?? "",
      rechtsgrundlage: sa.rechtsgrundlage ?? "",
      bindungstyp: sa.bindungstyp,
      istIsoliert: sa.istIsoliert,
    });
  };

  const handleUpdate = (sa: Stellenart) => {
    const formData = new FormData();
    formData.set("id", String(sa.id));
    // Standard-Typen: Bezeichnung nicht aenderbar
    formData.set("bezeichnung", sa.istStandard ? sa.bezeichnung : editForm.bezeichnung);
    formData.set("kurzbezeichnung", sa.istStandard ? (sa.kurzbezeichnung ?? "") : editForm.kurzbezeichnung);
    formData.set("beschreibung", editForm.beschreibung);
    formData.set("rechtsgrundlage", editForm.rechtsgrundlage);
    formData.set("bindungstyp", sa.istStandard ? sa.bindungstyp : editForm.bindungstyp);
    formData.set("istIsoliert", sa.istStandard ? String(sa.istIsoliert) : String(editForm.istIsoliert));

    startTransition(async () => {
      const result = await updateStellenartAction(formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", result.message ?? "Stellenart aktualisiert.");
        setEditingId(null);
        router.refresh();
      }
    });
  };

  const handleToggleAktiv = (sa: Stellenart) => {
    const formData = new FormData();
    formData.set("id", String(sa.id));
    formData.set("aktiv", String(!sa.aktiv));
    formData.set("bezeichnung", sa.bezeichnung);

    startTransition(async () => {
      const result = await toggleStellenartAktivAction(formData);
      if (result.error) {
        showMessage("error", result.error);
      } else {
        showMessage("success", result.message ?? "Status geaendert.");
        router.refresh();
      }
    });
  };

  const isSonstiger = (sa: Stellenart) => sa.bezeichnung === "Sonstiger Stellenanteil";

  return (
    <div className="space-y-6">
      {/* Message */}
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

      {/* Add Button */}
      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#575756] text-white rounded-lg hover:bg-[#444] transition-colors text-sm font-medium cursor-pointer"
        >
          <Plus size={16} />
          Neue Stellenart
        </button>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="border-2 border-green-400 rounded-xl bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-4">Neue Stellenart anlegen</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Bezeichnung *</label>
              <input
                type="text"
                value={addForm.bezeichnung}
                onChange={(e) => setAddForm({ ...addForm, bezeichnung: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
                placeholder="z.B. Schwerbehindertenvertretung"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Kurzbezeichnung</label>
              <input
                type="text"
                value={addForm.kurzbezeichnung}
                onChange={(e) => setAddForm({ ...addForm, kurzbezeichnung: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
                placeholder="z.B. SBV"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#374151] mb-1">Beschreibung</label>
              <input
                type="text"
                value={addForm.beschreibung}
                onChange={(e) => setAddForm({ ...addForm, beschreibung: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Rechtsgrundlage</label>
              <input
                type="text"
                value={addForm.rechtsgrundlage}
                onChange={(e) => setAddForm({ ...addForm, rechtsgrundlage: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none"
                placeholder="z.B. SGB IX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Bindungstyp *</label>
              <select
                value={addForm.bindungstyp}
                onChange={(e) => setAddForm({ ...addForm, bindungstyp: e.target.value })}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:ring-2 focus:ring-[#575756]/30 focus:border-[#575756] outline-none bg-white"
              >
                <option value="schule">Schulbezogen</option>
                <option value="person">Personengebunden</option>
                <option value="beides">Schul- oder personengebunden</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#374151] cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.istIsoliert}
                  onChange={(e) => setAddForm({ ...addForm, istIsoliert: e.target.checked })}
                  className="rounded border-[#D1D5DB]"
                />
                Isoliert (wird nicht in die Stellensoll-Berechnung einbezogen)
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleCreate}
              disabled={isPending || !addForm.bezeichnung.trim()}
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Bezeichnung</th>
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Kurz</th>
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Bindungstyp</th>
              <th className="text-left px-4 py-3 font-semibold text-[#374151]">Rechtsgrundlage</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Isoliert</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Standard</th>
              <th className="text-center px-4 py-3 font-semibold text-[#374151]">Aktiv</th>
              <th className="text-right px-4 py-3 font-semibold text-[#374151]">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {stellenarten.map((sa) => {
              const isEditing = editingId === sa.id;
              const bindungLabel = BINDUNGSTYP_LABELS[sa.bindungstyp] ?? sa.bindungstyp;
              const bindungColor =
                sa.bindungstyp === "person"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : sa.bindungstyp === "beides"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-gray-50 text-gray-700 border-gray-200";

              if (isEditing) {
                return (
                  <tr key={sa.id} className="bg-amber-50/50">
                    <td className="px-4 py-3">
                      {sa.istStandard ? (
                        <span className="text-sm text-[#1A1A1A] font-medium">{sa.bezeichnung}</span>
                      ) : (
                        <input
                          type="text"
                          value={editForm.bezeichnung}
                          onChange={(e) => setEditForm({ ...editForm, bezeichnung: e.target.value })}
                          className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-sm focus:ring-1 focus:ring-[#575756]/30 outline-none"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sa.istStandard ? (
                        <span className="text-sm text-[#6B7280]">{sa.kurzbezeichnung ?? "--"}</span>
                      ) : (
                        <input
                          type="text"
                          value={editForm.kurzbezeichnung}
                          onChange={(e) => setEditForm({ ...editForm, kurzbezeichnung: e.target.value })}
                          className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-sm focus:ring-1 focus:ring-[#575756]/30 outline-none"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {sa.istStandard ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${bindungColor}`}>
                          {bindungLabel}
                        </span>
                      ) : (
                        <select
                          value={editForm.bindungstyp}
                          onChange={(e) => setEditForm({ ...editForm, bindungstyp: e.target.value })}
                          className="px-2 py-1 border border-[#D1D5DB] rounded text-sm bg-white outline-none"
                        >
                          <option value="schule">Schulbezogen</option>
                          <option value="person">Personengebunden</option>
                          <option value="beides">Beides</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={editForm.rechtsgrundlage}
                        onChange={(e) => setEditForm({ ...editForm, rechtsgrundlage: e.target.value })}
                        className="w-full px-2 py-1 border border-[#D1D5DB] rounded text-sm focus:ring-1 focus:ring-[#575756]/30 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sa.istStandard ? (
                        <span>{sa.istIsoliert ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={editForm.istIsoliert}
                          onChange={(e) => setEditForm({ ...editForm, istIsoliert: e.target.checked })}
                          className="rounded border-[#D1D5DB]"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sa.istStandard ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sa.aktiv ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleUpdate(sa)}
                          disabled={isPending}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors cursor-pointer"
                          title="Speichern"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
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
                <tr key={sa.id} className={`hover:bg-[#F9FAFB] transition-colors ${!sa.aktiv ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[#1A1A1A] font-medium">{sa.bezeichnung}</span>
                    {sa.beschreibung && (
                      <p className="text-xs text-[#6B7280] mt-0.5">{sa.beschreibung}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{sa.kurzbezeichnung ?? "--"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${bindungColor}`}>
                      {bindungLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{sa.rechtsgrundlage ?? "--"}</td>
                  <td className="px-4 py-3 text-center">
                    {sa.istIsoliert ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {sa.istStandard ? <Check size={16} className="inline text-green-600" /> : <span className="text-[#D1D5DB]">--</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isSonstiger(sa) ? (
                      // "Sonstiger Stellenanteil" ist immer aktiv
                      <Check size={16} className="inline text-green-600" />
                    ) : (
                      <button
                        onClick={() => handleToggleAktiv(sa)}
                        disabled={isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                          sa.aktiv ? "bg-green-500" : "bg-gray-300"
                        }`}
                        title={sa.aktiv ? "Deaktivieren" : "Aktivieren"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            sa.aktiv ? "translate-x-4" : "translate-x-1"
                          }`}
                        />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(sa)}
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

        {stellenarten.length === 0 && (
          <div className="px-6 py-12 text-center text-[#6B7280] text-sm">
            Keine Stellenarten vorhanden. Erstellen Sie die erste Stellenart.
          </div>
        )}
      </div>
    </div>
  );
}
