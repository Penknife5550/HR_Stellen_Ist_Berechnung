"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MONATE_KURZ } from "@/lib/constants";
import { markiereAlsVersendetAction, resetNachtragStatusAction } from "./actions";

type Aenderung = {
  id: number;
  lehrerId: number;
  lehrerName: string;
  personalnummer: string | null;
  stammschuleCode: string | null;
  schuleName: string | null;
  monat: number;
  deputatGesamtAlt: string | null;
  deputatGesamtNeu: string | null;
  geaendertAm: string;
  tatsaechlichesDatum: string | null;
  nachtragStatus: string | null;
  nachtragErstelltAm: string | null;
  nachtragErstelltVon: string | null;
};

interface NachtraegeClientProps {
  aenderungen: Aenderung[];
  haushaltsjahre: { id: number; jahr: number }[];
  aktuellesHaushaltsjahrId: number;
}

export function NachtraegeClient({
  aenderungen,
  aktuellesHaushaltsjahrId,
}: NachtraegeClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"alle" | "offen" | "erstellt" | "versendet">("alle");
  const [suchtext, setSuchtext] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Status-Zaehler (Single-Pass)
  const { offen, erstellt, versendet } = aenderungen.reduce(
    (acc, a) => {
      if (!a.nachtragStatus) acc.offen++;
      else if (a.nachtragStatus === "erstellt") acc.erstellt++;
      else if (a.nachtragStatus === "versendet") acc.versendet++;
      return acc;
    },
    { offen: 0, erstellt: 0, versendet: 0 }
  );

  // Filtern
  const gefiltert = aenderungen.filter((a) => {
    if (filter === "offen" && a.nachtragStatus) return false;
    if (filter === "erstellt" && a.nachtragStatus !== "erstellt") return false;
    if (filter === "versendet" && a.nachtragStatus !== "versendet") return false;
    if (suchtext) {
      const s = suchtext.toLowerCase();
      return (
        a.lehrerName.toLowerCase().includes(s) ||
        a.personalnummer?.toLowerCase().includes(s) ||
        a.stammschuleCode?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  async function handleDownload(aenderungId: number) {
    setLoadingId(aenderungId);
    try {
      const res = await fetch(`/api/export/nachtrag?aenderungId=${aenderungId}`);
      if (!res.ok) {
        setMessage({ type: "error", text: "Fehler beim Erstellen des Nachtrags." });
        return;
      }
      // DOCX-Download ausloesen
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "Nachtrag.docx";
      a.click();
      URL.revokeObjectURL(url);
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  async function handleMarkVersendet(formData: FormData) {
    const id = Number(formData.get("aenderungId"));
    setLoadingId(id);
    setMessage(null);
    const result = await markiereAlsVersendetAction(formData);
    setLoadingId(null);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Gespeichert." });
    }
  }

  async function handleReset(formData: FormData) {
    const id = Number(formData.get("aenderungId"));
    setLoadingId(id);
    setMessage(null);
    const result = await resetNachtragStatusAction(formData);
    setLoadingId(null);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Zurueckgesetzt." });
    }
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

      {/* Filter + Suche */}
      <Card className="mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1">
            {(["alle", "offen", "erstellt", "versendet"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
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
          <input
            type="text"
            placeholder="Suche nach Name, Personalnr., Schule..."
            value={suchtext}
            onChange={(e) => setSuchtext(e.target.value)}
            className="flex-1 min-w-[200px] border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
          />
          <span className="text-sm text-[#6B7280]">
            {gefiltert.length} von {aenderungen.length} Eintraegen
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

      {/* Tabelle */}
      <Card>
        {gefiltert.length === 0 ? (
          <div className="text-center py-12 text-[#6B7280]">
            <p className="text-lg font-medium">Keine Eintraege gefunden.</p>
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
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Monat
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
                    Datum
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
                {gefiltert.map((a, i) => {
                  const alt = Number(a.deputatGesamtAlt ?? 0);
                  const neu = Number(a.deputatGesamtNeu ?? 0);
                  const diff = neu - alt;
                  const isLoading = loadingId === a.id;

                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-[#E5E7EB] ${
                        i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-medium">
                        <a
                          href={`/deputate/${a.lehrerId}`}
                          className="text-[#575756] hover:underline"
                        >
                          {a.lehrerName}
                        </a>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[#6B7280]">
                        {a.personalnummer ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">{a.stammschuleCode ?? "—"}</td>
                      <td className="py-2.5 px-3">{MONATE_KURZ[a.monat - 1]}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums line-through text-[#E2001A]">
                        {alt.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#6B7280]">→</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#22C55E]">
                        {neu.toFixed(1)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                          diff > 0 ? "text-[#22C55E]" : diff < 0 ? "text-[#E2001A]" : "text-[#6B7280]"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[#6B7280]">
                        {a.tatsaechlichesDatum
                          ? new Date(a.tatsaechlichesDatum + "T00:00:00").toLocaleDateString("de-DE")
                          : a.geaendertAm}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(a.nachtragStatus)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant={a.nachtragStatus ? "secondary" : "primary"}
                            onClick={() => handleDownload(a.id)}
                            disabled={isLoading}
                            title="Nachtrag als Word-Dokument herunterladen"
                          >
                            {a.nachtragStatus ? "Erneut" : "Erstellen"}
                          </Button>
                          {a.nachtragStatus === "erstellt" && (
                            <form action={handleMarkVersendet}>
                              <input type="hidden" name="aenderungId" value={a.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                disabled={isLoading}
                                title="Als versendet markieren"
                              >
                                ✓
                              </Button>
                            </form>
                          )}
                          {a.nachtragStatus && (
                            <form action={handleReset}>
                              <input type="hidden" name="aenderungId" value={a.id} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                disabled={isLoading}
                                title="Status zuruecksetzen"
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
      </Card>
    </>
  );
}
