import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktiveLehrer,
  getMehrarbeitByHaushaltsjahr,
  getMehrarbeitSchuleByHj,
  getMehrarbeitSchuleBemerkungen,
} from "@/lib/db/queries";
import { MehrarbeitTabsClient } from "./MehrarbeitTabsClient";

export const dynamic = "force-dynamic";

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

  const [mehrarbeitRows, schulRows, schulBemerkungen] = await Promise.all([
    getMehrarbeitByHaushaltsjahr(aktuellesHj.id),
    getMehrarbeitSchuleByHj(aktuellesHj.id),
    getMehrarbeitSchuleBemerkungen(aktuellesHj.id),
  ]);

  // Nur Lehrer-Variante in den "pro Lehrer"-Tab
  const lehrerRows = mehrarbeitRows.filter((m) => m.lehrerId !== null);

  return (
    <PageContainer>
      <Header
        title="Mehrarbeit"
        subtitle={`Mehrarbeit pro Schule (Stellenanteile) oder pro Lehrkraft (Stunden) — Haushaltsjahr ${aktuellesHj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Mehrarbeit" },
        ]}
      />

      <MehrarbeitTabsClient
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          farbe: s.farbe,
          name: s.name,
        }))}
        lehrerListe={aktiveLehrerRaw.map((l) => ({
          id: l.id,
          name: l.name,
          stammschuleId: l.stammschuleId,
          stammschuleCode: l.stammschuleCode,
        }))}
        mehrarbeitEintraege={lehrerRows.map((m) => ({
          id: m.id,
          lehrerId: m.lehrerId!,
          monat: m.monat,
          stunden: m.stunden,
          schuleId: m.schuleId,
          bemerkung: m.bemerkung,
          lehrerName: m.lehrerName ?? "",
          schulKurzname: m.schulKurzname,
          schulFarbe: m.schulFarbe,
        }))}
        schulEintraege={schulRows.map((s) => ({
          schuleId: s.schuleId!,
          monat: s.monat,
          stellenanteil: s.stellenanteil ?? "0",
        }))}
        schulBemerkungen={schulBemerkungen.map((b) => ({
          schuleId: b.schuleId,
          bemerkung: b.bemerkung,
        }))}
        haushaltsjahrId={aktuellesHj.id}
        haushaltsjahrJahr={aktuellesHj.jahr}
      />
    </PageContainer>
  );
}
