"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Check, Lock, Unlock, X, School, Pencil, Eye, EyeOff, Layers } from "lucide-react";
import {
  createSchuljahrAction,
  toggleSchuljahrAktivAction,
  createHaushaltsjahrAction,
  toggleHaushaltsjahrGesperrtAction,
  createSchuleAction,
  updateSchuleAction,
  toggleSchuleAktivAction,
  createSchulStufeAction,
  updateSchulStufeAction,
  toggleSchulStufeAktivAction,
} from "./actions";

// ============================================================
// TYPES
// ============================================================

interface Schule {
  id: number;
  schulnummer: string;
  name: string;
  kurzname: string;
  untisCode: string | null;
  schulform: string;
  adresse: string | null;
  plz: string | null;
  ort: string | null;
  farbe: string;
  istImAufbau: boolean;
  aktiv: boolean;
}

interface SchulStufe {
  id: number;
  schuleId: number;
  stufe: string;
  schulformTyp: string;
  aktiv: boolean;
  schulKurzname: string;
  schulFarbe: string;
}

interface Schuljahr {
  id: number;
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
  aktiv: boolean;
}

interface Haushaltsjahr {
  id: number;
  jahr: number;
  stichtagVorjahr: string | null;
  stichtagLaufend: string | null;
  gesperrt: boolean;
}

interface Props {
  schulen: Schule[];
  schulStufen: SchulStufe[];
  schuljahre: Schuljahr[];
  haushaltsjahre: Haushaltsjahr[];
  isAdmin: boolean;
}

// ============================================================
// HELPERS
// ============================================================

