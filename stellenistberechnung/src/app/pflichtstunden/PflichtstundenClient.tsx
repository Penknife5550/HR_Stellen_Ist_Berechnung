"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { savePflichtstunden } from "./actions";
import { ExternalLink, Pencil, Save, X, BookOpen } from "lucide-react";

type PflichtstundenRow = {
  id: number;
  schulform: string;
  vollzeitDeputat: string;
  rechtsgrundlage: string | null;
};

type Props = {
  pflichtstunden: PflichtstundenRow[];
  canEdit: boolean;
};

export function PflichtstundenClient({ pflichtstunden, canEdit }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editValues, setEditValues] = useState<Array<{
    id: number;
    schulform: string;
    vollzeitDeputat: string;
    rechtsgrundlage: string;
  }>>([]);

  function startEditing() {
    setEditValues(
      pflichtstunden.map((ps) => ({
        id: ps.id,
        schulform: ps.schulform,
        vollzeitDeputat: Number(ps.vollzeitDeputat).toLocaleString("de-DE", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
        rechtsgrundlage: ps.rechtsgrundlage ?? "",
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
    formData.set("count", String(editValues.length));

    for (let i = 0; i < editValues.length; i++) {
      formData.set(`id_${i}`, String(editValues[i].id));
      formData.set(`deputat_${i}`, editValues[i].vollzeitDeputat);
      formData.set(`rechtsgrundlage_${i}`, editValues[i].rechtsgrundlage);
    }

    startTransition(async () => {
      const result = await savePflichtstunden(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `${result.gespeichert} Wert(e) gespeichert.` });
        setIsEditing(false);
        router.refresh();
      }
    });
  }

  function updateEditValue(index: number, field: "vollzeitDeputat" | "rechtsgrundlage", value: string) {
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
          Die Umrechnung von Stellen (VZAe) in Deputatsstunden erfolgt auf Grundlage der VO zu § 93 Abs. 2 SchulG — BASS 11-11 Nr. 1, § 2 Abs. 1, Tabelle 2 (Woechentliche Pflichtstunden der Lehrkraefte).
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
            href="https://recht.nrw.de/lmi/owa/br_bes_detail?sg=2&menu=0&bes_id=8044&anw_nr=2&aufgehoben=N&det_id=695453"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#5C82A5] hover:text-[#3D6280] hover:underline"
          >
            <ExternalLink size={14} />
            Volltext der Verordnung (recht.nrw.de)
          </a>
        </div>
      </div>

      {/* Bearbeiten-Button */}
      <div className="flex items-center gap-4 mb-6">
        {canEdit && !isEditing && pflichtstunden.length > 0 && (
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

      {/* Pflichtstunden-Tabelle */}
      <Card>
        {pflichtstunden.length > 0 || isEditing ? (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schulform
                </th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[180px]">
                  Pflichtstunden/Woche
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Rechtsgrundlage
                </th>
              </tr>
            </thead>
            <tbody>
              {isEditing
                ? editValues.map((ev, i) => (
                    <tr key={ev.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                      <td className="py-2 px-4 text-[15px] font-medium">{ev.schulform}</td>
                      <td className="py-2 px-4 text-right">
                        <input
                          type="text"
                          value={ev.vollzeitDeputat}
                          onChange={(e) => updateEditValue(i, "vollzeitDeputat", e.target.value)}
                          className="w-[120px] text-right border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px]
                            tabular-nums font-bold focus:border-[#575756] focus:outline-none focus:ring-1 focus:ring-[#575756]"
                          placeholder="0,0"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={ev.rechtsgrundlage}
                          onChange={(e) => updateEditValue(i, "rechtsgrundlage", e.target.value)}
                          className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#6B7280]
                            focus:border-[#575756] focus:outline-none focus:ring-1 focus:ring-[#575756]"
                          placeholder="BASS 11-11 Nr. 1, § 2 Abs. 1, Tabelle 2"
                        />
                      </td>
                    </tr>
                  ))
                : pflichtstunden.map((ps, i) => (
                    <tr key={ps.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                      <td className="py-3 px-4 text-[15px] font-medium">{ps.schulform}</td>
                      <td className="py-3 px-4 text-[15px] text-right tabular-nums font-bold">
                        {Number(ps.vollzeitDeputat).toLocaleString("de-DE", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6B7280]">
                        {ps.rechtsgrundlage ?? "\u2014"}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center">
            <p className="text-[#6B7280]">
              Keine Pflichtstunden-Werte hinterlegt.
            </p>
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

      {/* Info-Box: Verwendung */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-[#575756]">
        <strong>Hinweis:</strong> Diese Werte werden automatisch fuer die Berechnung des Deputatsstundenrahmens
        auf der Stellensoll-Seite verwendet. Die Zuordnung erfolgt ueber das Feld &quot;Schulform&quot;
        in den Schulstammdaten. Bei Aenderung der Verordnung muessen die Werte hier aktualisiert werden.
      </div>
    </>
  );
}
