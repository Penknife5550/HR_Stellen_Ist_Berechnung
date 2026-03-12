import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import {
  getSchulen,
  getHaushaltsjahre,
  getZuschlagArten,
  getZuschlaegeBySchuleUndHaushaltsjahr,
} from "@/lib/db/queries";
import { ZuschlaegeClient } from "./ZuschlaegeClient";

export const dynamic = "force-dynamic";

export default async function ZuschlaegePage() {
  const [schulen, haushaltsjahre, zuschlagArten] = await Promise.all([
    getSchulen(),
    getHaushaltsjahre(),
    getZuschlagArten(),
  ]);

  const aktuellesHj = haushaltsjahre[0];
  if (!aktuellesHj) {
    return (
      <PageContainer>
        <Header
          title="Zuschlaege"
          subtitle="Keine Haushaltsjahre konfiguriert"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Zuschlaege" },
          ]}
        />
      </PageContainer>
    );
  }

  // Fuer jede Schule die Zuschlaege des aktuellen HJ laden
  const schulenMitZuschlaegen = await Promise.all(
    schulen.map(async (schule) => {
      const existing = await getZuschlaegeBySchuleUndHaushaltsjahr(schule.id, aktuellesHj.id);
      return {
        id: schule.id,
        kurzname: schule.kurzname,
        name: schule.name,
        farbe: schule.farbe,
        zuschlaege: existing,
      };
    })
  );

  return (
    <PageContainer>
      <Header
        title="Zuschlaege"
        subtitle="Zuschlaege zum Grundstellenbedarf pro Schule und Haushaltsjahr"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Zuschlaege" },
        ]}
      />

      <ZuschlaegeClient
        schulen={schulenMitZuschlaegen}
        zuschlagArten={zuschlagArten.map((za) => ({
          id: za.id,
          bezeichnung: za.bezeichnung,
          istStandard: za.istStandard,
        }))}
        haushaltsjahrId={aktuellesHj.id}
        haushaltsjahrLabel={String(aktuellesHj.jahr)}
      />
    </PageContainer>
  );
}
