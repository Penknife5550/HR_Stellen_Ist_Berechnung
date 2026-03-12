import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { getSchuljahre, getSlrWerteBySchuljahr } from "@/lib/db/queries";
import { SlrClient } from "./SlrClient";

export const dynamic = "force-dynamic";

export default async function SlrKonfigurationPage() {
  const schuljahre = await getSchuljahre();

  // Neuestes Schuljahr per Default
  const aktuellesSj = schuljahre[0];
  if (!aktuellesSj) {
    return (
      <PageContainer>
        <Header
          title="SLR-Konfiguration"
          subtitle="Keine Schuljahre konfiguriert"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "SLR-Konfiguration" },
          ]}
        />
        <Card>
          <p className="text-[#6B7280] py-8 text-center">
            Bitte zuerst Schuljahre in der Datenbank anlegen.
          </p>
        </Card>
      </PageContainer>
    );
  }

  // SLR-Werte fuer alle Schuljahre vorladen
  const slrBySchuljahr: Record<number, Array<{
    id: number;
    schuljahrId: number;
    schulformTyp: string;
    relation: string;
    quelle: string | null;
  }>> = {};

  for (const sj of schuljahre) {
    slrBySchuljahr[sj.id] = await getSlrWerteBySchuljahr(sj.id);
  }

  return (
    <PageContainer>
      <Header
        title="SLR-Konfiguration"
        subtitle="Schueler-Lehrer-Relationen nach VO zu § 93 Abs. 2 SchulG"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "SLR-Konfiguration" },
        ]}
      />

      <SlrClient
        schuljahre={schuljahre.map((sj) => ({
          id: sj.id,
          bezeichnung: sj.bezeichnung,
        }))}
        slrBySchuljahr={slrBySchuljahr}
        defaultSchuljahrId={aktuellesSj.id}
      />

      <div className="mt-6 p-4 bg-[#FEF7CC] border border-[#FBC900] rounded-lg text-sm text-[#575756]">
        <strong>Hinweis:</strong> Die SLR-Werte werden jaehrlich per Verordnung festgelegt.
        Aenderungen erfordern die entsprechende Rechtsgrundlage.
      </div>
    </PageContainer>
  );
}
