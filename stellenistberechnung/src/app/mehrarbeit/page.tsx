import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktiveLehrer,
  getMehrarbeitByHaushaltsjahr,
} from "@/lib/db/queries";
import { MehrarbeitClient } from "./MehrarbeitClient";

export default async function MehrarbeitPage() {
  const [schulen, aktuellesHj, aktiveLehrerRaw] = await Promise.all([
    getSchulen(),
    getAktuellesHaushaltsjahr(),
    getAktiveLehrer(),
  ]);

  if (!aktuellesHj) {
    return (
      <PageContainer>
        <Header
          title="Mehrarbeit"
          subtitle="Mehrarbeitsstunden pro Lehrkraft und Monat erfassen"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Mehrarbeit" },
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

  const mehrarbeitRows = await getMehrarbeitByHaushaltsjahr(aktuellesHj.id);

  return (
    <PageContainer>
      <Header
        title="Mehrarbeit"
        subtitle={`Mehrarbeitsstunden pro Lehrkraft und Monat — Haushaltsjahr ${aktuellesHj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Mehrarbeit" },
        ]}
      />

      <MehrarbeitClient
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          farbe: s.farbe,
        }))}
        lehrerListe={aktiveLehrerRaw.map((l) => ({
          id: l.id,
          name: l.name,
          stammschuleId: l.stammschuleId,
          stammschuleCode: l.stammschuleCode,
        }))}
        mehrarbeitEintraege={mehrarbeitRows.map((m) => ({
          id: m.id,
          lehrerId: m.lehrerId,
          monat: m.monat,
          stunden: m.stunden,
          schuleId: m.schuleId,
          bemerkung: m.bemerkung,
          lehrerName: m.lehrerName,
          schulKurzname: m.schulKurzname,
          schulFarbe: m.schulFarbe,
        }))}
        haushaltsjahrId={aktuellesHj.id}
        haushaltsjahrJahr={aktuellesHj.jahr}
      />
    </PageContainer>
  );
}
