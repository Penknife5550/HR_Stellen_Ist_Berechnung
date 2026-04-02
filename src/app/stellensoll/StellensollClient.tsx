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
  id?: number;
  bezeichnung: string;
  kuerzel?: string;
  typ?: string; // "A" | "A_106" | "B" | "C"
  wert: number;
  eurBetrag?: number | null;
  wahlrecht?: string | null; // "stelle" | "geld"
  zeitraum?: string;
  lehrerName?: string;
  aktenzeichen?: string;
  istIsoliert?: boolean;
  istDeputatswirksam?: boolean;
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
  regeldeputat: number;
  ergebnisse: Ergebnis[];
};

export function StellensollClient({
  schulen,
  hatErgebnisse,
  haushaltsjahrId,
}: {
  schulen: SchuleDaten[];
  hatErgebnisse: boolean;
  haushaltsjahrId: number;
}) {
  const [activeSchool, setActiveSchool] = useState(schulen[0]?.kurzname ?? "");
  const [berechne, setBerechne] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const active = schulen.find((s) => s.kurzname === activeSchool);

  const handleBerechnung = async () => {
    setBerechne(true);
    setMessage(null);
    const result = await berechneStellensollAction(haushaltsjahrId);
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <KPICard
                label="Deputatstundenrahmen"
                value={active.regeldeputat > 0
                  ? (erg.stellensoll * active.regeldeputat).toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }) + " Std."
                  : "—"
                }
                subtitle={active.regeldeputat > 0
                  ? `${erg.stellensoll.toLocaleString("de-DE", { minimumFractionDigits: 1 })} Stellen × ${active.regeldeputat.toLocaleString("de-DE", { minimumFractionDigits: 1 })} Std.`
                  : "Regeldeputat nicht konfiguriert"
                }
                accentColor={active.farbe}
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

            {/* Schritt 2: Stellenanteile / Zuschlaege (gruppiert nach Typ) */}
            {erg.zuschlaege_details && erg.zuschlaege_details.length > 0 && (
              <Card>
                <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
                  Schritt 2: Zusaetzliche Stellenanteile
                </h3>

                {(() => {
                  const all = erg.zuschlaege_details ?? [];
                  // Gruppierung: Typ A = Standard (oder Legacy ohne typ), A_106, B, C
                  const typA = all.filter((z) => z.typ === "A" || (!z.typ && !z.istIsoliert));
                  const typA106 = all.filter((z) => z.typ === "A_106" || (!z.typ && z.istIsoliert));
                  const typB = all.filter((z) => z.typ === "B");
                  const typC = all.filter((z) => z.typ === "C");

                  const gruppen = [
                    { key: "A", label: "Abschnitt 2 – Standardzuschlaege", desc: "Deputatswirksam, erhoehen Personalbedarfspauschale", rows: typA, farbe: "blue" },
                    { key: "A_106", label: "Abschnitt 4 – Sonderbedarfe § 106 Abs. 10", desc: "Deputatswirksam, isoliert (ohne Pauschalen-Wirkung)", rows: typA106, farbe: "purple" },
                    { key: "B", label: "Wahlleistungen (Geld oder Stelle)", desc: "Nur bei Stellenwahl: deputatswirksam", rows: typB, farbe: "orange" },
                    { key: "C", label: "Geldleistungen", desc: "Keine Stellenwirkung – nur EUR-Betrag", rows: typC, farbe: "emerald" },
                  ].filter((g) => g.rows.length > 0);

                  return (
                    <div className="space-y-4">
                      {gruppen.map((g) => {
                        const summeStellen = g.rows
                          .filter((z) => z.istDeputatswirksam !== false)
                          .reduce((s, z) => s + z.wert, 0);
                        const summeEur = g.rows
                          .filter((z) => z.eurBetrag && Number(z.eurBetrag) > 0)
                          .reduce((s, z) => s + Number(z.eurBetrag ?? 0), 0);

                        return (
                          <div key={g.key} className={`border border-${g.farbe}-200 rounded-lg overflow-hidden`}>
                            <div className={`bg-${g.farbe}-50 px-4 py-2 border-b border-${g.farbe}-200`}>
                              <div className={`text-sm font-bold text-${g.farbe}-800`}>{g.label}</div>
                              <div className="text-xs text-[#6B7280]">{g.desc}</div>
                            </div>
                            <table className="w-full text-[15px]">
                              <thead>
                                <tr className="border-b border-[#E5E7EB]">
                                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Stellenart</th>
                                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Lehrkraft</th>
                                  {g.key === "B" && (
                                    <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Wahl</th>
                                  )}
                                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                                    {g.key === "C" ? "EUR" : "Stellen"}
                                  </th>
                                  {(g.key === "B") && (
                                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">EUR</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((z, i) => (
                                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                                    <td className="py-2 px-3">
                                      <span className="flex items-center gap-2">
                                        {z.kuerzel && (
                                          <span className="text-[11px] font-mono font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{z.kuerzel}</span>
                                        )}
                                        <span>{z.bezeichnung}</span>
                                        {z.istDeputatswirksam === false && (
                                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded">kein Stellensoll</span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-[#6B7280]">{z.lehrerName ?? "—"}</td>
                                    {g.key === "B" && (
                                      <td className="py-2 px-3 text-center">
                                        {z.wahlrecht === "stelle" ? (
                                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Stelle</span>
                                        ) : z.wahlrecht === "geld" ? (
                                          <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Geld</span>
                                        ) : "—"}
                                      </td>
                                    )}
                                    <td className="py-2 px-3 text-right tabular-nums font-bold">
                                      {g.key === "C" ? (
                                        z.eurBetrag ? Number(z.eurBetrag).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"
                                      ) : z.istDeputatswirksam !== false ? (
                                        z.wert.toFixed(2)
                                      ) : (
                                        <span className="text-[#6B7280]">—</span>
                                      )}
                                    </td>
                                    {g.key === "B" && (
                                      <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-bold">
                                        {z.eurBetrag ? Number(z.eurBetrag).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className={`border-t border-${g.farbe}-200 bg-${g.farbe}-50`}>
                                  <td className={`py-2 px-3 font-bold text-sm text-${g.farbe}-800`} colSpan={g.key === "B" ? 3 : 2}>
                                    Summe
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold tabular-nums text-${g.farbe}-800`}>
                                    {g.key === "C" ? (
                                      summeEur > 0 ? summeEur.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"
                                    ) : (
                                      summeStellen > 0 ? summeStellen.toFixed(2) : "—"
                                    )}
                                  </td>
                                  {g.key === "B" && (
                                    <td className="py-2 px-3 text-right font-bold tabular-nums text-emerald-700">
                                      {summeEur > 0 ? summeEur.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"}
                                    </td>
                                  )}
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        );
                      })}

                      {/* Gesamt-Formel */}
                      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: `${active.farbe}15` }}>
                        <div className="flex justify-between items-center">
                          <div className="text-lg font-bold text-[#1A1A1A]">
                            Stellensoll = {erg.grundstellenGerundet.toFixed(1)} + {erg.zuschlaegeSumme.toFixed(2)}
                          </div>
                          <div className="text-2xl tabular-nums font-bold" style={{ color: active.farbe }}>
                            {erg.stellensoll.toFixed(1)}
                          </div>
                        </div>
                        <div className="text-xs text-[#6B7280] mt-1">
                          Nur deputatswirksame Stellenanteile (Typ A + A §106 + Typ B Stellenwahl) fliessen ins Stellensoll ein.
                          Geldleistungen (Typ B Geldwahl + Typ C) haben keinen Stellensoll-Effekt.
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
