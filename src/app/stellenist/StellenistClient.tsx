"use client";

import { useState, useTransition } from "react";
import { Card, KPICard } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { berechneStellenisteAction } from "./actions";
import { StellenistDrilldown } from "./StellenistDrilldown";

type Schule = { id: number; kurzname: string; farbe: string };

type MonatDetail = {
  monat: number;
  summeWochenstunden: number;
  summeWochenstundenPauschal?: number;
  tagesgenauKorrektur?: number;
  anzahlLehrer: number;
};
type MehrarbeitQuellen = {
  stunden?: number;         // Summe Lehrer-Mehrarbeit (Stunden)
  stellenanteile?: number;  // Summe schulweite Mehrarbeit (Stellen)
};
type SchulStellenist = {
  schuleId: number;
  schulKurzname: string;
  schulFarbe: string;
  zeitraeume: Array<{
    zeitraum: string;
    stellenistGesamt: string;
    stellenist: string;
    mehrarbeitStellen: string;
    monatsDurchschnittStunden: string | null;
    regelstundendeputat: string | null;
    berechnetAm: Date;
    monatsDetails?: MonatDetail[];
    hatTagesgenauKorrekturen?: boolean;
    mehrarbeitQuellen?: MehrarbeitQuellen;
  }>;
};

