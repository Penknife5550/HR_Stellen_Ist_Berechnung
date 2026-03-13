import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card, KPICard } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktuelleStellensollBySchule,
} from "@/lib/db/queries";
import { StellensollClient } from "./StellensollClient";

export const dynamic = "force-dynamic";

type StellensollDetail = {
  stufe: string;
  schueler: number;
  slr: number;
  rohErgebnis: number;
  truncErgebnis: number;
};

type ZuschlagDetail = {
  bezeichnung: string;
  wert: number;
};

export default async function StellensollPage() {
  const [schulen, aktuellesHj] = await Promise.all([
    getSchulen(),
    getAktuellesHaushaltsjahr(),
  ]);

  if (!aktuellesHj) {
    return (
      <PageContainer>
        <Header
          title="Stellensoll-Berechnung"
          subtitle="Kein Haushaltsjahr konfiguriert"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Stellensoll" },
          ]}
        />
      </PageContainer>
    );
  }

  // Berechnungsergebnisse pro Schule laden
  const schulenMitErgebnissen = await Promise.all(
    schulen.map(async (schule) => {
      const ergebnisse = await getAktuelleStellensollBySchule(schule.id, aktuellesHj.id);
      return {
        id: schule.id,
        kurzname: schule.kurzname,
        name: schule.name,
        farbe: schule.farbe,
        ergebnisse: ergebnisse.map((e) => ({
          zeitraum: e.zeitraum,
          grundstellenGerundet: Number(e.grundstellenGerundet),
          grundstellenSumme: Number(e.grundstellenSumme),
          zuschlaegeSumme: Number(e.zuschlaegeSumme),
          stellensoll: Number(e.stellensoll),
          grundstellenDetails: e.grundstellenDetails as StellensollDetail[],
          zuschlaege_details: e.zuschlaege_details as ZuschlagDetail[] | null,
          berechnetAm: e.berechnetAm,
        })),
      };
    })
  );

  const hatErgebnisse = schulenMitErgebnissen.some((s) => s.ergebnisse.length > 0);

  return (
    <PageContainer>
      <Header
        title="Stellensoll-Berechnung"
        subtitle={`Berechnung des Stellensolls nach NRW-Recht (§ 3 FESchVO) — Haushaltsjahr ${aktuellesHj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Stellensoll" },
        ]}
      />

      <StellensollClient schulen={schulenMitErgebnissen} hatErgebnisse={hatErgebnisse} />
    </PageContainer>
  );
}
