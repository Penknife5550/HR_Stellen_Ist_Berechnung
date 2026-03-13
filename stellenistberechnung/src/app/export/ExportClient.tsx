"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";

// ============================================================
// TYPES
// ============================================================

interface Haushaltsjahr {
  id: number;
  jahr: number;
  gesperrt: boolean;
}

interface Schule {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
}

interface Props {
  haushaltsjahre: Haushaltsjahr[];
  aktuellesHaushaltsjahrId: number | null;
  schulen: Schule[];
}

// ============================================================
// DOWNLOAD HELPER
// ============================================================

async function downloadFile(url: string, fallbackFilename: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const blob = await response.blob();

  // Filename aus Content-Disposition Header extrahieren
  const disposition = response.headers.get("Content-Disposition");
  let filename = fallbackFilename;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) filename = match[1];
  }

  // Download triggern
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

// ============================================================
// COMPONENT
// ============================================================

export function ExportClient({ haushaltsjahre, aktuellesHaushaltsjahrId, schulen }: Props) {
  const [haushaltsjahrId, setHaushaltsjahrId] = useState<number>(
    aktuellesHaushaltsjahrId ?? (haushaltsjahre[0]?.id ?? 0)
  );
  const [deputateSchuleId, setDeputateSchuleId] = useState<number>(0); // 0 = alle
  const [loading, setLoading] = useState<string | null>(null); // Welcher Button laedt
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDownload = async (
    endpoint: string,
    format: string,
    buttonKey: string,
    fallbackFilename: string
  ) => {
    if (!haushaltsjahrId) {
      setMessage({ type: "error", text: "Bitte zuerst ein Haushaltsjahr auswaehlen." });
      return;
    }

    setLoading(buttonKey);
    setMessage(null);

    try {
      let url = `/api/export/${endpoint}?haushaltsjahrId=${haushaltsjahrId}`;
      if (format) url += `&format=${format}`;
      if (endpoint === "deputate" && deputateSchuleId > 0) {
        url += `&schuleId=${deputateSchuleId}`;
      }

      await downloadFile(url, fallbackFilename);
      setMessage({ type: "success", text: `${fallbackFilename} wurde heruntergeladen.` });
    } catch (err) {
      console.error("Download-Fehler:", err);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Fehler beim Download.",
      });
    } finally {
      setLoading(null);
    }
  };

  const selectedHj = haushaltsjahre.find((h) => h.id === haushaltsjahrId);
  const hjLabel = selectedHj ? String(selectedHj.jahr) : "";

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

      {/* Haushaltsjahr-Auswahl */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-[#575756]">Haushaltsjahr:</label>
          <select
            value={haushaltsjahrId}
            onChange={(e) => setHaushaltsjahrId(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
          >
            {haushaltsjahre.map((hj) => (
              <option key={hj.id} value={hj.id}>
                {hj.jahr} {hj.gesperrt ? "(gesperrt)" : ""}
              </option>
            ))}
          </select>
          {haushaltsjahre.length === 0 && (
            <span className="text-sm text-[#6B7280]">
              Kein Haushaltsjahr vorhanden. Bitte zuerst in den Einstellungen anlegen.
            </span>
          )}
        </div>
      </div>

      {/* Export-Karten */}
      <div className="grid grid-cols-2 gap-6">
        {/* 1. Stellenplanuebersicht */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#6BAA24]/10 rounded-lg">
              <FileDown size={28} className="text-[#6BAA24]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Stellenplanuebersicht (Anlage 2a)
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Offizielles Format fuer die Bezirksregierung mit Stellensoll, Stellenist und Vergleich.
              </p>
              <div className="flex gap-3">
                <ExportButton
                  icon={<FileText size={14} />}
                  label="PDF"
                  loading={loading === "stellenplan-pdf"}
                  disabled={!haushaltsjahrId}
                  onClick={() =>
                    handleDownload("stellenplan", "pdf", "stellenplan-pdf", `Stellenplan_${hjLabel}.pdf`)
                  }
                />
                <ExportButton
                  icon={<FileSpreadsheet size={14} />}
                  label="Excel"
                  loading={loading === "stellenplan-excel"}
                  disabled={!haushaltsjahrId}
                  onClick={() =>
                    handleDownload("stellenplan", "excel", "stellenplan-excel", `Stellenplan_${hjLabel}.xlsx`)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Deputatsuebersicht */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#FBC900]/10 rounded-lg">
              <FileDown size={28} className="text-[#FBC900]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Deputatsuebersicht (intern)
              </h3>
              <p className="text-sm text-[#6B7280] mb-3">
                Monatliche Wochenstunden aller Lehrkraefte.
              </p>
              <div className="mb-3">
                <select
                  value={deputateSchuleId}
                  onChange={(e) => setDeputateSchuleId(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
                >
                  <option value={0}>Alle Schulen</option>
                  {schulen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.kurzname} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <ExportButton
                  icon={<FileText size={14} />}
                  label="PDF"
                  loading={loading === "deputate-pdf"}
                  disabled={!haushaltsjahrId}
                  onClick={() =>
                    handleDownload("deputate", "pdf", "deputate-pdf", `Deputate_${hjLabel}.pdf`)
                  }
                />
                <ExportButton
                  icon={<FileSpreadsheet size={14} />}
                  label="Excel"
                  loading={loading === "deputate-excel"}
                  disabled={!haushaltsjahrId}
                  onClick={() =>
                    handleDownload("deputate", "excel", "deputate-excel", `Deputate_${hjLabel}.xlsx`)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Schuelerzahlen */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#5C82A5]/10 rounded-lg">
              <FileDown size={28} className="text-[#5C82A5]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Schuelerzahlen-Uebersicht
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Schuelerzahlen aller Schulen nach Stichtag und Schuljahr.
              </p>
              <div className="flex gap-3">
                <ExportButton
                  icon={<FileSpreadsheet size={14} />}
                  label="Excel"
                  loading={loading === "schuelerzahlen-excel"}
                  disabled={!haushaltsjahrId}
                  onClick={() =>
                    handleDownload("schuelerzahlen", "", "schuelerzahlen-excel", `Schuelerzahlen_${hjLabel}.xlsx`)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Berechnungsnachweis */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-[#575756]/10 rounded-lg">
              <FileDown size={28} className="text-[#575756]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">
                Berechnungsnachweis
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                Detaillierter Berechnungsnachweis mit allen Zwischenschritten fuer die Pruefung.
              </p>
              <div className="flex gap-3">
                <ExportButton
                  icon={<FileText size={14} />}
                  label="PDF"
                  loading={loading === "nachweis-pdf"}
                  disabled={!haushaltsjahrId}
                  onClick={() =>
                    handleDownload("berechnungsnachweis", "", "nachweis-pdf", `Berechnungsnachweis_${hjLabel}.pdf`)
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EXPORT BUTTON
// ============================================================

function ExportButton({
  icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#575756]
        border border-[#E5E7EB] rounded-lg hover:bg-gray-50 disabled:opacity-50
        disabled:cursor-not-allowed transition-colors"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
