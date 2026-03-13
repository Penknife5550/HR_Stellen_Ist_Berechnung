import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { getHaushaltsjahre, getAktuellesHaushaltsjahr, getSchulen } from "@/lib/db/queries";
import { ExportClient } from "./ExportClient";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const [haushaltsjahre, aktuellesHj, schulen] = await Promise.all([
    getHaushaltsjahre(),
    getAktuellesHaushaltsjahr(),
    getSchulen(),
  ]);

  return (
    <PageContainer>
      <Header
        title="Export"
        subtitle="Berichte fuer die Bezirksregierung und interne Dokumentation"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Export" },
        ]}
      />

      <ExportClient
        haushaltsjahre={haushaltsjahre}
        aktuellesHaushaltsjahrId={aktuellesHj?.id ?? null}
        schulen={schulen}
      />
    </PageContainer>
  );
}
