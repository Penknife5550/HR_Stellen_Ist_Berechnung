import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  getAktuellesHaushaltsjahr,
  getHaushaltsjahre,
  getGehaltsrelevanteAenderungen,
} from "@/lib/db/queries";
import { NachtraegeClient } from "./NachtraegeClient";

export const dynamic = "force-dynamic";

export default async function NachtraegePage() {
  const [haushaltsjahre, aktuellesHj] = await Promise.all([
    getHaushaltsjahre(),
    getAktuellesHaushaltsjahr(),
  ]);

  const hjId = aktuellesHj?.id;
  const aenderungen = hjId ? await getGehaltsrelevanteAenderungen(hjId) : [];

  // Daten serialisieren (Timestamps → Strings)
  const serialized = aenderungen.map((a) => ({
    ...a,
    geaendertAm: a.geaendertAm.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    nachtragErstelltAm: a.nachtragErstelltAm
      ? a.nachtragErstelltAm.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null,
  }));

  if (!aktuellesHj) {
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

  return (
    <PageContainer>
      <Header
        title="Nachtraege"
        subtitle={`Vertragsnachtraege — Haushaltsjahr ${aktuellesHj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Nachtraege" },
        ]}
      />
      <NachtraegeClient
        aenderungen={serialized}
        haushaltsjahre={haushaltsjahre.map((h) => ({ id: h.id, jahr: h.jahr }))}
        aktuellesHaushaltsjahrId={hjId}
      />
    </PageContainer>
  );
}
