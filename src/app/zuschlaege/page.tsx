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

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> Zuschlaege zum Grundstellenbedarf nach{" "}
        <strong>§ 107 Abs. 3 SchulG NRW</strong>:{" "}
        Personalbedarfspauschale (2 %), Personalnebenkostenpauschale (0,5 %).
        Inklusion/Gemeinsames Lernen nach <strong>§ 3a FESchVO</strong> (Sek. I: 1/6 Stelle
        pro Schueler mit sonderpaedag. Foerderbedarf; Grundschule: 0,5 Stelle je Zug).
        Ganztagszuschlag nur bei ausdruecklicher Refinanzierungszusage der Bezirksregierung.
        Alle Werte als Stellenanteile (FTE) eintragen.
      </div>
    </PageContainer>
  );
}
