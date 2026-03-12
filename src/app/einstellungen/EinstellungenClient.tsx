"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Check, Lock, Unlock, X } from "lucide-react";
import {
  createSchuljahrAction,
  toggleSchuljahrAktivAction,
  createHaushaltsjahrAction,
  toggleHaushaltsjahrGesperrtAction,
} from "./actions";

// ============================================================
// TYPES
// ============================================================

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

export function EinstellungenClient({ schuljahre, haushaltsjahre, isAdmin }: Props) {
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
