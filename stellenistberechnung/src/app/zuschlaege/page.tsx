import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  getSchulen,
  getHaushaltsjahre,
  getZuschlagArten,
  getZuschlaegeBySchuleUndHaushaltsjahr,
} from "@/lib/db/queries";
import { getOptionalSession } from "@/lib/auth/permissions";
import { ZuschlaegeClient } from "./ZuschlaegeClient";

export const dynamic = "force-dynamic";

type ExistingZuschlag = {
  id: number;
  schuleId: number;
  haushaltsjahrId: number;
  zuschlagArtId: number;
  wert: string;
  zeitraum: string;
  bemerkung: string | null;
  bezeichnung: string;
  istStandard: boolean;
  sortierung: number;
};

export default async function ZuschlaegePage() {
  const [schulen, haushaltsjahre, zuschlagArten, session] = await Promise.all([
    getSchulen(),
    getHaushaltsjahre(),
    getZuschlagArten(),
    getOptionalSession(),
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
        <Card>
          <p className="text-[#6B7280] py-8 text-center">
            Bitte zuerst Haushaltsjahre in den Einstellungen anlegen.
          </p>
        </Card>
      </PageContainer>
    );
  }

  // Zuschlaege fuer ALLE HJ x ALLE Schulen vorladen
  const zuschlaegeByHjAndSchule: Record<number, Record<number, ExistingZuschlag[]>> = {};

  for (const hj of haushaltsjahre) {
    zuschlaegeByHjAndSchule[hj.id] = {};
    for (const schule of schulen) {
      zuschlaegeByHjAndSchule[hj.id][schule.id] =
        await getZuschlaegeBySchuleUndHaushaltsjahr(schule.id, hj.id);
    }
  }

  // Schreibrechte: Betrachter duerfen nicht bearbeiten
  const canEdit = session?.rolle !== "betrachter";

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
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          name: s.name,
          farbe: s.farbe,
        }))}
        haushaltsjahre={haushaltsjahre.map((hj) => ({
          id: hj.id,
          jahr: hj.jahr,
        }))}
        zuschlagArten={zuschlagArten.map((za) => ({
          id: za.id,
          bezeichnung: za.bezeichnung,
          istStandard: za.istStandard,
        }))}
        zuschlaegeByHjAndSchule={zuschlaegeByHjAndSchule}
        defaultHaushaltsjahrId={aktuellesHj.id}
        canEdit={canEdit}
      />
    </PageContainer>
  );
}
