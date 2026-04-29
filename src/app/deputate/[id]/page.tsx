import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { MONATE_KURZ } from "@/lib/constants";
import {
  getLehrerDetail,
  getSchulen,
} from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";
import { notFound } from "next/navigation";
import { PeriodenModellCard } from "./PeriodenModellCard";
import {
  berechneLehrerDeputatEffektiv,
  adaptiereEchteAenderungen,
} from "@/lib/berechnungen/deputatEffektiv";

export const dynamic = "force-dynamic";

export default async function LehrerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const lehrerId = parseInt(id, 10);
  if (isNaN(lehrerId)) notFound();

  const { hj: aktuellesHj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);
  if (!aktuellesHj) notFound();

  const [detail, schulen] = await Promise.all([
    getLehrerDetail(lehrerId, aktuellesHj.id),
    getSchulen(),
  ]);

  if (!detail) notFound();

  const { lehrer: l, statistik, monatsDaten, periodenverlauf, echteAenderungen } = detail;
  const schulFarben: Record<string, string> = {};
  for (const s of schulen) schulFarben[s.kurzname] = s.farbe;

  // Helle Hintergrundfarben brauchen dunklen Text fuer ausreichenden Kontrast
  const needsDarkText = (color: string) => ['#FBC900', '#FEF7CC'].includes(color.toUpperCase());

  // Monatsdaten als Array (Index 0-11)
  const monateArr = Array.from({ length: 12 }, (_, i) => {
    const m = monatsDaten.find((d) => d.monat === i + 1);
    return m ?? null;
  });

  // Aenderungen aus Periodenmodell + Korrektur-Layer (v0.7+).
  // Pauschalwert: Sieger-Wert aus deputat_monatlich (parallel mitgeschrieben).
  // Effektivwert: tagesgenau aus dem Periodenmodell, korrigiert wo der
  // Sachbearbeiter ein abweichendes Datum gesetzt hat.
  const adaptierteAenderungen = adaptiereEchteAenderungen(echteAenderungen, aktuellesHj.jahr);

  // Aenderungen nach Monat gruppieren (fuer "*"-Marker in der Spaltenkopf)
  const aenderungenByMonat: Record<number, typeof adaptierteAenderungen> = {};
  for (const a of adaptierteAenderungen) {
    if (!aenderungenByMonat[a.monat]) aenderungenByMonat[a.monat] = [];
    aenderungenByMonat[a.monat].push(a);
  }

  // Gehaltsrelevant = Gesamt-Wert aendert sich
  const hatGehaltsrelevante = adaptierteAenderungen.some(
    (a) => Math.abs(Number(a.deputatGesamtAlt ?? 0) - Number(a.deputatGesamtNeu ?? 0)) > 0.001,
  );

  // Taggenaue Deputate berechnen (pauschal + Korrektur aus tatsaechlichesDatum)
  const effektivByMonat = berechneLehrerDeputatEffektiv(
    monatsDaten.map((m) => ({
      monat: m.monat,
      deputatGesamt: m.deputatGesamt,
      deputatGes: m.deputatGes,
      deputatGym: m.deputatGym,
      deputatBk: m.deputatBk,
    })),
    adaptierteAenderungen,
    aktuellesHj.jahr,
  );

  const korrigierteMonate = Array.from(effektivByMonat.values()).filter((e) => e.hatKorrektur);

  // Format-Helfer fuer Tooltip: zeigt Pauschal- und Effektiv-Wert + Herleitung
  const formatTooltip = (col: "gesamt" | "ges" | "gym" | "bk", monat: number): string => {
    const e = effektivByMonat.get(monat);
    if (!e || !e.hatKorrektur) return "";
    const parts: string[] = [];
    parts.push(`Pauschal (Untis): ${e.pauschal[col].toFixed(3)}`);
    parts.push(`Effektiv (taggenau): ${e.effektiv[col].toFixed(3)}`);
    for (const a of e.aenderungen) {
      if (Math.abs(a.alt[col] - a.neu[col]) < 0.001) continue;
      parts.push(
        `Aenderung am ${a.datum}: ${a.alt[col]} x ${a.tageVor}T + ${a.neu[col]} x ${a.tageNach}T / ${e.monatsTage}T = ${(a.anteilAlt[col] + a.anteilNeu[col]).toFixed(3)}`
      );
    }
    return parts.join("\n");
  };

  // Formatierte Monatszelle (mit "*" wenn taggenau korrigiert)
  const cell = (col: "gesamt" | "ges" | "gym" | "bk", monat: number, fallback: number): string => {
    const e = effektivByMonat.get(monat);
    if (!e || fallback === 0) return fallback === 0 ? "—" : fallback.toFixed(2);
    const val = e.hatKorrektur ? e.effektiv[col] : e.pauschal[col];
    return val.toFixed(2);
  };

  return (
    <PageContainer>
      <Header
        title={l.vollname}
        subtitle={`Deputatsverlauf — Haushaltsjahr ${aktuellesHj.jahr} | Personalnr. ${l.personalnummer ?? "—"} | Stammschule: ${l.stammschuleCode ?? "—"} | Code: ${
          statistik ? `${statistik.code} — ${statistik.bezeichnung}` : "—"
        }`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deputate", href: "/deputate" },
          { label: l.vollname },
        ]}
      />

      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
        <a
          href={`/api/export/lehrer-detail?lehrerId=${lehrerId}&hj=${aktuellesHj.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-[#009AC6] text-white hover:bg-[#0086AC] transition-colors"
          title={`Detailseite als PDF (DIN A4) — Nachweis-Dokument fuer die Bezirksregierung`}
        >
          <span>📄</span>
          <span>Als PDF (Nachweis)</span>
        </a>
        {hjOptions.length > 1 && (
          <HaushaltsjahrSelector options={hjOptions} selectedJahr={aktuellesHj.jahr} />
        )}
      </div>

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
                {monateArr.map((m, i) => {
                  const monat = i + 1;
                  const e = effektivByMonat.get(monat);
                  const korr = e?.hatKorrektur ?? false;
                  return (
                    <td
                      key={i}
                      className={`py-3 px-3 text-right tabular-nums text-[15px] ${korr ? "text-[#E2001A]" : ""}`}
                      title={korr ? formatTooltip("gesamt", monat) : undefined}
                    >
                      {m
                        ? cell("gesamt", monat, Number(m.deputatGesamt))
                        : <span className="text-[#D1D5DB]">—</span>}
                      {korr && <sup className="text-[10px] text-[#E2001A] ml-0.5">*</sup>}
                    </td>
                  );
                })}
                <td className="py-3 px-3 text-right tabular-nums text-[15px] bg-[#F3F4F6]">
                  {(() => {
                    const vals: number[] = [];
                    for (const m of monateArr) {
                      if (!m) continue;
                      const e = effektivByMonat.get(m.monat);
                      const v = e?.hatKorrektur ? e.effektiv.gesamt : Number(m.deputatGesamt);
                      if (v > 0) vals.push(v);
                    }
                    return vals.length > 0
                      ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)
                      : "—";
                  })()}
                </td>
              </tr>

              {/* GES */}
              <tr className="border-b border-[#E5E7EB]">
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: schulFarben["GES"] ?? "#6BAA24", color: needsDarkText(schulFarben["GES"] ?? "#6BAA24") ? "#1A1A1A" : "white" }}>
                    GES
                  </span>
                </td>
                {monateArr.map((m, i) => {
                  const monat = i + 1;
                  const e = effektivByMonat.get(monat);
                  const korr = e?.hatKorrektur && Math.abs(e.korrektur.ges) > 0.001;
                  const raw = m ? Number(m.deputatGes) : 0;
                  if (raw === 0 && !korr) return <td key={i} className="py-2.5 px-3 text-right tabular-nums"><span className="text-[#D1D5DB]">—</span></td>;
                  return (
                    <td key={i} className={`py-2.5 px-3 text-right tabular-nums ${korr ? "text-[#E2001A]" : ""}`} title={korr ? formatTooltip("ges", monat) : undefined}>
                      {cell("ges", monat, raw)}
                      {korr && <sup className="text-[10px] text-[#E2001A] ml-0.5">*</sup>}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right tabular-nums bg-[#F3F4F6]">—</td>
              </tr>

              {/* GYM */}
              <tr className="border-b border-[#E5E7EB]">
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: schulFarben["GYM"] ?? "#FBC900", color: needsDarkText(schulFarben["GYM"] ?? "#FBC900") ? "#1A1A1A" : "white" }}>
                    GYM
                  </span>
                </td>
                {monateArr.map((m, i) => {
                  const monat = i + 1;
                  const e = effektivByMonat.get(monat);
                  const korr = e?.hatKorrektur && Math.abs(e.korrektur.gym) > 0.001;
                  const raw = m ? Number(m.deputatGym) : 0;
                  if (raw === 0 && !korr) return <td key={i} className="py-2.5 px-3 text-right tabular-nums"><span className="text-[#D1D5DB]">—</span></td>;
                  return (
                    <td key={i} className={`py-2.5 px-3 text-right tabular-nums ${korr ? "text-[#E2001A]" : ""}`} title={korr ? formatTooltip("gym", monat) : undefined}>
                      {cell("gym", monat, raw)}
                      {korr && <sup className="text-[10px] text-[#E2001A] ml-0.5">*</sup>}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right tabular-nums bg-[#F3F4F6]">—</td>
              </tr>

              {/* BK */}
              <tr className="border-b border-[#E5E7EB]">
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: schulFarben["BK"] ?? "#5C82A5", color: needsDarkText(schulFarben["BK"] ?? "#5C82A5") ? "#1A1A1A" : "white" }}>
                    BK
                  </span>
                </td>
                {monateArr.map((m, i) => {
                  const monat = i + 1;
                  const e = effektivByMonat.get(monat);
                  const korr = e?.hatKorrektur && Math.abs(e.korrektur.bk) > 0.001;
                  const raw = m ? Number(m.deputatBk) : 0;
                  if (raw === 0 && !korr) return <td key={i} className="py-2.5 px-3 text-right tabular-nums"><span className="text-[#D1D5DB]">—</span></td>;
                  return (
                    <td key={i} className={`py-2.5 px-3 text-right tabular-nums ${korr ? "text-[#E2001A]" : ""}`} title={korr ? formatTooltip("bk", monat) : undefined}>
                      {cell("bk", monat, raw)}
                      {korr && <sup className="text-[10px] text-[#E2001A] ml-0.5">*</sup>}
                    </td>
                  );
                })}
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
          {korrigierteMonate.length > 0 && (
            <span>
              <span className="text-[#E2001A] font-bold">*</span> neben Wert = taggenaue Korrektur
              (siehe Herleitung unten)
            </span>
          )}
        </div>
      </Card>

      {/* Taggenaue Herleitung — nachvollziehbar pro Monat */}
      {korrigierteMonate.length > 0 && (
        <Card className="mb-6 border-l-4 border-[#E2001A]">
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">
            Taggenaue Deputatsberechnung (§ 3 Abs. 1 FESchVO)
          </h3>
          <p className="text-sm text-[#6B7280] mb-4">
            Fuer folgende Monate wurde ein tatsaechliches Aenderungsdatum erfasst. Die Deputate werden
            nicht pauschal, sondern tagesgewichtet berechnet:
            <br />
            <span className="font-mono text-xs">
              effektiv = (alt / Monatstage &times; Tage vor Aenderung) + (neu / Monatstage &times; Tage ab Aenderung)
            </span>
          </p>
          <div className="space-y-4">
            {korrigierteMonate
              .sort((a, b) => a.monat - b.monat)
              .map((e) => (
                <div key={e.monat} className="border border-[#E5E7EB] rounded-lg p-4 bg-[#FAFAFA]">
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="font-bold text-[15px] text-[#1A1A1A]">
                      {MONATE_KURZ[e.monat - 1]} {aktuellesHj.jahr} ({e.monatsTage} Tage)
                    </h4>
                    <div className="text-sm">
                      <span className="text-[#6B7280]">Pauschal:</span>{" "}
                      <span className="font-mono">{e.pauschal.gesamt.toFixed(2)}</span>
                      <span className="mx-2 text-[#D1D5DB]">→</span>
                      <span className="text-[#6B7280]">Effektiv:</span>{" "}
                      <span className="font-mono font-bold text-[#E2001A]">{e.effektiv.gesamt.toFixed(2)}</span>
                      <span className="ml-2 text-xs text-[#6B7280]">
                        (Korrektur: {e.korrektur.gesamt >= 0 ? "+" : ""}{e.korrektur.gesamt.toFixed(3)})
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 mt-3">
                    {e.aenderungen.map((a, idx) => (
                      <div key={idx} className="text-sm font-mono bg-white p-3 rounded border border-[#E5E7EB]">
                        <div className="text-[#6B7280] text-xs mb-1.5 font-sans">
                          Aenderung am <strong>{new Date(a.datum).toLocaleDateString("de-DE")}</strong>{" "}
                          (Tag {a.tag}/{e.monatsTage}):
                        </div>
                        <div className="text-[13px] space-y-0.5">
                          <div>
                            <span className="text-[#6B7280]">Vor Aenderung:</span>{" "}
                            {a.alt.gesamt.toFixed(2)} × {a.tageVor} Tage / {e.monatsTage} ={" "}
                            <strong>{a.anteilAlt.gesamt.toFixed(3)}</strong>
                          </div>
                          <div>
                            <span className="text-[#6B7280]">Ab Aenderung:</span>{" "}
                            {a.neu.gesamt.toFixed(2)} × {a.tageNach} Tage / {e.monatsTage} ={" "}
                            <strong>{a.anteilNeu.gesamt.toFixed(3)}</strong>
                          </div>
                          <div className="pt-1 border-t border-[#E5E7EB] mt-1">
                            <span className="text-[#6B7280]">Summe:</span>{" "}
                            <strong className="text-[#E2001A]">
                              {(a.anteilAlt.gesamt + a.anteilNeu.gesamt).toFixed(3)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Periodenmodell v0.7+ — Untis 1:1, tagesgenau */}
      <PeriodenModellCard
        lehrerId={lehrerId}
        periodenverlauf={periodenverlauf.map((p) => ({
          ...p,
          deputatGesamt: String(p.deputatGesamt ?? "0"),
          deputatGes: String(p.deputatGes ?? "0"),
          deputatGym: String(p.deputatGym ?? "0"),
          deputatBk: String(p.deputatBk ?? "0"),
          isBPeriod: p.isBPeriod ?? false,
          termName: p.termName ?? null,
        }))}
        echteAenderungen={echteAenderungen}
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
