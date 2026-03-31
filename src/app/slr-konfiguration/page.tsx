import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { getSchuljahre, getSlrWerteBySchuljahr, getSlrHistorieBySchuljahr } from "@/lib/db/queries";
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

  // SLR-Werte + Historie fuer alle Schuljahre vorladen
  const slrBySchuljahr: Record<number, Array<{
    id: number;
    schuljahrId: number;
    schulformTyp: string;
    relation: string;
    quelle: string | null;
  }>> = {};

  const historieBySchuljahr: Record<number, Array<{
    id: number;
    schulformTyp: string;
    relationAlt: string;
    relationNeu: string;
    quelleAlt: string | null;
    quelleNeu: string | null;
    grund: string | null;
    geaendertVon: string;
    geaendertAm: string;
  }>> = {};

  for (const sj of schuljahre) {
    slrBySchuljahr[sj.id] = await getSlrWerteBySchuljahr(sj.id);

    const hist = await getSlrHistorieBySchuljahr(sj.id);
    historieBySchuljahr[sj.id] = hist.map((h) => ({
      id: h.id,
      schulformTyp: h.schulformTyp,
      relationAlt: h.relationAlt,
      relationNeu: h.relationNeu,
      quelleAlt: h.quelleAlt,
      quelleNeu: h.quelleNeu,
      grund: h.grund,
      geaendertVon: h.geaendertVon,
      geaendertAm: h.geaendertAm.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
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
        historieBySchuljahr={historieBySchuljahr}
        defaultSchuljahrId={aktuellesSj.id}
      />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> Die Schueler-Lehrer-Relationen (SLR) sind in{" "}
        <strong>§ 8 der VO zu § 93 Abs. 2 SchulG</strong> festgelegt
        (zuletzt geaendert am 28.06.2024, GV. NRW. S. 349).
        Sie gelten &quot;nach Massgabe des Haushalts&quot; und koennen jaehrlich durch den
        Bewirtschaftungserlass des Schulministeriums angepasst werden.
        Die Werte bestimmen den Grundstellenbedarf gemaess{" "}
        <strong>§ 107 Abs. 1 SchulG NRW</strong>.
        Alle Aenderungen werden versioniert und im Audit-Log protokolliert.
      </div>
    </PageContainer>
  );
}
