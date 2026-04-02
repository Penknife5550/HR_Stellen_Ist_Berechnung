import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card, KPICard } from "@/components/ui/Card";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { getAktuelleVergleiche } from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";

export const dynamic = "force-dynamic";

export default async function VergleichPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { hj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);
  const hjLabel = hj ? String(hj.jahr) : "—";

  let vergleiche: Awaited<ReturnType<typeof getAktuelleVergleiche>> = [];
  if (hj) {
    vergleiche = await getAktuelleVergleiche(hj.id);
  }

  // Gesamtwerte
  const gesamtSoll = vergleiche.reduce((acc, v) => acc + Number(v.stellensoll), 0);
  const gesamtIst = vergleiche.reduce((acc, v) => acc + Number(v.stellenist), 0);
  const gesamtDiff = Math.round((gesamtIst - gesamtSoll) * 10) / 10;

  return (
    <PageContainer>
      <Header
        title="Soll-Ist-Vergleich"
        subtitle={`Stellensoll vs. Stellenist — Haushaltsjahr ${hjLabel}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Soll-Ist-Vergleich" },
        ]}
      />
      {hjOptions.length > 1 && <div className="flex justify-end mb-4"><HaushaltsjahrSelector options={hjOptions} selectedJahr={hj!.jahr} /></div>}

      {vergleiche.length > 0 ? (
        <>
          {/* Gesamt-KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <KPICard
              label="Gesamt Stellensoll"
              value={gesamtSoll.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
              subtitle="Alle Schulen"
              status="neutral"
            />
            <KPICard
              label="Gesamt Stellenist"
              value={gesamtIst.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
              subtitle="Alle Schulen"
              status="neutral"
            />
            <KPICard
              label="Gesamt Differenz"
              value={
                (gesamtDiff > 0 ? "+" : "") +
                gesamtDiff.toLocaleString("de-DE", { minimumFractionDigits: 1 })
              }
              subtitle={gesamtDiff <= 0 ? "Unter Soll = gut" : "Ueber Soll"}
              status={gesamtDiff <= 0 ? "success" : gesamtDiff <= 1 ? "warning" : "danger"}
            />
          </div>

          {/* Pro Schule */}
          {vergleiche.map((v) => {
            const soll = Number(v.stellensoll);
            const ist = Number(v.stellenist);
            const diff = Number(v.differenz);
            const statusVal: "success" | "warning" | "danger" =
              diff <= 0 ? "success" : diff <= 0.5 ? "warning" : "danger";

            return (
              <Card key={v.id} className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: v.schulFarbe }}
                    />
                    <h3 className="text-lg font-bold">
                      {v.schulName} ({v.schulKurzname})
                    </h3>
                  </div>
                  <StatusIndicator status={statusVal} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider text-[#6B7280] font-bold mb-2">
                      Stellensoll
                    </div>
                    <div
                      className="text-4xl font-bold tabular-nums"
                      style={{ color: v.schulFarbe }}
                    >
                      {soll.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                    </div>
                    <div className="text-sm text-[#6B7280] mt-1">Berechneter Bedarf</div>
                  </div>

                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider text-[#6B7280] font-bold mb-2">
                      Stellenist
                    </div>
                    <div className="text-4xl font-bold tabular-nums text-[#1A1A1A]">
                      {ist.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                    </div>
                    <div className="text-sm text-[#6B7280] mt-1">Tatsaechliche Stellen</div>
                  </div>

                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider text-[#6B7280] font-bold mb-2">
                      Differenz
                    </div>
                    <div
                      className={`text-4xl font-bold tabular-nums ${
                        diff > 0 ? "text-[#F59E0B]" : "text-[#22C55E]"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
                    </div>
                    <div className="text-sm text-[#6B7280] mt-1">
                      {diff > 0
                        ? "Ueber Soll — Mehrkosten bei Schultraeger"
                        : "Unter Soll — voll refinanziert"}
                    </div>
                  </div>
                </div>

                {/* Refinanzierungsanspruch */}
                <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#6B7280]">Refinanzierungsanspruch:</span>
                    <span className="font-bold">
                      {Number(v.refinanzierung).toLocaleString("de-DE", {
                        minimumFractionDigits: 1,
                      })}{" "}
                      Stellen
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      ) : (
        <Card>
          <div className="py-12 text-center text-[#6B7280]">
            <p className="text-lg mb-2">Noch keine Vergleichsdaten vorhanden</p>
            <p className="text-sm">
              Fuehren Sie zuerst eine Stellensoll-Berechnung durch.
            </p>
          </div>
        </Card>
      )}

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> <strong>§ 107 Abs. 2 SchulG NRW</strong> (Defizitdeckungsprinzip):
        Das Land erstattet Personalkosten nur bis zur Hoehe des Stellensolls.
        Ist das Stellenist hoeher, traegt der Schultraeger die Differenzkosten selbst
        (Ausgabenbegrenzungsgebot). Der Refinanzierungsanspruch ergibt sich aus{" "}
        <strong>Art. 8 Abs. 4 Satz 3 LV NRW</strong> i.V.m.{" "}
        <strong>§§ 105-115 SchulG NRW</strong>.
        Die Eigenleistung betraegt mindestens 8 % (<strong>§ 106 Abs. 2 SchulG</strong>).
      </div>
    </PageContainer>
  );
}
