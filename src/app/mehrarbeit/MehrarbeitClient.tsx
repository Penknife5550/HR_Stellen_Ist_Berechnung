"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MONATE } from "@/lib/constants";
import { saveMehrarbeit, removeMehrarbeit } from "./actions";

type Schule = { id: number; kurzname: string; farbe: string };
type Lehrer = { id: number; name: string; stammschuleId: number | null; stammschuleCode: string | null };
type MehrarbeitEintrag = {
  id: number;
  lehrerId: number;
  monat: number;
  stunden: string;
  schuleId: number | null;
  bemerkung: string | null;
  lehrerName: string;
  schulKurzname: string | null;
  schulFarbe: string | null;
};

interface MehrarbeitClientProps {
  schulen: Schule[];
  lehrerListe: Lehrer[];
  mehrarbeitEintraege: MehrarbeitEintrag[];
  haushaltsjahrId: number;
  haushaltsjahrJahr: number;
}

export function MehrarbeitClient({
  schulen,
  lehrerListe,
  mehrarbeitEintraege,
  haushaltsjahrId,
}: MehrarbeitClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveMehrarbeit(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Mehrarbeit gespeichert." });
        setShowForm(false);
      }
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Diesen Eintrag wirklich loeschen?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      const res = await removeMehrarbeit(fd);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  const hatLehrer = lehrerListe.length > 0;

  return (
    <>
      {/* Meldungen */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "error"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Hinzufuegen-Button */}
      <div className="mb-4">
        <Button onClick={() => setShowForm(!showForm)} disabled={!hatLehrer}>
          {showForm ? "Abbrechen" : "+ Eintrag hinzufuegen"}
        </Button>
        {!hatLehrer && (
          <span className="ml-3 text-sm text-[#6B7280]">
            Noch keine Lehrkraefte in der Datenbank. Bitte zuerst n8n-Synchronisation durchfuehren.
          </span>
        )}
      </div>

      {/* Formular */}
      {showForm && hatLehrer && (
        <Card className="mb-6">
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
            Mehrarbeit erfassen
          </h3>
          <form action={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="hidden" name="haushaltsjahrId" value={haushaltsjahrId} />

            <div>
              <label className="block text-sm font-bold text-[#575756] mb-1">
                Lehrkraft *
              </label>
              <select
                name="lehrerId"
                required
                className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2.5 text-[15px] bg-white"
              >
                <option value="">Bitte waehlen...</option>
                {lehrerListe.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.stammschuleCode ? `(${l.stammschuleCode})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#575756] mb-1">
                Schule
              </label>
              <select
                name="schuleId"
                className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2.5 text-[15px] bg-white"
              >
                <option value="">Alle / Keine Zuordnung</option>
                {schulen.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.kurzname}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#575756] mb-1">
                Monat *
              </label>
              <select
                name="monat"
                required
                className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2.5 text-[15px] bg-white"
              >
                <option value="">Bitte waehlen...</option>
                {MONATE.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#575756] mb-1">
                Stunden *
              </label>
              <input
                type="number"
                name="stunden"
                step="0.5"
                min="0"
                required
                placeholder="z.B. 2,5"
                className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2.5 text-[15px]"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#575756] mb-1">
                Bemerkung
              </label>
              <input
                type="text"
                name="bemerkung"
                placeholder="Optional"
                className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2.5 text-[15px]"
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Speichere..." : "Speichern"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabelle */}
      {mehrarbeitEintraege.length > 0 ? (
        <Card>
          <p className="text-[15px] text-[#6B7280] mb-4">
            Hier werden Mehrarbeitsstunden erfasst, die ueber das regulaere Deputat hinausgehen.
            Diese werden bei der Stellenist-Berechnung separat beruecksichtigt.
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Lehrkraft
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schule
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Monat
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Stunden
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Bemerkung
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody>
              {mehrarbeitEintraege.map((m, i) => (
                <tr
                  key={m.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}
                >
                  <td className="py-3 px-4 text-[15px] font-medium">
                    {m.lehrerName}
                  </td>
                  <td className="py-3 px-4 text-[15px]">
                    {m.schulKurzname ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: m.schulFarbe ?? "#575756" }}
                      >
                        {m.schulKurzname}
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[15px]">
                    {MONATE[m.monat - 1]}
                  </td>
                  <td className="py-3 px-4 text-[15px] text-right font-bold tabular-nums">
                    {Number(m.stunden).toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#6B7280]">
                    {m.bemerkung ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-[#E2001A] hover:underline text-sm font-medium"
                      disabled={isPending}
                    >
                      Loeschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#575756] bg-[#F3F4F6]">
                <td className="py-3 px-4 font-bold" colSpan={3}>
                  Summe
                </td>
                <td className="py-3 px-4 text-right font-bold tabular-nums">
                  {mehrarbeitEintraege
                    .reduce((acc, m) => acc + Number(m.stunden), 0)
                    .toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 2,
                    })}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </Card>
      ) : (
        <Card>
          <p className="text-[15px] text-[#6B7280]">
            Hier werden Mehrarbeitsstunden erfasst, die ueber das regulaere Deputat hinausgehen.
            Diese werden bei der Stellenist-Berechnung separat beruecksichtigt.
          </p>
          <div className="mt-8 text-center py-12 text-[#6B7280]">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-lg font-medium">Noch keine Mehrarbeit erfasst</p>
            <p className="text-sm mt-1">
              {hatLehrer
                ? "Klicken Sie auf '+ Eintrag hinzufuegen' um zu beginnen."
                : "Sobald Lehrkraefte synchronisiert sind, koennen Sie Mehrarbeit erfassen."}
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