const MONATE_KURZ = ["Jan","Feb","Mrz","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

type SollKontext = { zeitraum: string; stellensoll: number; grundstellen: number; zuschlaege: number };
type SaKontext = { stellenGenehmigt: number; eurGenehmigt: number; anzahl: number };

interface StellenistClientProps {
  schulen: Schule[];
  schulStelleniste: SchulStellenist[];
  sollBySchule: Record<number, SollKontext[]>;
  saBySchule: Record<number, SaKontext>;
  haushaltsjahrId: number;
  hatDeputate: boolean;
  hatErgebnisse: boolean;
  latestSyncDatum: string | null;
}

export function StellenistClient({
  schulen,
  schulStelleniste,
  sollBySchule,
  saBySchule,
  haushaltsjahrId,
  hatDeputate,
  hatErgebnisse,
  latestSyncDatum,
}: StellenistClientProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    message?: string;
  } | null>(null);
  const [activeSchule, setActiveSchule] = useState<number | null>(
    schulStelleniste.length > 0 ? schulStelleniste[0].schuleId : schulen[0]?.id ?? null
  );
  const [expandedDrilldowns, setExpandedDrilldowns] = useState<Set<string>>(new Set());

  function toggleDrilldown(key: string) {
    setExpandedDrilldowns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleBerechnen() {
    setResult(null);
    startTransition(async () => {
      const res = await berechneStellenisteAction(haushaltsjahrId);
      setResult(res);
    });
  }

  const aktuelleSchulDaten = schulStelleniste.find((s) => s.schuleId === activeSchule);

  // Korrekturen aus den details JSONB der aktuellen Schule sammeln
  const korrigierteMonateAktuelleSchule: Array<{ monat: number; pauschal: number; effektiv: number; korrektur: number }> = [];
  if (aktuelleSchulDaten) {
    for (const zr of aktuelleSchulDaten.zeitraeume) {
      if (!zr.hatTagesgenauKorrekturen || !zr.monatsDetails) continue;
      for (const md of zr.monatsDetails) {
        const k = md.tagesgenauKorrektur ?? 0;
        if (Math.abs(k) < 0.001) continue;
        korrigierteMonateAktuelleSchule.push({
          monat: md.monat,
          pauschal: md.summeWochenstundenPauschal ?? md.summeWochenstunden,
          effektiv: md.summeWochenstunden,
          korrektur: k,
        });
      }
    }
  }

  return (
    <>
      {/* Berechnungs-Button */}
      <div className="flex items-center gap-4 mb-6">
        <Button onClick={handleBerechnen} disabled={isPending || !hatDeputate}>
          {isPending ? "Berechne..." : "Stellenist berechnen"}
        </Button>

        {!hatDeputate && (
          <span className="text-sm text-[#6B7280]">
            Keine Deputatsdaten vorhanden. Bitte zuerst n8n-Synchronisation durchfuehren.
          </span>
        )}

        {latestSyncDatum && (
          <span className="text-sm text-[#6B7280] ml-auto">
            Deputatsdaten vom {latestSyncDatum}
          </span>
        )}
      </div>

      {/* Ergebnis-Meldung */}
      {result && (
        <div
          className={`mb-6 p-4 rounded-lg text-sm ${
            result.error
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-green-50 border border-green-200 text-green-700"
          }`}
        >
          {result.error ?? result.message}
        </div>
      )}

      {/* Schul-Tabs */}
      {(schulStelleniste.length > 0 || schulen.length > 0) && (
        <div className="flex gap-2 mb-6">
          {schulen.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSchule(s.id)}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
              style={{
                backgroundColor: activeSchule === s.id ? s.farbe : "#F3F4F6",
                color: activeSchule === s.id ? "white" : "#575756",
              }}
            >
              {s.kurzname}
            </button>
          ))}
        </div>
      )}

      {/* Tagesgenaue Korrekturen — Hinweis-Card */}
      {korrigierteMonateAktuelleSchule.length > 0 && (
        <Card className="mb-6 border-l-4 border-[#E2001A]">
          <h3 className="text-base font-bold text-[#1A1A1A] mb-1">
            Tagesgenaue Korrekturen aktiv (§ 3 Abs. 1 FESchVO)
          </h3>
          <p className="text-xs text-[#6B7280] mb-3">
            In folgenden Monaten wurde das Schulsummen-Deputat tagesgewichtet (statt pauschal):
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {korrigierteMonateAktuelleSchule
              .sort((a, b) => a.monat - b.monat)
              .map((k) => (
                <div key={k.monat} className="bg-[#FAFAFA] border border-[#E5E7EB] rounded p-2">
                  <div className="text-xs font-bold text-[#1A1A1A]">{MONATE_KURZ[k.monat - 1]}</div>
                  <div className="text-xs text-[#6B7280]">
                    Pauschal: <span className="font-mono">{k.pauschal.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-[#E2001A] font-semibold">
                    Effektiv: <span className="font-mono">{k.effektiv.toFixed(2)}</span>
                    <span className="ml-1 text-[10px] font-normal">
                      ({k.korrektur >= 0 ? "+" : ""}{k.korrektur.toFixed(3)})
                    </span>
                  </div>
                </div>
              ))}
          </div>
          <p className="text-xs text-[#6B7280] mt-3">
            Die Aufschluesselung pro Lehrkraft ist auf der jeweiligen Detailseite (Deputate &rarr; Lehrer) sichtbar.
          </p>
        </Card>
      )}

      {/* KPI-Karten (wenn Ergebnisse vorhanden) */}
      {aktuelleSchulDaten && aktuelleSchulDaten.zeitraeume.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {aktuelleSchulDaten.zeitraeume.map((zr) => (
              <KPICard
                key={zr.zeitraum}
                label={`Stellenist ${zr.zeitraum === "jan-jul" ? "Jan-Jul" : "Aug-Dez"}`}
                value={Number(zr.stellenistGesamt).toLocaleString("de-DE", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                subtitle={`${zr.zeitraum === "jan-jul" ? "7" : "5"} Monate`}
                accentColor={aktuelleSchulDaten.schulFarbe}
              />
            ))}
            {aktuelleSchulDaten.zeitraeume.length === 2 && (() => {
              const janJul = aktuelleSchulDaten.zeitraeume.find(
                (z) => z.zeitraum === "jan-jul"
              );
              const augDez = aktuelleSchulDaten.zeitraeume.find(
                (z) => z.zeitraum === "aug-dez"
              );
              if (!janJul || !augDez) return null;
              const gewichtet =
                (Number(janJul.stellenistGesamt) * 7 +
                  Number(augDez.stellenistGesamt) * 5) /
                12;
              return (
                <KPICard
                  label="Jahresdurchschnitt"
                  value={gewichtet.toLocaleString("de-DE", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  subtitle="Gewichtet: (Jan-Jul x 7 + Aug-Dez x 5) / 12"
                  status="neutral"
                />
              );
            })()}
          </div>

          {/* Soll-Ist-Kontext: Stellensoll + Stellenanteile */}
          {(() => {
            const schuleId = aktuelleSchulDaten!.schuleId;
            const sollDaten = sollBySchule[schuleId];
            const saDaten = saBySchule[schuleId];
            if (!sollDaten || sollDaten.length === 0) return null;

            // Gewichteter Jahresdurchschnitt Soll
            const sollJanJul = sollDaten.find((s) => s.zeitraum === "jan-jul");
            const sollAugDez = sollDaten.find((s) => s.zeitraum === "aug-dez");
            const sollGewichtet = sollJanJul && sollAugDez
              ? (sollJanJul.stellensoll * 7 + sollAugDez.stellensoll * 5) / 12
              : sollDaten[0]?.stellensoll ?? 0;

            // Gewichteter Jahresdurchschnitt Ist
            const istJanJul = aktuelleSchulDaten!.zeitraeume.find((z) => z.zeitraum === "jan-jul");
            const istAugDez = aktuelleSchulDaten!.zeitraeume.find((z) => z.zeitraum === "aug-dez");
            const istGewichtet = istJanJul && istAugDez
              ? (Number(istJanJul.stellenistGesamt) * 7 + Number(istAugDez.stellenistGesamt) * 5) / 12
              : Number(aktuelleSchulDaten!.zeitraeume[0]?.stellenistGesamt ?? 0);

            const differenz = Math.round((sollGewichtet - istGewichtet) * 10) / 10;

            return (
              <Card className="mb-4 border-2 border-[#575756]">
                <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-3">
                  Soll-Ist-Vergleich (Jahresdurchschnitt)
                </h3>
                <div className="space-y-2 text-[15px]">
                  {/* Stellensoll */}
                  <div className="flex justify-between p-3 bg-blue-50 rounded border border-blue-200">
                    <div>
                      <span className="font-medium">Stellensoll</span>
                      <span className="text-xs text-[#6B7280] ml-2">
                        (Grundstellen + Zuschlaege)
                      </span>
                    </div>
                    <span className="font-bold tabular-nums text-lg text-blue-800">
                      {sollGewichtet.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </div>

                  {/* Stellenanteile-Detail */}
                  {saDaten && saDaten.anzahl > 0 && (
                    <div className="flex justify-between p-3 bg-[#F9FAFB] rounded ml-4 text-sm">
                      <div>
                        <span className="text-[#6B7280]">davon zusaetzliche Stellenanteile</span>
                        <span className="text-xs text-[#6B7280] ml-2">({saDaten.anzahl} genehmigt)</span>
                      </div>
                      <span className="font-bold tabular-nums text-blue-700">
                        {saDaten.stellenGenehmigt.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Stellen
                      </span>
                    </div>
                  )}
                  {saDaten && saDaten.eurGenehmigt > 0 && (
                    <div className="flex justify-between p-3 bg-[#F9FAFB] rounded ml-4 text-sm">
                      <span className="text-[#6B7280]">davon Geldleistungen</span>
                      <span className="font-bold tabular-nums text-emerald-700">
                        {saDaten.eurGenehmigt.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                  )}

                  {/* Stellenist */}
                  <div className="flex justify-between p-3 bg-[#E8F5D6] rounded border border-[#6BAA24]">
                    <div>
                      <span className="font-medium">Stellenist</span>
                      <span className="text-xs text-[#6B7280] ml-2">
                        (aus Deputaten + Mehrarbeit)
                      </span>
                    </div>
                    <span className="font-bold tabular-nums text-lg">
                      {istGewichtet.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </div>

                  {/* Differenz */}
                  <div className={`flex justify-between p-3 rounded border-2 ${
                    differenz >= 0
                      ? "bg-green-50 border-green-300"
                      : "bg-red-50 border-red-300"
                  }`}>
                    <div>
                      <span className="font-bold">Differenz (Soll - Ist)</span>
                      <span className="text-xs text-[#6B7280] ml-2">
                        {differenz >= 0 ? "Stellen frei" : "Ueberbesetzung"}
                      </span>
                    </div>
                    <span className={`font-bold tabular-nums text-xl ${
                      differenz >= 0 ? "text-green-700" : "text-red-700"
                    }`}>
                      {differenz >= 0 ? "+" : ""}{differenz.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })()}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756] mb-4">
            <strong>Rechtsgrundlage:</strong> Stellenistberechnung nach{" "}
            <strong>§ 3 Abs. 1 FESchVO</strong>.
            Regelstundendeputat nach <strong>§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG</strong>{" "}
            (siehe Stammdaten &quot;Regeldeputate&quot;).
            Gewichteter Jahresdurchschnitt: (Jan-Jul x 7 + Aug-Dez x 5) / 12.
          </div>

          {/* Details pro Zeitraum */}
          {aktuelleSchulDaten.zeitraeume.map((zr) => {
            const drilldownKey = `${aktuelleSchulDaten.schuleId}_${zr.zeitraum}`;
            const isExpanded = expandedDrilldowns.has(drilldownKey);
            const istKurzname = aktuelleSchulDaten.schulKurzname;
            return (
            <Card key={zr.zeitraum} className="mb-4 !p-0 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[#1A1A1A]">
                  {zr.zeitraum === "jan-jul" ? "Januar - Juli" : "August - Dezember"}
                </h3>
                <button
                  type="button"
                  onClick={() => toggleDrilldown(drilldownKey)}
                  className="text-xs px-3 py-1.5 rounded border border-[#D1D5DB] bg-white text-[#1A1A1A] hover:bg-[#F3F4F6] inline-flex items-center gap-1"
                  aria-expanded={isExpanded}
                  aria-label="Drilldown auf Lehrer-Ebene"
                >
                  <span>{isExpanded ? "▴" : "▾"}</span>
                  <span>Lehrer-Drilldown</span>
                </button>
              </div>
              <div className="space-y-2 text-[15px]">
                <div className="flex justify-between p-3 bg-blue-50 rounded border border-blue-200">
                  <span className="font-medium">Tatsaechliche Wochenstunden (Durchschnitt)</span>
                  <span className="font-bold tabular-nums text-lg">
                    {zr.monatsDurchschnittStunden
                      ? Number(zr.monatsDurchschnittStunden).toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }) + " Std."
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-[#F9FAFB] rounded">
                  <span>Regelstundendeputat</span>
                  <span className="font-bold tabular-nums">
                    {zr.regelstundendeputat
                      ? Number(zr.regelstundendeputat).toLocaleString("de-DE", {
                          minimumFractionDigits: 1,
                        })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-[#F9FAFB] rounded">
                  <span>Stellenist (ohne Mehrarbeit)</span>
                  <span className="font-bold tabular-nums">
                    {Number(zr.stellenist).toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 4,
                    })}
                  </span>
                </div>
                <div className="p-3 bg-[#F9FAFB] rounded">
                  <div className="flex justify-between">
                    <span>Mehrarbeit-Stellen (gesamt)</span>
                    <span className="font-bold tabular-nums">
                      {Number(zr.mehrarbeitStellen).toLocaleString("de-DE", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                  {zr.mehrarbeitQuellen && (
                    <div className="mt-2 pl-3 border-l-2 border-[#D1D5DB] text-xs text-[#6B7280] space-y-1">
                      <div className="flex justify-between">
                        <span>davon aus Lehrer-Stunden:</span>
                        <span className="tabular-nums">
                          {(zr.mehrarbeitQuellen.stunden ?? 0).toLocaleString("de-DE", {
                            minimumFractionDigits: 2, maximumFractionDigits: 2,
                          })} h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>davon aus Schul-Stellenanteilen:</span>
                        <span className="tabular-nums">
                          {(zr.mehrarbeitQuellen.stellenanteile ?? 0).toLocaleString("de-DE", {
                            minimumFractionDigits: 4, maximumFractionDigits: 4,
                          })} Stellen
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between p-3 bg-[#E8F5D6] rounded border border-[#6BAA24]">
                  <span className="font-bold">Stellenist Gesamt</span>
                  <span className="text-xl font-bold tabular-nums">
                    {Number(zr.stellenistGesamt).toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </span>
                </div>
              </div>
            </div>
            <StellenistDrilldown
              schuleKurzname={istKurzname}
              haushaltsjahrId={haushaltsjahrId}
              zeitraum={zr.zeitraum as "aug-dez" | "jan-jul"}
              open={isExpanded}
            />
            </Card>
            );
          })}
        </>
      ) : (
        <>
          {/* Berechnungsformel anzeigen wenn noch keine Ergebnisse */}
          <Card className="mb-6">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Berechnungsformel</h3>
            <div className="space-y-4 text-[15px]">
              <div className="p-4 bg-[#F9FAFB] rounded-lg">
                <div className="font-mono text-sm text-[#575756] mb-2">Jan-Jul:</div>
                <div className="text-lg">
                  Stellenist = Summe(Wochenstunden Jan-Jul) / (7 x Regeldeputat)
                </div>
              </div>
              <div className="p-4 bg-[#F9FAFB] rounded-lg">
                <div className="font-mono text-sm text-[#575756] mb-2">Aug-Dez:</div>
                <div className="text-lg">
                  Stellenist = Summe(Wochenstunden Aug-Dez) / (5 x Regeldeputat)
                </div>
              </div>
              <div className="p-4 bg-[#F9FAFB] rounded-lg">
                <div className="font-mono text-sm text-[#575756] mb-2">
                  Jahresdurchschnitt:
                </div>
                <div className="text-lg">
                  Gewichtet = (Jan-Jul x 7 + Aug-Dez x 5) / 12
                </div>
              </div>
            </div>
          </Card>

          <div className="p-4 bg-[#FEF7CC] border border-[#FBC900] rounded-lg text-sm text-[#575756] mb-4">
            <strong>Hinweis:</strong> Die Stellenist-Berechnung basiert auf den
            Deputatsdaten aus Untis.
            {!hatDeputate
              ? " Sobald die n8n-Synchronisation aktiv ist, koennen die Stelleniste berechnet werden."
              : " Klicken Sie oben auf 'Stellenist berechnen' um die Berechnung durchzufuehren."}
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
            <strong>Rechtsgrundlage:</strong> Stellenistberechnung nach{" "}
            <strong>§ 3 Abs. 1 FESchVO</strong>.
            Das Regelstundendeputat richtet sich nach{" "}
            <strong>§ 2 Abs. 1 VO zu § 93 Abs. 2 SchulG</strong>{" "}
            (siehe Stammdaten &quot;Regeldeputate&quot;).
            Stichtage gemaess <strong>§ 3 FESchVO</strong>:
            Jan-Jul = 15.10. Vorjahr, Aug-Dez = 15.10. laufendes Jahr.
          </div>
        </>
      )}
    </>
  );
}
