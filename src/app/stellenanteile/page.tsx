import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import {
  getSchulen,
  getStellenartTypen,
  getStellenanteileBySchuleUndHj,
  getAktiveLehrerBySchule,
} from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";
import { StellenanteileClient } from "./StellenanteileClient";

export const dynamic = "force-dynamic";

type StellenanteilRow = {
  id: number;
  stellenartTypId: number;
  stellenartBezeichnung: string;
  stellenartKurz: string | null;
  stellenartKuerzel: string | null;
  stellenartTyp: string;
  bindungstyp: string;
  istIsoliert: boolean;
  anlage2a: boolean;
  erhoehtPauschale: boolean;
  rechtsgrundlage: string | null;
  lehrerId: number | null;
  lehrerName: string | null;
  lehrerPersonalnr: string | null;
  wert: string;
  eurBetrag: string | null;
  wahlrecht: string | null;
  zeitraum: string;
  status: string;
  befristetBis: string | null;
  antragsdatum: string | null;
  aktenzeichen: string | null;
  dmsDokumentennummer: string | null;
  bemerkung: string | null;
};

export default async function StellenanteilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { hj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);

  const [schulen, stellenarten] = await Promise.all([
    getSchulen(),
    getStellenartTypen(),
  ]);

  if (!hj) {
    return (
      <PageContainer>
        <Header
          title="Stellenanteile"
          subtitle="Kein aktuelles Haushaltsjahr gefunden"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Stellenanteile" },
          ]}
        />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-[#575756]">
          Bitte zuerst ein Haushaltsjahr fuer das aktuelle Jahr anlegen.
        </div>
      </PageContainer>
    );
  }

  // Stellenanteile und Lehrer pro Schule laden
  const stellenanteileBySchule: Record<number, StellenanteilRow[]> = {};
  const lehrerBySchule: Record<number, Array<{ id: number; vollname: string; personalnummer: string | null }>> = {};

  for (const schule of schulen) {
    const rows = await getStellenanteileBySchuleUndHj(schule.id, hj.id);
    stellenanteileBySchule[schule.id] = rows.map((r) => ({
      id: r.id,
      stellenartTypId: r.stellenartTypId,
      stellenartBezeichnung: r.stellenartBezeichnung,
      stellenartKurz: r.stellenartKurz,
      stellenartKuerzel: r.stellenartKuerzel,
      stellenartTyp: r.stellenartTyp,
      bindungstyp: r.bindungstyp,
      istIsoliert: r.istIsoliert,
      anlage2a: r.anlage2a,
      erhoehtPauschale: r.erhoehtPauschale,
      rechtsgrundlage: r.rechtsgrundlage,
      lehrerId: r.lehrerId,
      lehrerName: r.lehrerName,
      lehrerPersonalnr: r.lehrerPersonalnr,
      wert: r.wert,
      eurBetrag: r.eurBetrag,
      wahlrecht: r.wahlrecht,
      zeitraum: r.zeitraum,
      status: r.status,
      befristetBis: r.befristetBis,
      antragsdatum: r.antragsdatum,
      aktenzeichen: r.aktenzeichen,
      dmsDokumentennummer: r.dmsDokumentennummer,
      bemerkung: r.bemerkung,
    }));

    lehrerBySchule[schule.id] = await getAktiveLehrerBySchule(schule.id);
  }

  return (
    <PageContainer>
      <Header
        title="Zusaetzliche Stellenanteile"
        subtitle="Verwaltung der zusaetzlichen Stellenanteile je Schule"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Stellenanteile" },
        ]}
      />
      {hjOptions.length > 1 && <div className="flex justify-end mb-4"><HaushaltsjahrSelector options={hjOptions} selectedJahr={hj.jahr} /></div>}

      <StellenanteileClient
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          name: s.name,
          farbe: s.farbe,
        }))}
        stellenanteileBySchule={stellenanteileBySchule}
        stellenarten={stellenarten.map((sa) => ({
          id: sa.id,
          bezeichnung: sa.bezeichnung,
          kurzbezeichnung: sa.kurzbezeichnung,
          kuerzel: sa.kuerzel,
          typ: sa.typ,
          bindungstyp: sa.bindungstyp,
          rechtsgrundlage: sa.rechtsgrundlage,
        }))}
        lehrerBySchule={lehrerBySchule}
        defaultSchuleId={schulen[0]?.id ?? 0}
        haushaltsjahrId={hj.id}
      />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> Zusaetzliche Stellenanteile werden gemaess{" "}
        <strong>§ 93 Abs. 2 SchulG NRW</strong> i.V.m. der Verordnung zur Ausfuehrung
        des § 93 Abs. 2 SchulG berechnet und zugewiesen. Sie umfassen u.a.
        Schulleitungspauschalen, Anrechnungen fuer besondere Aufgaben,
        Mehrbedarfe und sonstige Zuweisungen der Schulaufsicht.
        Alle Aenderungen werden im Audit-Log protokolliert.
      </div>
    </PageContainer>
  );
}
