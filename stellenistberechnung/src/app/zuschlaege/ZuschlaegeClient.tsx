"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { saveZuschlaege, copyZuschlaegeFromPreviousYear } from "./actions";
import { BookOpen, Copy, Save } from "lucide-react";

type ZuschlagArt = { id: number; bezeichnung: string; istStandard: boolean };
type ExistingZuschlag = {
  id: number;
  schuleId: number;
  haushaltsjahrId: number;
  zuschlagArtId: number;
  wert: string;
  zeitraum: string;
  bemerkung: string | null;
  bezeichnung: string;
  istStandard: boolean;
  sortierung: number;
};
type SchuleDaten = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
};

type Props = {
  schulen: SchuleDaten[];
  haushaltsjahre: Array<{ id: number; jahr: number }>;
  zuschlagArten: ZuschlagArt[];
  zuschlaegeByHjAndSchule: Record<number, Record<number, ExistingZuschlag[]>>;
  defaultHaushaltsjahrId: number;
  canEdit: boolean;
};

export function ZuschlaegeClient({
  schulen,
  haushaltsjahre,
  zuschlagArten,
  zuschlaegeByHjAndSchule,
  defaultHaushaltsjahrId,
  canEdit,
}: Props) {
  const router = useRouter();
  const [selectedHjId, setSelectedHjId] = useState(defaultHaushaltsjahrId);
  const [activeSchool, setActiveSchool] = useState(schulen[0]?.kurzname ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedHj = haushaltsjahre.find((hj) => hj.id === selectedHjId);
  const active = schulen.find((s) => s.kurzname === activeSchool);

  // Vorjahriges Haushaltsjahr ermitteln (nach Index)
  const currentIndex = haushaltsjahre.findIndex((hj) => hj.id === selectedHjId);
  const previousHj = currentIndex < haushaltsjahre.length - 1 ? haushaltsjahre[currentIndex + 1] : null;

  // Zuschlaege fuer aktive Schule + gewaehltes HJ
  const activeZuschlaege = active
    ? (zuschlaegeByHjAndSchule[selectedHjId]?.[active.id] ?? [])
    : [];

  // Zuschlaege des Vorjahres fuer aktive Schule
  const previousZuschlaege = active && previousHj
    ? (zuschlaegeByHjAndSchule[previousHj.id]?.[active.id] ?? [])
    : [];

  const getExistingWert = (zuschlagArtId: number): string => {
    const existing = activeZuschlaege.find((z) => z.zuschlagArtId === zuschlagArtId);
    return existing ? String(Number(existing.wert)) : "0";
  };

  const getExistingBemerkung = (zuschlagArtId: number): string => {
    const existing = activeZuschlaege.find((z) => z.zuschlagArtId === zuschlagArtId);
    return existing?.bemerkung ?? "";
  };

  const handleSave = async (formData: FormData) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveZuschlaege(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Zuschlaege gespeichert!" });
        router.refresh();
      }
    });
  };

  function handleCopyFromPreviousYear() {
    if (!active || !previousHj) return;

    const formData = new FormData();
    formData.set("schuleId", String(active.id));
    formData.set("zielHaushaltsjahrId", String(selectedHjId));
    formData.set("quellHaushaltsjahrId", String(previousHj.id));

    startTransition(async () => {
      const result = await copyZuschlaegeFromPreviousYear(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: `${result.kopiert} Zuschlag/Zuschlaege vom Haushaltsjahr ${previousHj.jahr} uebernommen.`,
        });
        router.refresh();
      }
    });
  }

  // Summe berechnen
  const summe = activeZuschlaege.reduce((acc, z) => acc + Number(z.wert), 0);

  return (
    <>
      {/* Rechtsquellen-Box */}
      <div className="mb-6 p-4 bg-[#F0F4F8] border border-[#D1D9E0] rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-[#5C82A5]" />
          <span className="text-sm font-bold text-[#575756]">Rechtsgrundlage</span>
        </div>
        <p className="text-sm text-[#575756] mb-2">
          Zuschlaege zum Grundstellenbedarf werden per Bewirtschaftungserlass des MSB NRW
          festgelegt und gelten jeweils fuer ein Haushaltsjahr.
        </p>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-[#575756]">
            <span className="font-medium">§ 3 FESchVO</span> — Ersatzschulfinanzierungsverordnung
          </span>
          <span className="text-sm text-[#575756]">
            <span className="font-medium">VV zu § 3 FESchVO</span> — Verwaltungsvorschriften
          </span>
          <span className="text-sm text-[#575756]">
            <span className="font-medium">Bewirtschaftungserlass</span> — Jaehrlicher Erlass des MSB NRW (konkretisiert die Zuschlagswerte)
          </span>
        </div>
      </div>

      {/* Haushaltsjahr-Auswahl */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[15px] font-medium text-[#1A1A1A]">Haushaltsjahr:</label>
        <select
          value={selectedHjId}
          onChange={(e) => {
            setSelectedHjId(Number(e.target.value));
            setMessage(null);
          }}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px]"
        >
          {haushaltsjahre.map((hj) => (
            <option key={hj.id} value={hj.id}>
              {hj.jahr}
            </option>
          ))}
        </select>
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

      {/* School Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {schulen.map((schule) => {
          const isActive = schule.kurzname === activeSchool;
          return (
            <button
              key={schule.kurzname}
              onClick={() => {
                setActiveSchool(schule.kurzname);
                setMessage(null);
              }}
              className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px ${
                isActive ? "text-[#1A1A1A] font-bold" : "text-[#6B7280] hover:text-[#1A1A1A]"
              }`}
              style={{ borderBottom: `3px solid ${isActive ? schule.farbe : "transparent"}` }}
            >
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: schule.farbe }} />
                {schule.kurzname}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <Card>
          <form action={handleSave}>
            <input type="hidden" name="schuleId" value={active.id} />
            <input type="hidden" name="haushaltsjahrId" value={selectedHjId} />

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: active.farbe }}
                />
                <h3 className="text-lg font-bold">
                  {active.name} — Haushaltsjahr {selectedHj?.jahr}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {/* Vom Vorjahr uebernehmen: nur wenn keine Daten und Vorjahr hat Daten */}
                {canEdit && activeZuschlaege.length === 0 && previousHj && previousZuschlaege.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyFromPreviousYear}
                    disabled={isPending}
                  >
                    <Copy size={14} className="mr-1.5" />
                    {isPending ? "Wird kopiert..." : `Vom HJ ${previousHj.jahr}`}
                  </Button>
                )}
                {canEdit && (
                  <Button type="submit" disabled={isPending}>
                    <Save size={14} className="mr-1.5" />
                    {isPending ? "Speichere..." : "Speichern"}
                  </Button>
                )}
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#575756]">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Zuschlagsart
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[150px]">
                    Stellen
                  </th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Bemerkung
                  </th>
                </tr>
              </thead>
              <tbody>
                {zuschlagArten.map((za, i) => (
                  <tr key={za.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <td className="py-3 px-4 text-[15px]">
                      {za.bezeichnung}
                      {za.istStandard && (
                        <span className="ml-2 text-xs bg-[#575756] text-white px-2 py-0.5 rounded">
                          Standard
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canEdit ? (
                        <input
                          type="number"
                          step="0.01"
                          name={`zuschlag_${za.id}`}
                          defaultValue={getExistingWert(za.id)}
                          className="w-full text-right tabular-nums border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]
                            focus:border-[#575756] focus:outline-none focus:ring-1 focus:ring-[#575756]"
                        />
                      ) : (
                        <span className="tabular-nums font-bold text-[15px]">
                          {Number(getExistingWert(za.id)).toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {canEdit ? (
                        <input
                          type="text"
                          name={`bemerkung_${za.id}`}
                          defaultValue={getExistingBemerkung(za.id)}
                          placeholder="Optional"
                          className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]
                            focus:border-[#575756] focus:outline-none focus:ring-1 focus:ring-[#575756]"
                        />
                      ) : (
                        <span className="text-sm text-[#6B7280]">
                          {getExistingBemerkung(za.id) || "\u2014"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#575756]">
                  <td className="py-3 px-4 text-[15px] font-bold">Summe</td>
                  <td
                    className="py-3 px-4 text-right text-lg tabular-nums font-bold"
                    style={{ color: active.farbe }}
                  >
                    {summe.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </form>
        </Card>
      )}
    </>
  );
}
