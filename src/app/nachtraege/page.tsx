import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";
import { getGehaltsrelevanteWertwechsel } from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { NachtraegeClient } from "./NachtraegeClient";

export const dynamic = "force-dynamic";

export default async function NachtraegePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { hj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);

  if (!hj) {
    return (
      <PageContainer>
        <Header
          title="Nachtraege"
          subtitle="Vertragsnachtraege bei gehaltsrelevanten Deputatsaenderungen"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Nachtraege" },
          ]}
        />
        <Card>
          <div className="text-center py-12 text-[#6B7280]">
            <p className="text-lg font-medium">Kein aktuelles Haushaltsjahr gefunden.</p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const wechsel = await getGehaltsrelevanteWertwechsel(hj.id);

  // Daten serialisieren (Date → String)
  const serialized = wechsel.map((w) => ({
    ...w,
    erstelltAm: w.erstelltAm
      ? w.erstelltAm.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
  }));

  return (
    <PageContainer>
      <Header
        title="Nachtraege"
        subtitle={`Vertragsnachtraege — Haushaltsjahr ${hj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Nachtraege" },
        ]}
      />
      {hjOptions.length > 1 && (
        <div className="flex justify-end mb-4">
          <HaushaltsjahrSelector options={hjOptions} selectedJahr={hj.jahr} />
        </div>
      )}
      <NachtraegeClient wechsel={serialized} jahr={hj.jahr} />
    </PageContainer>
  );
}
