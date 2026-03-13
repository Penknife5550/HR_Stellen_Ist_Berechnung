"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, KPICard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { berechneStellensollAction } from "./actions";
import { Calculator, BookOpen, ExternalLink } from "lucide-react";

type StellensollDetail = {
  stufe: string;
  schueler: number;
  slr: number;
  rohErgebnis: number;
  truncErgebnis: number;
};

type ZuschlagDetail = {
  bezeichnung: string;
  wert: number;
};

type Ergebnis = {
  zeitraum: string;
  grundstellenGerundet: number;
  grundstellenSumme: number;
  zuschlaegeSumme: number;
  stellensoll: number;
  grundstellenDetails: StellensollDetail[];
  zuschlaege_details: ZuschlagDetail[] | null;
  vollzeitDeputat: number | null;
  deputatstundenrahmen: number | null;
  berechnetAm: Date;
};

type SchuleDaten = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
  schulform: string;
};

type PflichtstundenInfo = {
  vollzeitDeputat: number;
  rechtsgrundlage: string | null;
};

type Props = {
  schulen: SchuleDaten[];
  haushaltsjahre: Array<{ id: number; jahr: number }>;
  ergebnisseByHjAndSchule: Record<number, Record<number, Ergebnis[]>>;
  pflichtstundenBySchulform: Record<string, PflichtstundenInfo>;
  defaultHaushaltsjahrId: number;
  canEdit: boolean;
};

