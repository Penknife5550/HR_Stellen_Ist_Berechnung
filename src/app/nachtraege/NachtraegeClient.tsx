"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  markiereAlsVersendetAction,
  resetNachtragStatusAction,
} from "./actions";

type Wechsel = {
  lehrerId: number;
  lehrerName: string;
  personalnummer: string | null;
  stammschuleCode: string | null;
  schuleName: string | null;
  schulform: string | null;
  syAlt: number;
  termAlt: number;
  syNeu: number;
  termNeu: number;
  wirksamAb: string;
  tatsaechlichesDatum: string | null;
  effektivWirksamAb: string;
  hatKorrektur: boolean;
  gesamtAlt: string;
  gesamtNeu: string;
  deltaGesamt: string;
  status: string | null;
  erstelltAm: string | null;
  erstelltVon: string | null;
};

type Filter = "alle" | "offen" | "erstellt" | "versendet";

interface NachtraegeClientProps {
  wechsel: Wechsel[];
  jahr: number;
}

function tupelKey(w: Wechsel) {
  return `${w.lehrerId}_${w.syAlt}_${w.termAlt}_${w.syNeu}_${w.termNeu}`;
}

function tupelQuery(w: Wechsel) {
  const p = new URLSearchParams({
    lehrerId: String(w.lehrerId),
    syAlt: String(w.syAlt),
    termAlt: String(w.termAlt),
    syNeu: String(w.syNeu),
    termNeu: String(w.termNeu),
  });
  return p.toString();
}

