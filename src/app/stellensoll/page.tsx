import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card, KPICard } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktuelleStellensollBySchule,
  getRegeldeputateMap,
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
  const [schulen, aktuellesHj, regeldeputateMap] = await Promise.all([
    getSchulen(),
    getAktuellesHaushaltsjahr(),
    getRegeldeputateMap(),
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
      const rd = regeldeputateMap.get(schule.kurzname) ?? 0;
      return {
        id: schule.id,
        kurzname: schule.kurzname,
        name: schule.name,
        farbe: schule.farbe,
        regeldeputat: rd,
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

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> Stellensollberechnung nach{" "}
        <strong>§ 3 FESchVO</strong> i.V.m. <strong>§ 107 SchulG NRW</strong>.{" "}
        Stichtage gemaess <strong>§ 3 Abs. 1 FESchVO</strong>:{" "}
        Jan-Jul = Schuelerzahl vom 15.10. des Vorjahres,{" "}
        Aug-Dez = Schuelerzahl vom 15.10. des laufenden Jahres.{" "}
        SLR-Werte nach <strong>§ 8 VO zu § 93 Abs. 2 SchulG</strong>.{" "}
        Frist: Haushaltsantrag bis 1. Juli bei der Bezirksregierung{" "}
        (<strong>§ 112 Abs. 1 SchulG</strong>).
      </div>
    </PageContainer>
  );
}
