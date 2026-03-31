import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { MONATE_KURZ } from "@/lib/constants";
import {
  getLehrerDetail,
  getAktuellesHaushaltsjahr,
  getSchulen,
} from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { AenderungsHistorie } from "./AenderungsHistorie";

export const dynamic = "force-dynamic";

export default async function LehrerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lehrerId = parseInt(id, 10);
  if (isNaN(lehrerId)) notFound();

  const aktuellesHj = await getAktuellesHaushaltsjahr();
  if (!aktuellesHj) notFound();

  const [detail, schulen] = await Promise.all([
    getLehrerDetail(lehrerId, aktuellesHj.id),
    getSchulen(),
  ]);

  if (!detail) notFound();

  const { lehrer: l, monatsDaten, aenderungen } = detail;
  const schulFarben: Record<string, string> = {};
  for (const s of schulen) schulFarben[s.kurzname] = s.farbe;

  // Monatsdaten als Array (Index 0-11)
  const monateArr = Array.from({ length: 12 }, (_, i) => {
    const m = monatsDaten.find((d) => d.monat === i + 1);
    return m ?? null;
  });

  // Aenderungen nach Monat gruppieren
  const aenderungenByMonat: Record<number, typeof aenderungen> = {};
  for (const a of aenderungen) {
    if (!aenderungenByMonat[a.monat]) aenderungenByMonat[a.monat] = [];
    aenderungenByMonat[a.monat].push(a);
  }

  const hatGehaltsrelevante = aenderungen.some((a) => a.istGehaltsrelevant);

  return (
    <PageContainer>
      <Header
        title={l.vollname}
        subtitle={`Deputatsverlauf — Haushaltsjahr ${aktuellesHj.jahr} | Personalnr. ${l.personalnummer ?? "—"} | Stammschule: ${l.stammschuleCode ?? "—"}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deputate", href: "/deputate" },
          { label: l.vollname },
        ]}
      />

      {/* Gehaltsrelevante Warnung */}
      {hatGehaltsrelevante && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-[#E2001A] rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠</span>
            <div>
              <p className="font-bold text-[#E2001A] text-[15px]">
                Gehaltsrelevante Deputatsaenderung erkannt
              </p>
              <p className="text-sm text-[#575756] mt-1">
                Das Gesamtdeputat (PlannedWeek) dieser Lehrkraft hat sich geaendert.
                Dies hat Auswirkungen auf die Verguetung und muss mit der Gehaltsabrechnung
                abgestimmt werden. Rechtsgrundlage: <strong>§ 3 Abs. 1 FESchVO</strong> —
                Personalkosten werden auf Basis der tatsaechlich erteilten Stunden refinanziert.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monats-Timeline: Schulverteilung */}
      <Card className="mb-6">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
          Monatliche Deputatsverteilung nach Schulen
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Rechtsgrundlage: <strong>§ 3 Abs. 1 FESchVO</strong> — Das Stellenist wird aus den
          tatsaechlich in jedem Monat an der jeweiligen Schule erteilten Unterrichtsstunden berechnet.
          Jeder Monat zaehlt einzeln in die gewichtete Jahresberechnung.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[120px]">
                  Schule
                </th>
                {MONATE_KURZ.map((m, i) => (
                  <th
                    key={m}
                    className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-bold w-[60px] ${
                      i < 7 ? "text-[#575756]" : "text-[#009AC6]"
                    }`}
                  >
                    {m}
                    {aenderungenByMonat[i + 1]?.length ? (
                      <span className="ml-1 text-[#E2001A]">*</span>
                    ) : null}
                  </th>
                ))}
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[60px] bg-[#F3F4F6]">
                  Ø
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Gesamt-Zeile */}
              <tr className="border-b border-[#E5E7EB] font-bold">
                <td className="py-3 px-3 text-[15px]">Gesamt</td>
                {monateArr.map((m, i) => (
                  <td key={i} className="py-3 px-3 text-right tabular-nums text-[15px]">
                    {m ? Number(m.deputatGesamt).toFixed(1) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                ))}
                <td className="py-3 px-3 text-right tabular-nums text-[15px] bg-[#F3F4F6]">
                  {(() => {
                    const vals = monateArr.filter((m) => m && Number(m.deputatGesamt) > 0);
                    return vals.length > 0
                      ? (vals.reduce((s, m) => s + Number(m!.deputatGesamt), 0) / vals.length).toFixed(1)
                      : "—";
                  })()}
                </td>
              </tr>

              {/* GES */}
              <tr className="border-b border-[#E5E7EB]">
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: schulFarben["GES"] ?? "#6BAA24" }}>
                    GES
                  </span>
                </td>
                {monateArr.map((m, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums">
                    {m && Number(m.deputatGes) > 0 ? Number(m.deputatGes).toFixed(1) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right tabular-nums bg-[#F3F4F6]">—</td>
              </tr>

              {/* GYM */}
              <tr className="border-b border-[#E5E7EB]">
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: schulFarben["GYM"] ?? "#FBC900" }}>
                    GYM
                  </span>
                </td>
                {monateArr.map((m, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums">
                    {m && Number(m.deputatGym) > 0 ? Number(m.deputatGym).toFixed(1) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right tabular-nums bg-[#F3F4F6]">—</td>
              </tr>

              {/* BK */}
              <tr className="border-b border-[#E5E7EB]">
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: schulFarben["BK"] ?? "#5C82A5" }}>
                    BK
                  </span>
                </td>
                {monateArr.map((m, i) => (
                  <td key={i} className="py-2.5 px-3 text-right tabular-nums">
                    {m && Number(m.deputatBk) > 0 ? Number(m.deputatBk).toFixed(1) : <span className="text-[#D1D5DB]">—</span>}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right tabular-nums bg-[#F3F4F6]">—</td>
              </tr>

              {/* Periode/Term */}
              <tr className="bg-[#F9FAFB]">
                <td className="py-2 px-3 text-xs text-[#6B7280]">Periode</td>
                {monateArr.map((m, i) => (
                  <td key={i} className="py-2 px-3 text-right text-xs text-[#9CA3AF] tabular-nums">
                    {m?.untisTermId ?? "—"}
                  </td>
                ))}
                <td className="py-2 px-3 bg-[#F3F4F6]" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-6 text-xs text-[#6B7280]">
          <span>
            <span className="text-[#575756] font-bold">Jan-Jul</span> = Stichtag 15.10. Vorjahr
          </span>
          <span>
            <span className="text-[#009AC6] font-bold">Aug-Dez</span> = Stichtag 15.10. laufendes Jahr
          </span>
          {Object.keys(aenderungenByMonat).length > 0 && (
            <span>
              <span className="text-[#E2001A] font-bold">*</span> = Aenderung in diesem Monat
            </span>
          )}
        </div>
      </Card>

      {/* Aenderungshistorie (Client Component mit Inline-Datumsbearbeitung) */}
      <AenderungsHistorie
        aenderungen={aenderungen.map((a) => ({
          id: a.id,
          monat: a.monat,
          aenderungstyp: a.aenderungstyp,
          istGehaltsrelevant: a.istGehaltsrelevant,
          deputatGesamtAlt: a.deputatGesamtAlt,
          deputatGesamtNeu: a.deputatGesamtNeu,
          deputatGesAlt: a.deputatGesAlt,
          deputatGesNeu: a.deputatGesNeu,
          deputatGymAlt: a.deputatGymAlt,
          deputatGymNeu: a.deputatGymNeu,
          deputatBkAlt: a.deputatBkAlt,
          deputatBkNeu: a.deputatBkNeu,
          termIdAlt: a.termIdAlt,
          termIdNeu: a.termIdNeu,
          geaendertAm: a.geaendertAm.toLocaleDateString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          }),
          tatsaechlichesDatum: a.tatsaechlichesDatum,
          datumKorrigiertVon: a.datumKorrigiertVon,
        }))}
      />

      {/* Rechtsgrundlage */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> Gemaess <strong>§ 3 Abs. 1 FESchVO</strong> werden
        die Personalkosten auf Basis der tatsaechlich erteilten Unterrichtsstunden refinanziert.
        Bei Aenderungen des Deputats (PlannedWeek) aendert sich die Bezugsgrundlage fuer die
        Verguetung nach <strong>§ 107 Abs. 2 SchulG NRW</strong>.
        Verschiebungen zwischen Schulen (Verteilungsaenderungen) beeinflussen die
        schulspezifische Stellenistberechnung, nicht aber das Gesamtgehalt.
        Jeder Monat fliesst einzeln in die gewichtete Jahresberechnung ein:
        <strong> (Jan-Jul × 7 + Aug-Dez × 5) / 12</strong>.
      </div>
    </PageContainer>
  );
}