export function NachtraegeClient({ wechsel, jahr }: NachtraegeClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("alle");
  const [suchtext, setSuchtext] = useState("");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  const { offen, erstellt, versendet } = wechsel.reduce(
    (acc, w) => {
      if (!w.status) acc.offen++;
      else if (w.status === "erstellt") acc.erstellt++;
      else if (w.status === "versendet") acc.versendet++;
      return acc;
    },
    { offen: 0, erstellt: 0, versendet: 0 },
  );

  const gefiltert = wechsel.filter((w) => {
    if (filter === "offen" && w.status) return false;
    if (filter === "erstellt" && w.status !== "erstellt") return false;
    if (filter === "versendet" && w.status !== "versendet") return false;
    if (suchtext) {
      const s = suchtext.toLowerCase();
      return (
        w.lehrerName.toLowerCase().includes(s) ||
        (w.personalnummer ?? "").toLowerCase().includes(s) ||
        (w.stammschuleCode ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  async function handleDownload(w: Wechsel) {
    const key = tupelKey(w);
    setLoadingKey(key);
    setMessage(null);
    let url: string | null = null;
    try {
      const res = await fetch(`/api/export/nachtrag?${tupelQuery(w)}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setMessage({
          type: "error",
          text: text || "Fehler beim Erstellen des Nachtrags.",
        });
        return;
      }
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        "Nachtrag.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setMessage({ type: "success", text: "Nachtrag erstellt — Datei wird heruntergeladen." });
      router.refresh();
    } catch (err) {
      console.error("handleDownload", err);
      setMessage({
        type: "error",
        text: "Netzwerkfehler — bitte erneut versuchen.",
      });
    } finally {
      if (url) URL.revokeObjectURL(url);
      setLoadingKey(null);
    }
  }

  async function handleMarkVersendet(formData: FormData) {
    const key = `${formData.get("lehrerId")}_${formData.get("syAlt")}_${formData.get("termAlt")}_${formData.get("syNeu")}_${formData.get("termNeu")}`;
    setLoadingKey(key);
    setMessage(null);
    const result = await markiereAlsVersendetAction(formData);
    setLoadingKey(null);
    if (result.error) setMessage({ type: "error", text: result.error });
    else setMessage({ type: "success", text: result.message ?? "Gespeichert." });
  }

  async function handleReset(formData: FormData) {
    if (!window.confirm("Status wirklich zuruecksetzen? Die Markierung 'Erstellt'/'Versendet' geht verloren.")) {
      return;
    }
    const key = `${formData.get("lehrerId")}_${formData.get("syAlt")}_${formData.get("termAlt")}_${formData.get("syNeu")}_${formData.get("termNeu")}`;
    setLoadingKey(key);
    setMessage(null);
    const result = await resetNachtragStatusAction(formData);
    setLoadingKey(null);
    if (result.error) setMessage({ type: "error", text: result.error });
    else setMessage({ type: "success", text: result.message ?? "Zurueckgesetzt." });
  }

  function getStatusBadge(status: string | null) {
    if (!status) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
          Offen
        </span>
      );
    }
    if (status === "erstellt") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
          Erstellt
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
        Versendet
      </span>
    );
  }

  return (
    <>
      {/* KPI-Karten */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-600">{offen}</div>
            <div className="text-sm text-[#6B7280] mt-1">Offen</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{erstellt}</div>
            <div className="text-sm text-[#6B7280] mt-1">Erstellt</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{versendet}</div>
            <div className="text-sm text-[#6B7280] mt-1">Versendet</div>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Status-Filter">
            {(["alle", "offen", "erstellt", "versendet"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                aria-controls="nachtraege-panel"
                onClick={() => setFilter(f)}
                className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                  filter === f
                    ? "bg-[#575756] text-white"
                    : "bg-[#F3F4F6] text-[#575756] hover:bg-[#E5E7EB]"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "offen" && ` (${offen})`}
                {f === "erstellt" && ` (${erstellt})`}
                {f === "versendet" && ` (${versendet})`}
              </button>
            ))}
          </div>
          <label htmlFor="nachtraege-suche" className="sr-only">
            Suche nach Lehrkraft, Personalnummer oder Schule
          </label>
          <input
            id="nachtraege-suche"
            type="text"
            placeholder="Suche nach Name, Personalnr., Schule..."
            value={suchtext}
            onChange={(e) => setSuchtext(e.target.value)}
            className="flex-1 min-w-[200px] min-h-[44px] border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
          />
          <span className="text-sm text-[#6B7280]">
            {gefiltert.length} von {wechsel.length} Eintraegen
          </span>
        </div>
      </Card>

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

      <div id="nachtraege-panel" role="tabpanel"><Card>
        {gefiltert.length === 0 ? (
          <div className="text-center py-12 text-[#6B7280]">
            <p className="text-lg font-medium">
              {wechsel.length === 0
                ? `Keine gehaltsrelevanten Wertwechsel im Haushaltsjahr ${jahr}.`
                : "Keine Eintraege im aktuellen Filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#575756]">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Lehrkraft
                  </th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Personalnr.
                  </th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Schule
                  </th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Alt
                  </th>
                  <th className="text-center py-2 px-3" />
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Neu
                  </th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Diff
                  </th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Wirksam ab
                  </th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Status
                  </th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {gefiltert.map((w, i) => {
                  const alt = Number(w.gesamtAlt ?? 0);
                  const neu = Number(w.gesamtNeu ?? 0);
                  const diff = neu - alt;
                  const key = tupelKey(w);
                  const isLoading = loadingKey === key;
                  const datum = new Date(
                    w.effektivWirksamAb + "T00:00:00",
                  ).toLocaleDateString("de-DE");

                  return (
                    <tr
                      key={key}
                      className={`border-b border-[#E5E7EB] ${
                        i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-medium">
                        <a
                          href={`/deputate/${w.lehrerId}`}
                          className="text-[#575756] hover:underline"
                        >
                          {w.lehrerName}
                        </a>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[#6B7280]">
                        {w.personalnummer ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {w.stammschuleCode ?? "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums line-through text-[#E2001A]">
                        {alt.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#6B7280]">
                        →
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#22C55E]">
                        {neu.toFixed(1)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                          diff > 0
                            ? "text-[#22C55E]"
                            : diff < 0
                              ? "text-[#E2001A]"
                              : "text-[#6B7280]"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[#6B7280]">
                        {datum}
                        {w.hatKorrektur && (
                          <span
                            className="ml-1 text-[#FBC900]"
                            title="Stichtag durch HR korrigiert"
                            aria-label="Stichtag durch HR korrigiert"
                            role="img"
                          >
                            ✎
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(w.status)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant={w.status ? "secondary" : "primary"}
                            onClick={() => handleDownload(w)}
                            disabled={isLoading}
                            title="Nachtrag als Word-Dokument herunterladen"
                          >
                            {w.status ? "Erneut" : "Erstellen"}
                          </Button>
                          {w.status === "erstellt" && (
                            <form action={handleMarkVersendet}>
                              <input type="hidden" name="lehrerId" value={w.lehrerId} />
                              <input type="hidden" name="syAlt" value={w.syAlt} />
                              <input type="hidden" name="termAlt" value={w.termAlt} />
                              <input type="hidden" name="syNeu" value={w.syNeu} />
                              <input type="hidden" name="termNeu" value={w.termNeu} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                disabled={isLoading}
                                title="Als versendet markieren"
                                aria-label="Als versendet markieren"
                              >
                                ✓
                              </Button>
                            </form>
                          )}
                          {w.status && (
                            <form action={handleReset}>
                              <input type="hidden" name="lehrerId" value={w.lehrerId} />
                              <input type="hidden" name="syAlt" value={w.syAlt} />
                              <input type="hidden" name="termAlt" value={w.termAlt} />
                              <input type="hidden" name="syNeu" value={w.syNeu} />
                              <input type="hidden" name="termNeu" value={w.termNeu} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                disabled={isLoading}
                                title="Status zuruecksetzen"
                                aria-label="Status zuruecksetzen"
                              >
                                ↺
                              </Button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card></div>
    </>
  );
}
