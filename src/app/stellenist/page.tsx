import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card, KPICard } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuelleStellenisteAlleSchulen,
  getAktuelleStellensollAlleSchulen,
  getAlleStellenanteileByHj,
  getDeputatSummenByMonat,
  getLatestSync,
} from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";
import { StellenistClient } from "./StellenistClient";

export default async function StellenistPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { hj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);

  const [schulen, latestSync] = await Promise.all([
    getSchulen(),
    getLatestSync(),
  ]);

  if (!hj) {
    return (
      <PageContainer>
        <Header
          title="Stellenist-Berechnung"
          subtitle="Tatsaechlich besetzte Stellen aus Deputatsdaten"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Stellenist" },
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

  const stellenisteRaw = await getAktuelleStellenisteAlleSchulen(hj.id);

  // Pro Schule gruppieren
  type MonatDetail = { monat: number; summeWochenstunden: number; summeWochenstundenPauschal?: number; tagesgenauKorrektur?: number; anzahlLehrer: number };
  type MehrarbeitQuellen = { stunden?: number; stellenanteile?: number };
  type SchulStellenist = {
    schuleId: number;
    schulKurzname: string;
    schulFarbe: string;
    zeitraeume: Array<{
      zeitraum: string;
      stellenistGesamt: string;
      stellenist: string;
      mehrarbeitStellen: string;
      monatsDurchschnittStunden: string | null;
      regelstundendeputat: string | null;
      berechnetAm: Date;
      monatsDetails?: MonatDetail[];
      hatTagesgenauKorrekturen?: boolean;
      mehrarbeitQuellen?: MehrarbeitQuellen;
    }>;
  };

  const schulMap = new Map<number, SchulStellenist>();
  for (const row of stellenisteRaw) {
    if (!schulMap.has(row.schuleId)) {
      schulMap.set(row.schuleId, {
        schuleId: row.schuleId,
        schulKurzname: row.schulKurzname,
        schulFarbe: row.schulFarbe,
        zeitraeume: [],
      });
    }
    const det = (row.details ?? null) as {
      monateImZeitraum?: MonatDetail[];
      hatTagesgenauKorrekturen?: boolean;
      mehrarbeitStunden?: number;
      mehrarbeitStellenanteile?: number;
    } | null;
    schulMap.get(row.schuleId)!.zeitraeume.push({
      zeitraum: row.zeitraum,
      stellenistGesamt: row.stellenistGesamt,
      stellenist: row.stellenist,
      mehrarbeitStellen: row.mehrarbeitStellen,
      monatsDurchschnittStunden: row.monatsDurchschnittStunden,
      regelstundendeputat: row.regelstundendeputat,
      berechnetAm: row.berechnetAm,
      monatsDetails: det?.monateImZeitraum,
      hatTagesgenauKorrekturen: det?.hatTagesgenauKorrekturen ?? false,
      mehrarbeitQuellen: (det && (det.mehrarbeitStunden !== undefined || det.mehrarbeitStellenanteile !== undefined))
        ? { stunden: det.mehrarbeitStunden, stellenanteile: det.mehrarbeitStellenanteile }
        : undefined,
    });
  }

  const schulStelleniste = Array.from(schulMap.values());
  const hatErgebnisse = schulStelleniste.length > 0;

  // Deputat-Summen laden (fuer Vorschau)
  const deputatSummen = await getDeputatSummenByMonat(hj.id);
  const hatDeputate = deputatSummen.length > 0;

  // Stellensoll + Stellenanteile fuer Kontextanzeige laden
  const [sollRows, saRows] = await Promise.all([
    getAktuelleStellensollAlleSchulen(hj.id),
    getAlleStellenanteileByHj(hj.id),
  ]);

  // Stellensoll pro Schule+Zeitraum als Lookup
  type SollKontext = { zeitraum: string; stellensoll: number; grundstellen: number; zuschlaege: number };
  const sollBySchule: Record<number, SollKontext[]> = {};
  for (const row of sollRows) {
    if (!sollBySchule[row.schuleId]) sollBySchule[row.schuleId] = [];
    sollBySchule[row.schuleId].push({
      zeitraum: row.zeitraum,
      stellensoll: Number(row.stellensoll),
      grundstellen: Number(row.grundstellenGerundet),
      zuschlaege: Number(row.zuschlaegeSumme),
    });
  }

  // Genehmigte Stellenanteile pro Schule zusammenfassen
  type SaKontext = { stellenGenehmigt: number; eurGenehmigt: number; anzahl: number };
  const saBySchule: Record<number, SaKontext> = {};
  for (const sa of saRows) {
    if (sa.status !== "genehmigt") continue;
    if (!saBySchule[sa.schuleId]) saBySchule[sa.schuleId] = { stellenGenehmigt: 0, eurGenehmigt: 0, anzahl: 0 };
    saBySchule[sa.schuleId].anzahl++;
    const typ = sa.stellenartTyp;
    if (typ === "A" || typ === "A_106" || (typ === "B" && sa.wahlrecht === "stelle")) {
      saBySchule[sa.schuleId].stellenGenehmigt += Number(sa.wert);
    }
    if (sa.eurBetrag) {
      saBySchule[sa.schuleId].eurGenehmigt += Number(sa.eurBetrag);
    }
  }

  return (
    <PageContainer>
      <Header
        title="Stellenist-Berechnung"
        subtitle={`Tatsaechlich besetzte Stellen nach § 3 FESchVO — Haushaltsjahr ${hj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Stellenist" },
        ]}
      />
      {hjOptions.length > 1 && <div className="flex justify-end mb-4"><HaushaltsjahrSelector options={hjOptions} selectedJahr={hj.jahr} /></div>}

      <StellenistClient
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          farbe: s.farbe,
        }))}
        schulStelleniste={schulStelleniste}
        sollBySchule={sollBySchule}
        saBySchule={saBySchule}
        haushaltsjahrId={hj.id}
        hatDeputate={hatDeputate}
        hatErgebnisse={hatErgebnisse}
        latestSyncDatum={
          latestSync
            ? latestSync.syncDatum.toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null
        }
      />
    </PageContainer>
  );
}
