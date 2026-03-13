import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card, KPICard } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktuelleStellenisteAlleSchulen,
  getDeputatSummenByMonat,
  getLatestSync,
} from "@/lib/db/queries";
import { StellenistClient } from "./StellenistClient";

export default async function StellenistPage() {
  const [schulen, aktuellesHj, latestSync] = await Promise.all([
    getSchulen(),
    getAktuellesHaushaltsjahr(),
    getLatestSync(),
  ]);

  if (!aktuellesHj) {
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

  const stellenisteRaw = await getAktuelleStellenisteAlleSchulen(aktuellesHj.id);

  // Pro Schule gruppieren
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
    schulMap.get(row.schuleId)!.zeitraeume.push({
      zeitraum: row.zeitraum,
      stellenistGesamt: row.stellenistGesamt,
      stellenist: row.stellenist,
      mehrarbeitStellen: row.mehrarbeitStellen,
      monatsDurchschnittStunden: row.monatsDurchschnittStunden,
      regelstundendeputat: row.regelstundendeputat,
      berechnetAm: row.berechnetAm,
    });
  }

  const schulStelleniste = Array.from(schulMap.values());
  const hatErgebnisse = schulStelleniste.length > 0;

  // Deputat-Summen laden (fuer Vorschau)
  const deputatSummen = await getDeputatSummenByMonat(aktuellesHj.id);
  const hatDeputate = deputatSummen.length > 0;

  return (
    <PageContainer>
      <Header
        title="Stellenist-Berechnung"
        subtitle={`Tatsaechlich besetzte Stellen — Haushaltsjahr ${aktuellesHj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Stellenist" },
        ]}
      />

      <StellenistClient
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          farbe: s.farbe,
        }))}
        schulStelleniste={schulStelleniste}
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