export function StellensollClient({
  schulen,
  haushaltsjahre,
  ergebnisseByHjAndSchule,
  pflichtstundenBySchulform,
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

  // Ergebnisse fuer aktive Schule + gewaehltes HJ
  const activeErgebnisse = active
    ? (ergebnisseByHjAndSchule[selectedHjId]?.[active.id] ?? [])
    : [];

  const handleBerechnung = () => {
    if (!confirm("Soll die Stellensoll-Berechnung jetzt durchgefuehrt werden? Vorherige Ergebnisse werden als veraltet markiert.")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await berechneStellensollAction(selectedHjId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: result.message ?? "Berechnung abgeschlossen!",
        });
        router.refresh();
      }
    });
  };

  return (
    <>
      {/* Haushaltsjahr-Auswahl + Berechnungs-Button */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[15px] font-medium text-[#1A1A1A]">Haushaltsjahr:</label>
        <select
          value={selectedHjId}
          onChange={(e) => {
            setSelectedHjId(Number(e.target.value));
            setMessage(null);
          }}
          disabled={isPending}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px] disabled:opacity-50"
        >
          {haushaltsjahre.map((hj) => (
            <option key={hj.id} value={hj.id}>
              {hj.jahr}
            </option>
          ))}
        </select>

        {canEdit && (
          <Button onClick={handleBerechnung} disabled={isPending}>
            <Calculator size={14} className="mr-1.5" />
            {isPending ? "Berechne..." : "Berechnung durchfuehren"}
          </Button>
        )}

        {message && (
          <span
            className={`text-sm font-medium ${
              message.type === "success" ? "text-[#3D6614]" : "text-[#8B0011]"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>

      {/* School Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {schulen.map((schule) => {
          const isActive = schule.kurzname === activeSchool;
          return (
            <button
              key={schule.kurzname}
              onClick={() => setActiveSchool(schule.kurzname)}
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

      {/* Ergebnisse */}
      {active && activeErgebnisse.length > 0 ? (
        activeErgebnisse.map((erg) => (
          <div key={erg.zeitraum} className="mb-8">
            {/* KPI-Uebersicht */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <KPICard
                label="Grundstellen"
                value={erg.grundstellenGerundet.toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                })}
                subtitle="Gerundet auf 1 Dezimalstelle"
                accentColor={active.farbe}
              />
              <KPICard
                label="Zuschlaege"
                value={erg.zuschlaegeSumme.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                })}
                subtitle={
                  erg.zuschlaege_details
                    ?.map((z) => z.bezeichnung.split(" ")[0])
                    .join(" + ") ?? "\u2014"
                }
                status="neutral"
              />
              <KPICard
                label="Stellensoll"
                value={erg.stellensoll.toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                })}
                subtitle="Grundstellen + Zuschlaege"
                status="success"
              />
            </div>

            {/* Schritt 1: Grundstellenberechnung */}
            <Card className="mb-6">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">
                Schritt 1: Grundstellenberechnung —{" "}
                <span className="text-[#6B7280]">
                  {erg.zeitraum === "jan-jul" ? "Januar - Juli" : "August - Dezember"}
                </span>
              </h3>

              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b-2 border-[#575756]">
                    <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                      Stufe
                    </th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                      Schueler
                    </th>
                    <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                      SLR
                    </th>
                    <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                      Roh-Ergebnis
                    </th>
                    <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#E2001A] font-bold">
                      Abgeschnitten (2 Dez.)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {erg.grundstellenDetails.map((d, i) => (
                    <tr key={i} className="border-b border-[#E5E7EB]">
                      <td className="py-3 px-3 text-[15px] font-medium">{d.stufe}</td>
                      <td className="py-3 px-3 text-[15px] text-right tabular-nums font-bold">
                        {d.schueler}
                      </td>
                      <td className="py-3 px-3 text-center text-[#6B7280]">÷</td>
                      <td className="py-3 px-3 text-[15px] text-right tabular-nums">
                        {d.slr.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center text-[#6B7280]">=</td>
                      <td className="py-3 px-3 text-[15px] text-right tabular-nums text-[#6B7280]">
                        {d.rohErgebnis.toFixed(4)}
                      </td>
                      <td className="py-3 px-3 text-center text-[#E2001A] font-bold">→</td>
                      <td className="py-3 px-3 text-[15px] text-right tabular-nums font-bold text-[#E2001A]">
                        {d.truncErgebnis.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#575756]">
                    <td colSpan={7} className="py-3 px-3 text-[15px] font-bold text-right">
                      Summe → gerundet auf 1 Dezimalstelle:
                    </td>
                    <td
                      className="py-3 px-3 text-xl text-right tabular-nums font-bold"
                      style={{ color: active.farbe }}
                    >
                      {erg.grundstellenGerundet.toFixed(1)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-[#575756]">
                <strong>Wichtig:</strong> Teilergebnisse werden nach 2 Dezimalstellen{" "}
                <strong>abgeschnitten</strong> (nicht gerundet!). Erst das Gesamtergebnis wird
                kaufmaennisch gerundet.
              </div>
            </Card>

            {/* Schritt 2: Deputatsstundenrahmen */}
            {erg.vollzeitDeputat !== null && erg.deputatstundenrahmen !== null && (
              <Card className="mb-6">
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">
                  Schritt 2: Deputatsstundenrahmen —{" "}
                  <span className="text-[#6B7280] font-normal">
                    Umrechnung VZAe in Pflichtstunden
                  </span>
                </h3>

                <div className="mb-4 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg">
                  <span className="text-sm text-[#575756]">
                    Vollzeitdeputat ({active?.schulform}): <strong>{erg.vollzeitDeputat.toLocaleString("de-DE", { minimumFractionDigits: 1 })} Std/Woche</strong>
                  </span>
                </div>

                <table className="w-full mb-4">
                  <thead>
                    <tr className="border-b-2 border-[#575756]">
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Grundstellen (VZAe)
                      </th>
                      <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Vollzeitdeputat
                      </th>
                      <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider font-bold"
                        style={{ color: active?.farbe }}>
                        Deputatsstunden/Woche
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#E5E7EB]">
                      <td className="py-4 px-3 text-xl text-right tabular-nums font-bold">
                        {erg.grundstellenGerundet.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-4 px-3 text-center text-[#6B7280] text-lg">&times;</td>
                      <td className="py-4 px-3 text-xl text-right tabular-nums font-bold">
                        {erg.vollzeitDeputat.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                      </td>
                      <td className="py-4 px-3 text-center text-[#6B7280] text-lg">=</td>
                      <td className="py-4 px-3 text-2xl text-right tabular-nums font-bold"
                        style={{ color: active?.farbe }}>
                        {erg.deputatstundenrahmen.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Legal-Hinweis */}
                <div className="p-3 bg-[#F0F4F8] border border-[#D1D9E0] rounded text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen size={14} className="text-[#5C82A5]" />
                    <span className="font-bold text-[#575756]">Rechtsgrundlage</span>
                  </div>
                  <p className="text-[#575756]">
                    VO zu § 93 Abs. 2 SchulG — BASS 11-11 Nr. 1, § 2 Abs. 1, Tabelle 2
                    (Woechentliche Pflichtstunden der Lehrkraefte).{" "}
                    {pflichtstundenBySchulform[active?.schulform ?? ""]?.rechtsgrundlage && (
                      <span className="text-[#6B7280]">
                        Konkret: {pflichtstundenBySchulform[active?.schulform ?? ""]?.rechtsgrundlage}
                      </span>
                    )}
                  </p>
                  <p className="text-[#6B7280] mt-1">
                    Die Pflichtstunden je Schulform sind unter{" "}
                    <a href="/pflichtstunden" className="text-[#5C82A5] hover:underline">
                      Pflichtstunden-Konfiguration
                    </a>{" "}
                    pflegbar.
                  </p>
                </div>
              </Card>
            )}

            {/* Schritt 3: Zuschlaege */}
            {erg.zuschlaege_details && erg.zuschlaege_details.length > 0 && (
              <Card>
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
                  Schritt 3: Zuschlaege
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#575756]">
                      <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Zuschlag
                      </th>
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Stellen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {erg.zuschlaege_details.map((z, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                        <td className="py-3 px-3 text-[15px]">{z.bezeichnung}</td>
                        <td className="py-3 px-3 text-[15px] text-right tabular-nums font-bold">
                          {z.wert.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#575756]">
                      <td className="py-3 px-3 text-[15px] font-bold">Summe Zuschlaege</td>
                      <td className="py-3 px-3 text-[15px] text-right tabular-nums font-bold">
                        {erg.zuschlaegeSumme.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: `${active.farbe}15` }}>
                      <td className="py-4 px-3 text-lg font-bold text-[#1A1A1A]">
                        Stellensoll = {erg.grundstellenGerundet.toFixed(1)} +{" "}
                        {erg.zuschlaegeSumme.toFixed(2)}
                      </td>
                      <td
                        className="py-4 px-3 text-2xl text-right tabular-nums font-bold"
                        style={{ color: active.farbe }}
                      >
                        {erg.stellensoll.toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </Card>
            )}
          </div>
        ))
      ) : (
        <Card>
          <div className="py-12 text-center text-[#6B7280]">
            <p className="text-lg mb-2">Noch keine Berechnung fuer Haushaltsjahr {selectedHj?.jahr} durchgefuehrt</p>
            <p className="text-sm">
              Stellen Sie sicher, dass Schuelerzahlen und SLR-Werte hinterlegt sind, und
              klicken Sie dann auf &quot;Berechnung durchfuehren&quot;.
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
