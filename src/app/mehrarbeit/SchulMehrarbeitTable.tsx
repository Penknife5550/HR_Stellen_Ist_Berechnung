"use client";

import { Fragment, useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { MONATE_KURZ } from "@/lib/constants";
import {
  saveMehrarbeitSchuleAction,
  saveMehrarbeitSchuleBemerkungAction,
} from "./actions";

type Schule = { id: number; kurzname: string; farbe: string; name: string };

interface SchulEintrag {
  schuleId: number;
  monat: number;
  stellenanteil: string; // 4 Nachkommastellen als String
}

interface Bemerkung {
  schuleId: number;
  bemerkung: string;
}

interface Props {
  schulen: Schule[];
  eintraege: SchulEintrag[];
  bemerkungen: Bemerkung[];
  haushaltsjahrId: number;
  haushaltsjahrJahr: number;
}

function formatVierStellen(v: string | number): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function parseEingabe(v: string): string {
  return v.replace(/\s/g, "").replace(",", ".");
}

export function SchulMehrarbeitTable({
  schulen,
  eintraege,
  bemerkungen,
  haushaltsjahrId,
  haushaltsjahrJahr,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lokale Arbeitskopie: Map[schuleId][monat] = value-string
  const buildInitial = () => {
    const m: Record<number, Record<number, string>> = {};
    for (const s of schulen) m[s.id] = {};
    for (const e of eintraege) {
      m[e.schuleId] ??= {};
      m[e.schuleId][e.monat] = formatVierStellen(e.stellenanteil);
    }
    return m;
  };
  const [werte, setWerte] = useState<Record<number, Record<number, string>>>(buildInitial);
  // Letzter gespeicherter Wert pro Zelle (fuer Change-Detection, verhindert unnoetige Saves)
  const [gespeichert, setGespeichert] = useState<Record<number, Record<number, string>>>(buildInitial);

  const [bemTexte, setBemTexte] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const b of bemerkungen) m[b.schuleId] = b.bemerkung;
    return m;
  });
  const [bemEditing, setBemEditing] = useState<number | null>(null);

  function saveZelle(schuleId: number, monat: number, value: string) {
    // Change-Detection: nur speichern wenn sich numerischer Wert geaendert hat
    const altRaw = gespeichert[schuleId]?.[monat] ?? "";
    const altNum = Number(parseEingabe(altRaw || "0"));
    const neuNum = Number(parseEingabe(value || "0"));
    if (!Number.isFinite(neuNum)) {
      setMessage({ type: "error", text: "Ungueltige Zahl." });
      // Eingabe auf gespeicherten Wert zuruecksetzen
      setWerte((prev) => ({
        ...prev,
        [schuleId]: { ...(prev[schuleId] ?? {}), [monat]: altRaw },
      }));
      return;
    }
    if (Math.abs(altNum - neuNum) < 0.00001) {
      // Kanonische Formatierung sicherstellen, aber nicht speichern
      setWerte((prev) => ({
        ...prev,
        [schuleId]: { ...(prev[schuleId] ?? {}), [monat]: altRaw },
      }));
      return;
    }

    const formData = new FormData();
    formData.set("schuleId", String(schuleId));
    formData.set("haushaltsjahrId", String(haushaltsjahrId));
    formData.set("monat", String(monat));
    formData.set("stellenanteil", String(neuNum));

    startTransition(async () => {
      const res = await saveMehrarbeitSchuleAction(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
        setWerte((prev) => ({
          ...prev,
          [schuleId]: { ...(prev[schuleId] ?? {}), [monat]: altRaw },
        }));
      } else {
        const formatiert = neuNum === 0 ? "" : formatVierStellen(neuNum);
        setMessage({ type: "success", text: "Gespeichert." });
        setTimeout(() => setMessage(null), 2000);
        // Lokal aktualisieren (kein refresh noetig — weniger Roundtrips)
        setWerte((prev) => ({
          ...prev,
          [schuleId]: { ...(prev[schuleId] ?? {}), [monat]: formatiert },
        }));
        setGespeichert((prev) => ({
          ...prev,
          [schuleId]: { ...(prev[schuleId] ?? {}), [monat]: formatiert },
        }));
      }
    });
  }

  function saveBemerkung(schuleId: number) {
    const formData = new FormData();
    formData.set("schuleId", String(schuleId));
    formData.set("haushaltsjahrId", String(haushaltsjahrId));
    formData.set("bemerkung", bemTexte[schuleId] ?? "");
    startTransition(async () => {
      const res = await saveMehrarbeitSchuleBemerkungAction(formData);
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Bemerkung gespeichert." });
        setTimeout(() => setMessage(null), 2000);
        setBemEditing(null);
      }
    });
  }

  // Spalten-Summen
  const monatsSummen = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    let s = 0;
    for (const sid of Object.keys(werte)) {
      const v = Number((werte[Number(sid)] ?? {})[m] ?? 0);
      if (Number.isFinite(v)) s += v;
    }
    return s;
  });
  const gesamtSumme = monatsSummen.reduce((a, b) => a + b, 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-[#1A1A1A]">
            Schulweite Mehrarbeit — Stellenanteile ({haushaltsjahrJahr})
          </h3>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Eingabe als VZE-Anteil pro Monat (z.B. 0,1500 fuer 0,15 Stellen). Tab oder Klick ausserhalb speichert.
          </p>
        </div>
        {isPending && <span className="text-xs text-[#6B7280]">Speichere...</span>}
      </div>

      {message && (
        <div className={`mb-3 px-3 py-2 rounded text-sm ${
          message.type === "success"
            ? "bg-green-50 border border-green-200 text-green-700"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#575756]">
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[140px]">
                Schule
              </th>
              {MONATE_KURZ.map((m, i) => (
                <th
                  key={m}
                  className={`text-right py-2 px-2 text-xs uppercase tracking-wider font-bold w-[80px] ${
                    i < 7 ? "text-[#575756]" : "text-[#009AC6]"
                  }`}
                >
                  {m}
                </th>
              ))}
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[85px] bg-[#F3F4F6]">
                Jahr Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {schulen.map((schule) => {
              const zeilenSumme = Array.from({ length: 12 }, (_, i) => {
                const v = Number((werte[schule.id] ?? {})[i + 1] ?? 0);
                return Number.isFinite(v) ? v : 0;
              }).reduce((a, b) => a + b, 0);

              return (
                <Fragment key={schule.id}>
                  <tr className="border-b border-[#E5E7EB]">
                    <td className="py-2 px-3">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                        style={{ backgroundColor: schule.farbe, color: ["#FBC900","#FEF7CC"].includes(schule.farbe.toUpperCase()) ? "#1A1A1A" : "white" }}
                      >
                        {schule.kurzname}
                      </span>
                      <div className="text-[11px] text-[#6B7280] mt-0.5">{schule.name}</div>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const monat = i + 1;
                      const raw = werte[schule.id]?.[monat] ?? "";
                      return (
                        <td key={monat} className="py-1 px-1 text-right">
                          <input
                            type="text"
                            value={raw}
                            onChange={(e) => {
                              setWerte((prev) => ({
                                ...prev,
                                [schule.id]: { ...(prev[schule.id] ?? {}), [monat]: e.target.value },
                              }));
                            }}
                            onBlur={(e) => saveZelle(schule.id, monat, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="0,0000"
                            className="w-full px-1 py-1 text-right tabular-nums text-sm border border-transparent hover:border-[#E5E7EB] focus:border-[#575756] focus:bg-white focus:outline-none rounded"
                          />
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right tabular-nums font-bold bg-[#F3F4F6]">
                      {zeilenSumme > 0 ? zeilenSumme.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"}
                    </td>
                  </tr>
                  {/* Bemerkungs-Zeile */}
                  <tr className="border-b border-[#F3F4F6] bg-[#FAFAFA]">
                    <td className="py-1 px-3 text-[11px] text-[#6B7280] align-top">Bemerkung:</td>
                    <td colSpan={13} className="py-1 px-2">
                      {bemEditing === schule.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={bemTexte[schule.id] ?? ""}
                            onChange={(e) => setBemTexte((p) => ({ ...p, [schule.id]: e.target.value }))}
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#575756]"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveBemerkung(schule.id);
                              if (e.key === "Escape") setBemEditing(null);
                            }}
                          />
                          <button
                            onClick={() => saveBemerkung(schule.id)}
                            className="px-3 py-1 text-xs bg-[#575756] text-white rounded hover:bg-[#474746]"
                          >
                            Speichern
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setBemEditing(schule.id)}
                          className="text-xs text-[#6B7280] hover:text-[#1A1A1A] text-left italic"
                        >
                          {bemTexte[schule.id] || "Bemerkung hinzufuegen..."}
                        </button>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#575756] bg-[#F3F4F6] font-bold">
              <td className="py-3 px-3">Summe (Stellen)</td>
              {monatsSummen.map((s, i) => (
                <td key={i} className="py-3 px-2 text-right tabular-nums">
                  {s > 0 ? s.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"}
                </td>
              ))}
              <td className="py-3 px-3 text-right tabular-nums bg-[#E5E7EB]">
                {gesamtSumme > 0 ? gesamtSumme.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-[#6B7280] mt-3">
        Pro Monat genau ein Wert je Schule. Leere/0 Zellen werden als &quot;keine Mehrarbeit&quot; gespeichert.
        Die Werte flieszen 1:1 in die Stellenist-Berechnung als pauschale Stellenanteile ein.
      </p>
    </Card>
  );
}
