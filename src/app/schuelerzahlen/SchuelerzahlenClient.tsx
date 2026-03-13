"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveSchuelerzahl, removeSchuelerzahl } from "./actions";

type Stufe = {
  id: number;
  stufe: string;
  schulformTyp: string;
};

type Zahl = {
  id: number;
  schulStufeId: number;
  stichtag: string;
  anzahl: number;
  bemerkung: string | null;
  stufe: string;
  schulformTyp: string;
  giltFuer: string;
};

type SchuleDaten = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
  stufen: Stufe[];
  zahlen: Zahl[];
};

export function SchuelerzahlenClient({ schulen }: { schulen: SchuleDaten[] }) {
  const [activeSchool, setActiveSchool] = useState(schulen[0]?.kurzname ?? "");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const active = schulen.find((s) => s.kurzname === activeSchool);

  const handleSave = async (formData: FormData) => {
    setSaving(true);
    setMessage(null);
    const result = await saveSchuelerzahl(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Schuelerzahl gespeichert!" });
      setShowForm(false);
      formRef.current?.reset();
    }
  };

  const handleDelete = async (formData: FormData) => {
    if (!confirm("Schuelerzahl wirklich loeschen?")) return;
    const result = await removeSchuelerzahl(formData);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    }
  };

  // Aktuelles Jahr fuer den vorgeschlagenen Stichtag
  const currentYear = new Date().getFullYear();
  const defaultStichtag = `${currentYear}-10-15`;

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
                setShowForm(false);
                setMessage(null);
              }}
              className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px ${
                isActive ? "text-[#1A1A1A] font-bold" : "text-[#6B7280] hover:text-[#1A1A1A]"
              }`}
              style={{
                borderBottom: `3px solid ${isActive ? schule.farbe : "transparent"}`,
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: schule.farbe }}
                />
                {schule.kurzname}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabelle */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-[#1A1A1A]">
            {active?.name ?? ""}
          </h3>
          <Button onClick={() => setShowForm(!showForm)} size="md">
            {showForm ? "Abbrechen" : "+ Neuen Stichtag erfassen"}
          </Button>
        </div>

        {/* Feedback-Meldung */}
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

        {/* Eingabeformular */}
        {showForm && active && (
          <form ref={formRef} action={handleSave} className="mb-6 p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
            <h4 className="text-sm font-bold text-[#575756] uppercase tracking-wider mb-4">
              Neue Schuelerzahl erfassen
            </h4>
            <input type="hidden" name="schuleId" value={active.id} />

            <div className="grid grid-cols-4 gap-4">
              {/* Stufe */}
              <div>
                <label className="block text-sm font-medium text-[#575756] mb-1">
                  Stufe *
                </label>
                <select
                  name="schulStufeId"
                  required
                  className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                >
                  {active.stufen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.stufe} ({s.schulformTyp})
                    </option>
                  ))}
                </select>
              </div>

              {/* Stichtag */}
              <div>
                <label className="block text-sm font-medium text-[#575756] mb-1">
                  Stichtag *
                </label>
                <input
                  type="date"
                  name="stichtag"
                  required
                  defaultValue={defaultStichtag}
                  className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                />
              </div>

              {/* Anzahl */}
              <div>
                <label className="block text-sm font-medium text-[#575756] mb-1">
                  Anzahl Schueler *
                </label>
                <input
                  type="number"
                  name="anzahl"
                  required
                  min="0"
                  placeholder="z.B. 530"
                  className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] tabular-nums"
                />
              </div>

              {/* Bemerkung */}
              <div>
                <label className="block text-sm font-medium text-[#575756] mb-1">
                  Bemerkung
                </label>
                <input
                  type="text"
                  name="bemerkung"
                  placeholder="Optional"
                  className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Speichere..." : "Speichern"}
              </Button>
            </div>
          </form>
        )}

        {/* Daten-Tabelle */}
        {active && active.zahlen.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Stichtag
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Stufe
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Anzahl Schueler
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Gilt fuer
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Bemerkung
                </th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[80px]">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody>
              {active.zahlen.map((row, i) => (
                <tr
                  key={row.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}
                >
                  <td className="py-3 px-4 text-[15px] tabular-nums">
                    {formatStichtag(row.stichtag)}
                  </td>
                  <td className="py-3 px-4 text-[15px]">{row.stufe}</td>
                  <td className="py-3 px-4 text-[15px] text-right tabular-nums font-bold">
                    {row.anzahl.toLocaleString("de-DE")}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#6B7280]">
                    {row.giltFuer}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#6B7280]">
                    {row.bemerkung ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <form action={handleDelete}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="text-[#E2001A] hover:text-red-700 text-sm font-medium"
                        title="Loeschen"
                      >
                        ✕
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-[#6B7280]">
            <p className="text-lg mb-2">Noch keine Schuelerzahlen erfasst</p>
            <p className="text-sm">
              Klicken Sie oben auf &quot;+ Neuen Stichtag erfassen&quot;, um die
              ersten Schuelerzahlen einzugeben.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

function formatStichtag(dateStr: string): string {
  // "2024-10-15" → "15.10.2024"
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}
