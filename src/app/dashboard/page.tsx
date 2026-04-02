import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import {
  getSchulen,
  getAktuelleVergleiche,
  getAktuelleStellenisteAlleSchulen,
  getAktuelleStellensollAlleSchulen,
  getAlleStellenanteileByHj,
  getRegeldeputateMap,
  getLatestSync,
  getAblaufendeBefristungen,
} from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";
import { db } from "@/db";
import { lehrer } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { hj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);

  const [schulen, latestSync] = await Promise.all([
    getSchulen(),
    getLatestSync(),
  ]);

  const hjId = hj?.id;
  const hjLabel = hj ? String(hj.jahr) : "\u2014";

  if (!hj || !hjId) {
    return (
      <PageContainer>
        <Header title="Dashboard" subtitle="Kein aktuelles Haushaltsjahr gefunden" breadcrumbs={[{ label: "Dashboard" }]} />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-[#575756]">
          Bitte zuerst ein Haushaltsjahr anlegen.
        </div>
      </PageContainer>
    );
  }

  // Alles parallel laden
  const [vergleiche, stellenistDaten, stellensollDaten, alleStellenanteile, regeldeputateMap, ablaufendeBefristungen] = await Promise.all([
    getAktuelleVergleiche(hjId),
    getAktuelleStellenisteAlleSchulen(hjId),
    getAktuelleStellensollAlleSchulen(hjId),
    getAlleStellenanteileByHj(hjId),
    getRegeldeputateMap(),
    getAblaufendeBefristungen(hjId, 90),
  ]);

  // Lehrer-Anzahl pro Schule
  const lehrerCountRows = await db
    .select({ stammschuleId: lehrer.stammschuleId, count: sql<number>`count(*)` })
    .from(lehrer)
    .where(eq(lehrer.aktiv, true))
    .groupBy(lehrer.stammschuleId);
  const lehrerCounts: Record<number, number> = {};
  for (const row of lehrerCountRows) {
    if (row.stammschuleId) lehrerCounts[row.stammschuleId] = Number(row.count);
  }

  // Vergleiche als Map
  const vergleichBySchule: Record<number, { stellensoll: number; stellenist: number; differenz: number; status: string }> = {};
  for (const v of vergleiche) {
    vergleichBySchule[v.schuleId] = {
      stellensoll: Number(v.stellensoll),
      stellenist: Number(v.stellenist),
      differenz: Number(v.differenz),
      status: v.status,
    };
  }

  // Stellensoll-Zusammensetzung pro Schule
  type SollZusammensetzung = {
    grundstellen: number;
    zuschlaegeSumme: number;
    stellensoll: number;
    details: Array<{ bezeichnung: string; kuerzel?: string; typ?: string; wert: number; eurBetrag?: number; wahlrecht?: string; istDeputatswirksam?: boolean }>;
  };
  const sollBySchule: Record<number, SollZusammensetzung> = {};
  for (const row of stellensollDaten) {
    // Gewichteter Durchschnitt: Beide Zeitraeume zusammenfuehren
    if (!sollBySchule[row.schuleId]) {
      const details = Array.isArray(row.grundstellenDetails)
        ? []
        : [];
      sollBySchule[row.schuleId] = {
        grundstellen: Number(row.grundstellenGerundet),
        zuschlaegeSumme: Number(row.zuschlaegeSumme),
        stellensoll: Number(row.stellensoll),
        details: [],
      };
    }
    // Letzter Zeitraum gewinnt fuer Details (aug-dez ist aktueller)
    const parsedDetails = (() => {
      // zuschlaege_details aus berechnung_stellensoll laden
      // Die Spalte heisst im Schema zuschlaege_details
      const raw = (row as Record<string, unknown>)["zuschlaege_details"];
      if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
      return [];
    })();
    if (parsedDetails.length > 0 || !sollBySchule[row.schuleId].details.length) {
      sollBySchule[row.schuleId].grundstellen = Number(row.grundstellenGerundet);
      sollBySchule[row.schuleId].zuschlaegeSumme = Number(row.zuschlaegeSumme);
      sollBySchule[row.schuleId].stellensoll = Number(row.stellensoll);
      sollBySchule[row.schuleId].details = parsedDetails.map((d) => ({
        bezeichnung: String(d.bezeichnung ?? ""),
        kuerzel: d.kuerzel ? String(d.kuerzel) : undefined,
        typ: d.typ ? String(d.typ) : undefined,
        wert: Number(d.wert ?? 0),
        eurBetrag: d.eurBetrag ? Number(d.eurBetrag) : undefined,
        wahlrecht: d.wahlrecht ? String(d.wahlrecht) : undefined,
        istDeputatswirksam: d.istDeputatswirksam !== false,
      }));
    }
  }

  // Stellenanteile pro Schule (alle, inkl. beantragt etc.)
  // Wir brauchen hier ALLE Status, nicht nur genehmigt — Query filtert auf genehmigt
  // Also separate Query noetig
  const alleSaRaw = await db
    .select({
      id: (await import("@/db/schema")).stellenanteile.id,
      schuleId: (await import("@/db/schema")).stellenanteile.schuleId,
      wert: (await import("@/db/schema")).stellenanteile.wert,
      eurBetrag: (await import("@/db/schema")).stellenanteile.eurBetrag,
      wahlrecht: (await import("@/db/schema")).stellenanteile.wahlrecht,
      status: (await import("@/db/schema")).stellenanteile.status,
      befristetBis: (await import("@/db/schema")).stellenanteile.befristetBis,
      stellenartBezeichnung: (await import("@/db/schema")).stellenartTypen.bezeichnung,
      stellenartKuerzel: (await import("@/db/schema")).stellenartTypen.kuerzel,
      stellenartTyp: (await import("@/db/schema")).stellenartTypen.typ,
      lehrerName: (await import("@/db/schema")).lehrer.vollname,
    })
    .from((await import("@/db/schema")).stellenanteile)
    .innerJoin(
      (await import("@/db/schema")).stellenartTypen,
      eq((await import("@/db/schema")).stellenanteile.stellenartTypId, (await import("@/db/schema")).stellenartTypen.id)
    )
    .leftJoin(
      (await import("@/db/schema")).lehrer,
      eq((await import("@/db/schema")).stellenanteile.lehrerId, (await import("@/db/schema")).lehrer.id)
    )
    .where(eq((await import("@/db/schema")).stellenanteile.haushaltsjahrId, hjId));

  type SaRow = {
    id: number;
    bezeichnung: string;
    kuerzel: string | null;
    typ: string;
    wert: number;
    eurBetrag: number | null;
    wahlrecht: string | null;
    status: string;
    befristetBis: string | null;
    lehrerName: string | null;
  };
  const saBySchule: Record<number, SaRow[]> = {};
  for (const r of alleSaRaw) {
    if (!saBySchule[r.schuleId]) saBySchule[r.schuleId] = [];
    saBySchule[r.schuleId].push({
      id: r.id,
      bezeichnung: r.stellenartBezeichnung,
      kuerzel: r.stellenartKuerzel,
      typ: r.stellenartTyp,
      wert: Number(r.wert),
      eurBetrag: r.eurBetrag ? Number(r.eurBetrag) : null,
      wahlrecht: r.wahlrecht,
      status: r.status,
      befristetBis: r.befristetBis,
      lehrerName: r.lehrerName,
    });
  }

  // Stellenist gewichtet pro Schule
  const istBySchule: Record<number, { gewichtetStunden: number; regeldeputat: number }> = {};
  for (const si of stellenistDaten) {
    if (!istBySchule[si.schuleId]) {
      istBySchule[si.schuleId] = { gewichtetStunden: 0, regeldeputat: Number(si.regelstundendeputat ?? 0) };
    }
    const avg = Number(si.monatsDurchschnittStunden ?? 0);
    istBySchule[si.schuleId].gewichtetStunden += si.zeitraum === "jan-jul" ? avg * 7 : avg * 5;
  }

  // Befristungen pro Schule
  const befristungenBySchule: Record<number, typeof ablaufendeBefristungen> = {};
  for (const b of ablaufendeBefristungen) {
    if (!befristungenBySchule[b.schuleId]) befristungenBySchule[b.schuleId] = [];
    befristungenBySchule[b.schuleId].push(b);
  }

  return (
    <PageContainer>
      <Header
        title="Dashboard"
        subtitle={`Haushaltsjahr ${hjLabel}`}
        breadcrumbs={[{ label: "Dashboard" }]}
      />
      {hjOptions.length > 1 && <div className="flex justify-end mb-4"><HaushaltsjahrSelector options={hjOptions} selectedJahr={hj.jahr} /></div>}

      <DashboardClient
        schulen={schulen.map((s) => ({ id: s.id, kurzname: s.kurzname, name: s.name, farbe: s.farbe }))}
        vergleichBySchule={vergleichBySchule}
        sollBySchule={sollBySchule}
        saBySchule={saBySchule}
        istBySchule={istBySchule}
        lehrerCounts={lehrerCounts}
        regeldeputateMap={Object.fromEntries(regeldeputateMap)}
        befristungenBySchule={Object.fromEntries(
          Object.entries(befristungenBySchule).map(([k, v]) => [k, v.map((b) => ({
            id: b.id,
            bezeichnung: b.stellenartBezeichnung,
            lehrerName: b.lehrerName,
            befristetBis: b.befristetBis,
            wert: Number(b.wert),
          }))])
        )}
        latestSyncDatum={latestSync ? latestSync.syncDatum.toLocaleString("de-DE") : null}
        hatBerechnung={vergleiche.length > 0}
      />
    </PageContainer>
  );
}
