"use client";

import { useState } from "react";
import { Card, KPICard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { berechneStellensollAction } from "./actions";

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
  berechnetAm: Date;
};

type SchuleDaten = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
  ergebnisse: Ergebnis[];
};

export function StellensollClient({
  schulen,
  hatErgebnisse,
}: {
  schulen: SchuleDaten[];
  hatErgebnisse: boolean;
}) {
  const [activeSchool, setActiveSchool] = useState(schulen[0]?.kurzname ?? "");
  const [berechne, setBerechne] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const active = schulen.find((s) => s.kurzname === activeSchool);

  const handleBerechnung = async () => {
    setBerechne(true);
    setMessage(null);
    const result = await berechneStellensollAction();
    setBerechne(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({
        type: "success",
        text: result.message ?? "Berechnung abgeschlossen!",
      });
    }
  };

  return (
    <>
      {/* Berechnungs-Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={handleBerechnung} disabled={berechne}>
          {berechne ? "Berechne..." : "Berechnung durchfuehren"}
        </Button>
        {message && (
          <span
            className={`text-sm font-medium ${
              message.type === "success" ? "text-green-700" : "text-red-700"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>

      {/* School Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6" role="tablist">
        {schulen.map((schule) => {
          const isActive = schule.kurzname === activeSchool;
          return (
            <button
              key={schule.kurzname}
              role="tab"
              aria-selected={isActive}
              aria-controls="stellensoll-panel"
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
      <div id="stellensoll-panel" role="tabpanel">
      {active && active.ergebnisse.length > 0 ? (
        active.ergebnisse.map((erg) => (
          <div key={erg.zeitraum} className="mb-8">
            {/* KPI-Uebersicht */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                    .join(" + ") ?? "—"
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

              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-[#575756] mb-3">
                <strong>Wichtig:</strong> Teilergebnisse werden nach 2 Dezimalstellen{" "}
                <strong>abgeschnitten</strong> (nicht gerundet!). Erst das Gesamtergebnis wird
                kaufmaennisch gerundet.
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-[#575756]">
                <strong>Rechtsgrundlage:</strong> Grundstellenberechnung nach{" "}
                <strong>§ 3 Abs. 1 FESchVO</strong> i.V.m.{" "}
                <strong>§ 107 Abs. 1 SchulG NRW</strong>.
                Rundungsregel nach <strong>Nr. 7.1.1 AVO-RL (BASS 11-11 Nr. 1.1)</strong> und{" "}
                <strong>§ 7 Abs. 1 Satz 2 VO zu § 93 Abs. 2 SchulG</strong>:
                Einzelwerte nach 2 Dezimalstellen abbrechen, Gesamtzahl auf 1 Dezimalstelle
                kaufmaennisch runden. Die ganzzahlige Aufrundung nach § 7 Abs. 3 findet bei
                Ersatzschulen nicht statt.
              </div>
            </Card>

            {/* Schritt 2: Zuschlaege */}
            {erg.zuschlaege_details && erg.zuschlaege_details.length > 0 && (
              <Card>
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
                  Schritt 2: Zuschlaege
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
            <p className="text-lg mb-2">Noch keine Berechnung durchgefuehrt</p>
            <p className="text-sm">
              Stellen Sie sicher, dass Schuelerzahlen und SLR-Werte hinterlegt sind, und
              klicken Sie dann auf &quot;Berechnung durchfuehren&quot;.
            </p>
          </div>
        </Card>
      )}
      </div>
    </>
  );
}
