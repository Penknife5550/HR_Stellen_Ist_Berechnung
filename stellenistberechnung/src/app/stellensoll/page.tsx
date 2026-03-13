import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  getSchulen,
  getHaushaltsjahre,
  getAktuelleStellensollBySchule,
  getAllPflichtstunden,
} from "@/lib/db/queries";
import { getOptionalSession } from "@/lib/auth/permissions";
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

type Ergebnis = {
  zeitraum: string;
  grundstellenGerundet: number;
  grundstellenSumme: number;
  zuschlaegeSumme: number;
  stellensoll: number;
  grundstellenDetails: StellensollDetail[];
  zuschlaege_details: ZuschlagDetail[] | null;
  vollzeitDeputat: number | null;
  deputatstundenrahmen: number | null;
  berechnetAm: Date;
};

export default async function StellensollPage() {
  const [schulen, haushaltsjahre, session, pflichtstundenRows] = await Promise.all([
    getSchulen(),
    getHaushaltsjahre(),
    getOptionalSession(),
    getAllPflichtstunden(),
  ]);

  // Pflichtstunden-Lookup: schulform → { vollzeitDeputat, rechtsgrundlage }
  const pflichtstundenBySchulform: Record<string, { vollzeitDeputat: number; rechtsgrundlage: string | null }> = {};
  for (const ps of pflichtstundenRows) {
    pflichtstundenBySchulform[ps.schulform] = {
      vollzeitDeputat: Number(ps.vollzeitDeputat),
      rechtsgrundlage: ps.rechtsgrundlage,
    };
  }

  // Schulform-Lookup: schuleId → schulform (z.B. "Gesamtschule")
  const schulformBySchuleId: Record<number, string> = {};
  for (const s of schulen) {
    schulformBySchuleId[s.id] = s.schulform;
  }

  const aktuellesHj = haushaltsjahre[0];
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
        <Card>
          <p className="text-[#6B7280] py-8 text-center">
            Bitte zuerst Haushaltsjahre in den Einstellungen anlegen.
          </p>
        </Card>
      </PageContainer>
    );
  }

  // Berechnungsergebnisse fuer ALLE HJ x ALLE Schulen vorladen
  const ergebnisseByHjAndSchule: Record<number, Record<number, Ergebnis[]>> = {};

  for (const hj of haushaltsjahre) {
    ergebnisseByHjAndSchule[hj.id] = {};
    for (const schule of schulen) {
      const rows = await getAktuelleStellensollBySchule(schule.id, hj.id);
      ergebnisseByHjAndSchule[hj.id][schule.id] = rows.map((e) => {
        // Deputatsstundenrahmen: aus DB oder on-the-fly berechnen
        const vzDep = e.vollzeitDeputat
          ? Number(e.vollzeitDeputat)
          : pflichtstundenBySchulform[schulformBySchuleId[schule.id]]?.vollzeitDeputat ?? null;
        const depRahmen = e.deputatstundenrahmen
          ? Number(e.deputatstundenrahmen)
          : vzDep !== null
            ? Math.round(Number(e.grundstellenGerundet) * vzDep * 10) / 10
            : null;

        return {
          zeitraum: e.zeitraum,
          grundstellenGerundet: Number(e.grundstellenGerundet),
          grundstellenSumme: Number(e.grundstellenSumme),
          zuschlaegeSumme: Number(e.zuschlaegeSumme),
          stellensoll: Number(e.stellensoll),
          grundstellenDetails: e.grundstellenDetails as StellensollDetail[],
          zuschlaege_details: e.zuschlaege_details as ZuschlagDetail[] | null,
          vollzeitDeputat: vzDep,
          deputatstundenrahmen: depRahmen,
          berechnetAm: e.berechnetAm,
        };
      });
    }
  }

  const canEdit = session?.rolle !== "betrachter";

  return (
    <PageContainer>
      <Header
        title="Stellensoll-Berechnung"
        subtitle="Berechnung des Stellensolls nach NRW-Recht (§ 3 FESchVO)"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Stellensoll" },
        ]}
      />

      <StellensollClient
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          name: s.name,
          farbe: s.farbe,
          schulform: s.schulform,
        }))}
        haushaltsjahre={haushaltsjahre.map((hj) => ({
          id: hj.id,
          jahr: hj.jahr,
        }))}
        ergebnisseByHjAndSchule={ergebnisseByHjAndSchule}
        pflichtstundenBySchulform={pflichtstundenBySchulform}
        defaultHaushaltsjahrId={aktuellesHj.id}
        canEdit={canEdit}
      />
    </PageContainer>
  );
}