function formatDatum(datum: string | null): string {
  if (!datum) return "—";
  return new Date(datum + "T00:00:00").toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Aus "2026/2027" → startDatum "2026-08-01", endDatum "2027-07-31"
 */
function parseBezeichnungToDates(bez: string): { start: string; end: string } | null {
  const match = bez.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return null;
  return {
    start: `${match[1]}-08-01`,
    end: `${match[2]}-07-31`,
  };
}

/**
 * Aus Jahr 2027 → Stichtag Vorjahr "2026-10-15", Stichtag Laufend "2027-10-15"
 */
function jahrToStichtage(jahr: number): { vorjahr: string; laufend: string } {
  return {
    vorjahr: `${jahr - 1}-10-15`,
    laufend: `${jahr}-10-15`,
  };
}

// ============================================================
// COMPONENT
// ============================================================

export function EinstellungenClient({ schulen, schulStufen, schuljahre, haushaltsjahre, isAdmin }: Props) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  return (
    <div className="space-y-6">
      {/* Status-Meldung */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-4">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Schulen */}
      <SchulenSection
        schulen={schulen}
        isAdmin={isAdmin}
        onMessage={setMessage}
      />

      {/* Schul-Stufen */}
      <SchulStufenSection
        schulStufen={schulStufen}
        schulen={schulen.filter((s) => s.aktiv)}
        isAdmin={isAdmin}
        onMessage={setMessage}
      />

      {/* Schuljahre */}
      <SchuljahrSection
        schuljahre={schuljahre}
        isAdmin={isAdmin}
        onMessage={setMessage}
      />

      {/* Haushaltsjahre */}
      <HaushaltsjahrSection
        haushaltsjahre={haushaltsjahre}
        isAdmin={isAdmin}
        onMessage={setMessage}
      />
    </div>
  );
}

// ============================================================
// SCHULEN SECTION
// ============================================================

const emptySchulForm = {
  schulnummer: "",
  name: "",
  kurzname: "",
  schulform: "",
  farbe: "#575756",
  untisCode: "",
  adresse: "",
  plz: "",
  ort: "",
  istImAufbau: false,
};

function SchulenSection({
  schulen,
  isAdmin,
  onMessage,
}: {
  schulen: Schule[];
  isAdmin: boolean;
  onMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptySchulForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setForm(emptySchulForm);
    setShowForm(false);
    setEditId(null);
  };

  const startEdit = (schule: Schule) => {
    setForm({
      schulnummer: schule.schulnummer,
      name: schule.name,
      kurzname: schule.kurzname,
      schulform: schule.schulform,
      farbe: schule.farbe,
      untisCode: schule.untisCode ?? "",
      adresse: schule.adresse ?? "",
      plz: schule.plz ?? "",
      ort: schule.ort ?? "",
      istImAufbau: schule.istImAufbau,
    });
    setEditId(schule.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    onMessage(null);

    const formData = new FormData();
    if (editId) formData.set("id", String(editId));
    formData.set("schulnummer", form.schulnummer);
    formData.set("name", form.name);
    formData.set("kurzname", form.kurzname);
    formData.set("schulform", form.schulform);
    formData.set("farbe", form.farbe);
    formData.set("untisCode", form.untisCode);
    formData.set("adresse", form.adresse);
    formData.set("plz", form.plz);
    formData.set("ort", form.ort);
    formData.set("istImAufbau", String(form.istImAufbau));

    const result = editId
      ? await updateSchuleAction(formData)
      : await createSchuleAction(formData);

    setIsSubmitting(false);

    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Gespeichert." });
      resetForm();
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  const handleToggleAktiv = async (id: number, aktiv: boolean) => {
    onMessage(null);
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("aktiv", String(aktiv));
    const result = await toggleSchuleAktivAction(formData);
    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Status geaendert." });
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  const isFormValid = form.schulnummer && form.name && form.kurzname && form.schulform;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <School size={20} className="text-[#575756]" />
          <h3 className="text-lg font-bold text-[#1A1A1A]">Schulen</h3>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => { setEditId(null); setForm(emptySchulForm); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#575756]
              hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Neue Schule
          </button>
        )}
      </div>

      {/* Inline-Formular (Anlegen / Bearbeiten) */}
      {showForm && (
        <div className="mb-4 p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <div className="text-sm font-medium text-[#575756] mb-3">
            {editId ? "Schule bearbeiten" : "Neue Schule anlegen"}
          </div>
          <div className="grid grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schulnummer *</label>
              <input
                type="text"
                value={form.schulnummer}
                onChange={(e) => setForm({ ...form, schulnummer: e.target.value })}
                placeholder="123456"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Freie Ev. Gesamtschule"
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kurzname *</label>
              <input
                type="text"
                value={form.kurzname}
                onChange={(e) => setForm({ ...form, kurzname: e.target.value })}
                placeholder="GES"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schulform *</label>
              <input
                type="text"
                value={form.schulform}
                onChange={(e) => setForm({ ...form, schulform: e.target.value })}
                placeholder="Gesamtschule"
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Farbe</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.farbe}
                  onChange={(e) => setForm({ ...form, farbe: e.target.value })}
                  className="h-9 w-12 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={form.farbe}
                  onChange={(e) => setForm({ ...form, farbe: e.target.value })}
                  maxLength={7}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                    focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Untis-Code</label>
              <input
                type="text"
                value={form.untisCode}
                onChange={(e) => setForm({ ...form, untisCode: e.target.value })}
                placeholder="GES"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PLZ / Ort</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.plz}
                  onChange={(e) => setForm({ ...form, plz: e.target.value })}
                  placeholder="51069"
                  maxLength={5}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                />
                <input
                  type="text"
                  value={form.ort}
                  onChange={(e) => setForm({ ...form, ort: e.target.value })}
                  placeholder="Koeln"
                  maxLength={100}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.istImAufbau}
                  onChange={(e) => setForm({ ...form, istImAufbau: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-[#575756] focus:ring-[#575756]"
                />
                <span className="text-sm text-gray-600">Im Aufbau</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              className="px-4 py-1.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                hover:bg-[#474746] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Wird gespeichert..." : editId ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[#575756]">
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Schulnummer
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Name
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Kurzname
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Schulform
            </th>
            <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Farbe
            </th>
            <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Status
            </th>
            {isAdmin && (
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                Aktionen
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {schulen.map((s, i) => (
            <tr
              key={s.id}
              className={`${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"} ${
                !s.aktiv ? "opacity-60" : ""
              }`}
            >
              <td className="py-3 px-4 text-[15px] font-mono">{s.schulnummer}</td>
              <td className="py-3 px-4 text-[15px]">
                {s.name}
                {s.istImAufbau && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF7CC] text-[#8B6C00]">
                    IM AUFBAU
                  </span>
                )}
              </td>
              <td className="py-3 px-4">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: s.farbe }}
                >
                  {s.kurzname}
                </span>
              </td>
              <td className="py-3 px-4 text-[15px]">{s.schulform}</td>
              <td className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block w-5 h-5 rounded" style={{ backgroundColor: s.farbe }} />
                  <span className="text-xs text-[#6B7280] font-mono">{s.farbe}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                {s.aktiv ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Check size={12} />
                    Aktiv
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Inaktiv
                  </span>
                )}
              </td>
              {isAdmin && (
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => startEdit(s)}
                      className="p-1.5 text-[#575756] hover:bg-gray-100 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleAktiv(s.id, !s.aktiv)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        s.aktiv
                          ? "text-red-600 hover:bg-red-50"
                          : "text-green-600 hover:bg-green-50"
                      }`}
                      title={s.aktiv ? "Deaktivieren" : "Aktivieren"}
                    >
                      {s.aktiv ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {schulen.length === 0 && (
        <p className="text-[#6B7280] py-6 text-center text-sm">
          Keine Schulen vorhanden.
        </p>
      )}
    </div>
  );
}

// ============================================================
// SCHUL-STUFEN SECTION
// ============================================================

const emptyStufenForm = {
  schuleId: 0,
  stufe: "",
  schulformTyp: "",
};

function SchulStufenSection({
  schulStufen,
  schulen,
  isAdmin,
  onMessage,
}: {
  schulStufen: SchulStufe[];
  schulen: Schule[];
  isAdmin: boolean;
  onMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyStufenForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setForm(emptyStufenForm);
    setShowForm(false);
    setEditId(null);
  };

  const startEdit = (stufe: SchulStufe) => {
    setForm({
      schuleId: stufe.schuleId,
      stufe: stufe.stufe,
      schulformTyp: stufe.schulformTyp,
    });
    setEditId(stufe.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    onMessage(null);

    const formData = new FormData();
    if (editId) formData.set("id", String(editId));
    formData.set("schuleId", String(form.schuleId));
    formData.set("stufe", form.stufe);
    formData.set("schulformTyp", form.schulformTyp);

    const result = editId
      ? await updateSchulStufeAction(formData)
      : await createSchulStufeAction(formData);

    setIsSubmitting(false);

    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Gespeichert." });
      resetForm();
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  const handleToggleAktiv = async (id: number, aktiv: boolean) => {
    onMessage(null);
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("aktiv", String(aktiv));
    const result = await toggleSchulStufeAktivAction(formData);
    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Status geaendert." });
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  const isFormValid = form.schuleId > 0 && form.stufe && form.schulformTyp;

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers size={20} className="text-[#575756]" />
          <h3 className="text-lg font-bold text-[#1A1A1A]">Schul-Stufen</h3>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => { setEditId(null); setForm(emptyStufenForm); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#575756]
              hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Neue Stufe
          </button>
        )}
      </div>

      {/* Inline-Formular (Anlegen / Bearbeiten) */}
      {showForm && (
        <div className="mb-4 p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <div className="text-sm font-medium text-[#575756] mb-3">
            {editId ? "Stufe bearbeiten" : "Neue Stufe anlegen"}
          </div>
          <div className="grid grid-cols-3 gap-4 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schule *</label>
              <select
                value={form.schuleId}
                onChange={(e) => setForm({ ...form, schuleId: Number(e.target.value) })}
                disabled={editId !== null}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent
                  disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value={0}>— Schule waehlen —</option>
                {schulen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.kurzname} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stufe *</label>
              <input
                type="text"
                value={form.stufe}
                onChange={(e) => setForm({ ...form, stufe: e.target.value })}
                placeholder="z.B. Sek I, Sek II, Primarstufe"
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Schulform-Typ *</label>
              <input
                type="text"
                value={form.schulformTyp}
                onChange={(e) => setForm({ ...form, schulformTyp: e.target.value })}
                placeholder="z.B. Gesamtschule Sek I"
                maxLength={50}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-[#6B7280] mb-3">
            Der Schulform-Typ muss exakt mit der SLR-Konfiguration uebereinstimmen.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              className="px-4 py-1.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                hover:bg-[#474746] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Wird gespeichert..." : editId ? "Speichern" : "Anlegen"}
            </button>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[#575756]">
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Schule
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Stufe
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Schulform-Typ
            </th>
            <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Status
            </th>
            {isAdmin && (
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                Aktionen
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {schulStufen.map((st, i) => (
            <tr
              key={st.id}
              className={`${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"} ${
                !st.aktiv ? "opacity-60" : ""
              }`}
            >
              <td className="py-3 px-4">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: st.schulFarbe }}
                >
                  {st.schulKurzname}
                </span>
              </td>
              <td className="py-3 px-4 text-[15px] font-medium">{st.stufe}</td>
              <td className="py-3 px-4 text-[15px]">{st.schulformTyp}</td>
              <td className="py-3 px-4 text-center">
                {st.aktiv ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Check size={12} />
                    Aktiv
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Inaktiv
                  </span>
                )}
              </td>
              {isAdmin && (
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => startEdit(st)}
                      className="p-1.5 text-[#575756] hover:bg-gray-100 rounded-lg transition-colors"
                      title="Bearbeiten"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleToggleAktiv(st.id, !st.aktiv)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        st.aktiv
                          ? "text-red-600 hover:bg-red-50"
                          : "text-green-600 hover:bg-green-50"
                      }`}
                      title={st.aktiv ? "Deaktivieren" : "Aktivieren"}
                    >
                      {st.aktiv ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {schulStufen.length === 0 && (
        <p className="text-[#6B7280] py-6 text-center text-sm">
          Keine Stufen vorhanden.
        </p>
      )}
    </div>
  );
}

// ============================================================
// SCHULJAHR SECTION
// ============================================================

function SchuljahrSection({
  schuljahre,
  isAdmin,
  onMessage,
}: {
  schuljahre: Schuljahr[];
  isAdmin: boolean;
  onMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [bezeichnung, setBezeichnung] = useState("");
  const [startDatum, setStartDatum] = useState("");
  const [endDatum, setEndDatum] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-Vorschlag bei Bezeichnungs-Eingabe
  const handleBezeichnungChange = (value: string) => {
    setBezeichnung(value);
    const dates = parseBezeichnungToDates(value);
    if (dates) {
      setStartDatum(dates.start);
      setEndDatum(dates.end);
    }
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    onMessage(null);
    const formData = new FormData();
    formData.set("bezeichnung", bezeichnung);
    formData.set("startDatum", startDatum);
    formData.set("endDatum", endDatum);
    const result = await createSchuljahrAction(formData);
    setIsSubmitting(false);
    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Schuljahr angelegt." });
      setShowForm(false);
      setBezeichnung("");
      setStartDatum("");
      setEndDatum("");
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  const handleToggleAktiv = async (id: number, aktiv: boolean) => {
    onMessage(null);
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("aktiv", String(aktiv));
    const result = await toggleSchuljahrAktivAction(formData);
    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Status geaendert." });
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-[#575756]" />
          <h3 className="text-lg font-bold text-[#1A1A1A]">Schuljahre</h3>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#575756]
              hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Neues Schuljahr
          </button>
        )}
      </div>

      {/* Inline-Formular */}
      {showForm && (
        <div className="mb-4 p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bezeichnung</label>
              <input
                type="text"
                value={bezeichnung}
                onChange={(e) => handleBezeichnungChange(e.target.value)}
                placeholder="2026/2027"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Startdatum</label>
              <input
                type="date"
                value={startDatum}
                onChange={(e) => setStartDatum(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Enddatum</label>
              <input
                type="date"
                value={endDatum}
                onChange={(e) => setEndDatum(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setBezeichnung(""); setStartDatum(""); setEndDatum(""); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !bezeichnung || !startDatum || !endDatum}
              className="px-4 py-1.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                hover:bg-[#474746] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Wird angelegt..." : "Anlegen"}
            </button>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[#575756]">
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Bezeichnung
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Startdatum
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Enddatum
            </th>
            <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Status
            </th>
            {isAdmin && (
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                Aktionen
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {schuljahre.map((sj, i) => (
            <tr key={sj.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
              <td className="py-3 px-4 text-[15px] font-medium">{sj.bezeichnung}</td>
              <td className="py-3 px-4 text-[15px]">{formatDatum(sj.startDatum)}</td>
              <td className="py-3 px-4 text-[15px]">{formatDatum(sj.endDatum)}</td>
              <td className="py-3 px-4 text-center">
                {sj.aktiv ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Check size={12} />
                    Aktiv
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                    Inaktiv
                  </span>
                )}
              </td>
              {isAdmin && (
                <td className="py-3 px-4 text-right">
                  {!sj.aktiv && (
                    <button
                      onClick={() => handleToggleAktiv(sj.id, true)}
                      className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50
                        hover:bg-green-100 rounded-lg transition-colors"
                    >
                      Als aktiv setzen
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {schuljahre.length === 0 && (
        <p className="text-[#6B7280] py-6 text-center text-sm">
          Keine Schuljahre vorhanden.
        </p>
      )}
    </div>
  );
}

// ============================================================
// HAUSHALTSJAHR SECTION
// ============================================================

function HaushaltsjahrSection({
  haushaltsjahre,
  isAdmin,
  onMessage,
}: {
  haushaltsjahre: Haushaltsjahr[];
  isAdmin: boolean;
  onMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [jahr, setJahr] = useState("");
  const [stichtagVorjahr, setStichtagVorjahr] = useState("");
  const [stichtagLaufend, setStichtagLaufend] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-Vorschlag bei Jahr-Eingabe
  const handleJahrChange = (value: string) => {
    setJahr(value);
    const num = Number(value);
    if (Number.isInteger(num) && num >= 2020 && num <= 2050) {
      const stichtage = jahrToStichtage(num);
      setStichtagVorjahr(stichtage.vorjahr);
      setStichtagLaufend(stichtage.laufend);
    }
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    onMessage(null);
    const formData = new FormData();
    formData.set("jahr", jahr);
    formData.set("stichtagVorjahr", stichtagVorjahr);
    formData.set("stichtagLaufend", stichtagLaufend);
    const result = await createHaushaltsjahrAction(formData);
    setIsSubmitting(false);
    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Haushaltsjahr angelegt." });
      setShowForm(false);
      setJahr("");
      setStichtagVorjahr("");
      setStichtagLaufend("");
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  const handleToggleGesperrt = async (id: number, gesperrt: boolean) => {
    onMessage(null);
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("gesperrt", String(gesperrt));
    const result = await toggleHaushaltsjahrGesperrtAction(formData);
    if (result.success) {
      onMessage({ type: "success", text: result.message ?? "Status geaendert." });
      router.refresh();
    } else {
      onMessage({ type: "error", text: result.error ?? "Fehler." });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-[#575756]" />
          <h3 className="text-lg font-bold text-[#1A1A1A]">Haushaltsjahre</h3>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#575756]
              hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Neues Haushaltsjahr
          </button>
        )}
      </div>

      {/* Inline-Formular */}
      {showForm && (
        <div className="mb-4 p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jahr</label>
              <input
                type="number"
                value={jahr}
                onChange={(e) => handleJahrChange(e.target.value)}
                placeholder="2027"
                min={2020}
                max={2050}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stichtag Vorjahr</label>
              <input
                type="date"
                value={stichtagVorjahr}
                onChange={(e) => setStichtagVorjahr(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stichtag Laufend</label>
              <input
                type="date"
                value={stichtagLaufend}
                onChange={(e) => setStichtagLaufend(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setJahr(""); setStichtagVorjahr(""); setStichtagLaufend(""); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !jahr || !stichtagVorjahr || !stichtagLaufend}
              className="px-4 py-1.5 bg-[#575756] text-white rounded-lg text-sm font-medium
                hover:bg-[#474746] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Wird angelegt..." : "Anlegen"}
            </button>
          </div>
        </div>
      )}

      {/* Tabelle */}
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-[#575756]">
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Jahr
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Stichtag Vorjahr
            </th>
            <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Stichtag Laufend
            </th>
            <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
              Status
            </th>
            {isAdmin && (
              <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                Aktionen
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {haushaltsjahre.map((hj, i) => (
            <tr
              key={hj.id}
              className={`${i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"} ${
                hj.gesperrt ? "opacity-60" : ""
              }`}
            >
              <td className="py-3 px-4 text-[15px] font-medium tabular-nums">{hj.jahr}</td>
              <td className="py-3 px-4 text-[15px] tabular-nums">{formatDatum(hj.stichtagVorjahr)}</td>
              <td className="py-3 px-4 text-[15px] tabular-nums">{formatDatum(hj.stichtagLaufend)}</td>
              <td className="py-3 px-4 text-center">
                {hj.gesperrt ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <Lock size={12} />
                    Gesperrt
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Unlock size={12} />
                    Offen
                  </span>
                )}
              </td>
              {isAdmin && (
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => handleToggleGesperrt(hj.id, !hj.gesperrt)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      hj.gesperrt
                        ? "text-green-700 bg-green-50 hover:bg-green-100"
                        : "text-red-700 bg-red-50 hover:bg-red-100"
                    }`}
                  >
                    {hj.gesperrt ? "Entsperren" : "Sperren"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {haushaltsjahre.length === 0 && (
        <p className="text-[#6B7280] py-6 text-center text-sm">
          Keine Haushaltsjahre vorhanden.
        </p>
      )}
    </div>
  );
}
