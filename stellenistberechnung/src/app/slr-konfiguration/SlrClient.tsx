"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveSlrWerte, copySlrFromPreviousYear } from "./actions";
import { ExternalLink, Pencil, Copy, Save, X, BookOpen } from "lucide-react";

type SlrWert = {
  id: number;
  schuljahrId: number;
  schulformTyp: string;
  relation: string;
  quelle: string | null;
};

type Props = {
  schuljahre: Array<{ id: number; bezeichnung: string }>;
  slrBySchuljahr: Record<number, SlrWert[]>;
  defaultSchuljahrId: number;
  canEdit: boolean;
};

export function SlrClient({ schuljahre, slrBySchuljahr, defaultSchuljahrId, canEdit }: Props) {
  const router = useRouter();
  const [selectedSjId, setSelectedSjId] = useState(defaultSchuljahrId);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lokaler Edit-State fuer die SLR-Werte
  const [editValues, setEditValues] = useState<Array<{
    schulformTyp: string;
    relation: string;
    quelle: string;
  }>>([]);

  const slrWerte = slrBySchuljahr[selectedSjId] ?? [];
  const selectedSj = schuljahre.find((sj) => sj.id === selectedSjId);

  // Vorjahriges Schuljahr ermitteln (nach Index)
  const currentIndex = schuljahre.findIndex((sj) => sj.id === selectedSjId);
  const previousSj = currentIndex < schuljahre.length - 1 ? schuljahre[currentIndex + 1] : null;
  const previousSlrWerte = previousSj ? (slrBySchuljahr[previousSj.id] ?? []) : [];

  function startEditing() {
    setEditValues(
      slrWerte.map((slr) => ({
        schulformTyp: slr.schulformTyp,
        relation: Number(slr.relation).toLocaleString("de-DE", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        quelle: slr.quelle ?? "",
      }))
    );
    setIsEditing(true);
    setMessage(null);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditValues([]);
    setMessage(null);
  }

  function handleSave() {
    const formData = new FormData();
    formData.set("schuljahrId", String(selectedSjId));
    formData.set("count", String(editValues.length));

    for (let i = 0; i < editValues.length; i++) {
      formData.set(`typ_${i}`, editValues[i].schulformTyp);
      formData.set(`slr_${i}`, editValues[i].relation);
      formData.set(`quelle_${i}`, editValues[i].quelle);
    }

    startTransition(async () => {
      const result = await saveSlrWerte(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `${result.gespeichert} SLR-Wert(e) gespeichert.` });
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  function handleCopyFromPreviousYear() {
    if (!previousSj) return;

    const formData = new FormData();
    formData.set("zielSchuljahrId", String(selectedSjId));
    formData.set("quellSchuljahrId", String(previousSj.id));

    startTransition(async () => {
      const result = await copySlrFromPreviousYear(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `${result.kopiert} SLR-Wert(e) vom Schuljahr ${previousSj.bezeichnung} uebernommen.` });
        router.refresh();
      }
    });
  }

  function updateEditValue(index: number, field: "relation" | "quelle", value: string) {
    setEditValues((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  return (
    <>
      {/* Rechtsquellen-Box */}
      <div className="mb-6 p-4 bg-[#F0F4F8] border border-[#D1D9E0] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-[#5C82A5]" />
          <span className="text-sm font-bold text-[#575756]">Rechtsgrundlage</span>
        </div>
        <p className="text-sm text-[#575756] mb-2">
          Die Schueler-Lehrer-Relationen (SLR) werden jaehrlich per Verordnung festgelegt und gelten jeweils fuer ein Schuljahr.
        </p>
        <div className="flex flex-col gap-1">
          <a
            href="https://bass.schule.nrw/6218.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#5C82A5] hover:text-[#3D6280] hover:underline"
          >
            <ExternalLink size={14} />
            VO zu § 93 Abs. 2 SchulG (BASS 11-11 Nr. 1)
          </a>
          <a
            href="https://bass.schule.nrw/pdf/6218.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#5C82A5] hover:text-[#3D6280] hover:underline"
          >
            <ExternalLink size={14} />
            Aktuelle SLR-Werte als PDF (Anlage zur Verordnung)
          </a>
        </div>
      </div>

      {/* Schuljahr-Auswahl + Bearbeiten-Button */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[15px] font-medium text-[#1A1A1A]">Schuljahr:</label>
        <select
          value={selectedSjId}
          onChange={(e) => {
            setSelectedSjId(Number(e.target.value));
            setIsEditing(false);
            setMessage(null);
          }}
          disabled={isEditing}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px] disabled:opacity-50"
        >
          {schuljahre.map((sj) => (
            <option key={sj.id} value={sj.id}>
              {sj.bezeichnung}
            </option>
          ))}
        </select>

        {canEdit && !isEditing && slrWerte.length > 0 && (
          <Button variant="secondary" size="sm" onClick={startEditing}>
            <Pencil size={14} className="mr-1.5" />
            Bearbeiten
          </Button>
        )}
      </div>

      {/* Status-Meldung */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === "success"
            ? "bg-[#E8F5D6] border border-[#6BAA24] text-[#3D6614]"
            : "bg-[#FCE4E8] border border-[#E2001A] text-[#8B0011]"
        }`}>
          {message.text}
        </div>
      )}

      {/* SLR-Tabelle */}
      <Card>
        {slrWerte.length > 0 || isEditing ? (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schulform-Typ
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[180px]">
                  Schueler je Stelle
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Quelle
                </th>
              </tr>
            </thead>
            <tbody>
              {isEditing
                ? editValues.map((ev, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                      <td className="py-2 px-4 text-[15px] font-medium">{ev.schulformTyp}</td>
                      <td className="py-2 px-4 text-right">
                        <input
                          type="text"
                          value={ev.relation}
                          onChange={(e) => updateEditValue(i, "relation", e.target.value)}
                          className="w-[120px] text-right border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px]
                            tabular-nums font-bold focus:border-[#575756] focus:outline-none focus:ring-1 focus:ring-[#575756]"
                          placeholder="0,00"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={ev.quelle}
                          onChange={(e) => updateEditValue(i, "quelle", e.target.value)}
                          className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#6B7280]
                            focus:border-[#575756] focus:outline-none focus:ring-1 focus:ring-[#575756]"
                          placeholder={`VO zu § 93 Abs. 2 SchulG ${selectedSj?.bezeichnung}`}
                        />
                      </td>
                    </tr>
                  ))
                : slrWerte.map((slr, i) => (
                    <tr key={slr.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                      <td className="py-3 px-4 text-[15px] font-medium">{slr.schulformTyp}</td>
                      <td className="py-3 px-4 text-[15px] text-right tabular-nums font-bold">
                        {Number(slr.relation).toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6B7280]">
                        {slr.quelle ?? `VO zu § 93 Abs. 2 SchulG ${selectedSj?.bezeichnung}`}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center">
            <p className="text-[#6B7280] mb-4">
              Fuer das Schuljahr {selectedSj?.bezeichnung} sind keine SLR-Werte hinterlegt.
            </p>

            {/* Vom Vorjahr uebernehmen */}
            {canEdit && previousSj && previousSlrWerte.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleCopyFromPreviousYear}
                disabled={isPending}
              >
                <Copy size={16} className="mr-2" />
                {isPending ? "Wird kopiert..." : `Vom Schuljahr ${previousSj.bezeichnung} uebernehmen`}
              </Button>
            )}
          </div>
        )}

        {/* Speichern / Abbrechen im Edit-Modus */}
        {isEditing && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#E5E7EB] px-4 pb-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              <Save size={14} className="mr-1.5" />
              {isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelEditing}
              disabled={isPending}
            >
              <X size={14} className="mr-1.5" />
              Abbrechen
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
