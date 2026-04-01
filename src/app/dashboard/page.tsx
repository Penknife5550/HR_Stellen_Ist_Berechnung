import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { KPICard } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktuelleVergleiche,
  getAktuelleStellenisteAlleSchulen,
  getRegeldeputateMap,
  getLatestSync,
  getStellenanteileKPIs,
  getAblaufendeBefristungen,
} from "@/lib/db/queries";
import { db } from "@/db";
import { lehrer } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [schulen, aktuellesHj, latestSync] = await Promise.all([
    getSchulen(),
    getAktuellesHaushaltsjahr(),
    getLatestSync(),
  ]);

  const hjId = aktuellesHj?.id;
  const hjLabel = aktuellesHj ? String(aktuellesHj.jahr) : "—";

  // Vergleichsdaten + Stellenist-Details + Regeldeputate laden
  let vergleiche: Awaited<ReturnType<typeof getAktuelleVergleiche>> = [];
  let stellenistDaten: Awaited<ReturnType<typeof getAktuelleStellenisteAlleSchulen>> = [];
  let regeldeputateMap = new Map<string, number>();
  if (hjId) {
    [vergleiche, stellenistDaten, regeldeputateMap] = await Promise.all([
      getAktuelleVergleiche(hjId),
      getAktuelleStellenisteAlleSchulen(hjId),
      getRegeldeputateMap(),
    ]);
  }

  // Stellenanteile-KPIs + Befristungen laden
  let saKPIs = { beantragt: 0, genehmigt: 0, genehmigtStellen: 0 };
  let ablaufendeBefristungen: Awaited<ReturnType<typeof getAblaufendeBefristungen>> = [];
  if (hjId) {
    [saKPIs, ablaufendeBefristungen] = await Promise.all([
      getStellenanteileKPIs(hjId),
      getAblaufendeBefristungen(hjId, 90),
    ]);
  }

  // Lehrer-Anzahl pro Schule zaehlen (einzelne GROUP BY Query statt N+1)
  const lehrerCountRows = await db
    .select({
      stammschuleId: lehrer.stammschuleId,
      count: sql<number>`count(*)`,
    })
    .from(lehrer)
    .where(eq(lehrer.aktiv, true))
    .groupBy(lehrer.stammschuleId);

  const lehrerCounts: Record<number, number> = {};
  for (const row of lehrerCountRows) {
    if (row.stammschuleId) lehrerCounts[row.stammschuleId] = Number(row.count);
  }

  // Vergleichsdaten als Map
  const vergleichMap = new Map(vergleiche.map((v) => [v.schuleId, v]));

  // Stellenist-Daten als Map: schuleId -> { istStundenJanJul, istStundenAugDez }
  const stellenistMap = new Map<number, { istStundenGewichtet: number; regeldeputat: number }>();
  for (const si of stellenistDaten) {
    if (!stellenistMap.has(si.schuleId)) {
      stellenistMap.set(si.schuleId, { istStundenGewichtet: 0, regeldeputat: Number(si.regelstundendeputat ?? 0) });
    }
    const entry = stellenistMap.get(si.schuleId)!;
    const avg = Number(si.monatsDurchschnittStunden ?? 0);
    if (si.zeitraum === "jan-jul") {
      entry.istStundenGewichtet += avg * 7;
    } else {
      entry.istStundenGewichtet += avg * 5;
    }
  }

  return (
    <PageContainer>
      <Header
        title="Dashboard"
        subtitle={`Uebersicht aller Schulen — Haushaltsjahr ${hjLabel}`}
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {schulen.map((schule) => {
        const vgl = vergleichMap.get(schule.id);
        const lehrerCount = lehrerCounts[schule.id] ?? 0;

        const stellensoll = vgl
          ? Number(vgl.stellensoll).toLocaleString("de-DE", { minimumFractionDigits: 1 })
          : "—";
        const stellenist = vgl
          ? Number(vgl.stellenist).toLocaleString("de-DE", { minimumFractionDigits: 1 })
          : "—";
        const differenz = vgl ? Number(vgl.differenz) : null;
        const differenzStr =
          differenz !== null
            ? (differenz > 0 ? "+" : "") +
              differenz.toLocaleString("de-DE", { minimumFractionDigits: 1 })
            : "—";

        const status: "success" | "warning" | "danger" | "neutral" =
          differenz === null
            ? "neutral"
            : differenz <= 0
              ? "success"
              : differenz <= 0.5
                ? "warning"
                : "danger";

        return (
          <div key={schule.id} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: schule.farbe }}
              />
              <h2 className="text-lg font-bold text-[#1A1A1A]">
                {schule.name} ({schule.kurzname})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Stellensoll"
                value={stellensoll}
                subtitle="Berechneter Bedarf"
                accentColor={schule.farbe}
              />
              <KPICard
                label="Stellenist"
                value={stellenist}
                subtitle="Tatsaechliche Stellen"
                accentColor={schule.farbe}
              />
              <KPICard
                label="Differenz"
                value={differenzStr}
                subtitle={
                  status === "success"
                    ? "Im Soll"
                    : status === "warning"
                      ? "Grenzbereich"
                      : status === "danger"
                        ? "Ueber Soll"
                        : "Berechnung ausstehend"
                }
                status={status}
              />
              <KPICard
                label="Lehrkraefte"
                value={lehrerCount > 0 ? String(lehrerCount) : "—"}
                subtitle={lehrerCount > 0 ? "Aktive Lehrkraefte" : "Noch kein Sync"}
                status="neutral"
              />
            </div>

            {/* Deputatstundenrahmen */}
            {(() => {
              const rd = regeldeputateMap.get(schule.kurzname) ?? 0;
              const sollStellen = vgl ? Number(vgl.stellensoll) : 0;
              const sollStunden = rd > 0 && sollStellen > 0 ? sollStellen * rd : null;

              const siData = stellenistMap.get(schule.id);
              const istStunden = siData ? Math.round((siData.istStundenGewichtet / 12) * 100) / 100 : null;

              const stundenDiff = sollStunden !== null && istStunden !== null
                ? Math.round((istStunden - sollStunden) * 100) / 100
                : null;

              const stundenStatus: "success" | "warning" | "danger" | "neutral" =
                stundenDiff === null
                  ? "neutral"
                  : stundenDiff <= 0
                    ? "success"
                    : stundenDiff <= rd * 0.5
                      ? "warning"
                      : "danger";

              return (sollStunden !== null || istStunden !== null) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                  <KPICard
                    label="Deputat-Soll"
                    value={sollStunden !== null
                      ? sollStunden.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Std."
                      : "—"}
                    subtitle="Wochenstundenrahmen"
                    accentColor={schule.farbe}
                  />
                  <KPICard
                    label="Deputat-Ist"
                    value={istStunden !== null
                      ? istStunden.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Std."
                      : "—"}
                    subtitle="Tatsaechliche Wochenstunden"
                    accentColor={schule.farbe}
                  />
                  <KPICard
                    label="Stunden-Differenz"
                    value={stundenDiff !== null
                      ? (stundenDiff > 0 ? "+" : "") + stundenDiff.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " Std."
                      : "—"}
                    subtitle={
                      stundenStatus === "success"
                        ? "Noch Stunden verfuegbar"
                        : stundenStatus === "warning"
                          ? "Nahe am Limit"
                          : stundenStatus === "danger"
                            ? "Ueber dem Rahmen"
                            : "Berechnung ausstehend"
                    }
                    status={stundenStatus}
                  />
                  <KPICard
                    label="Regeldeputat"
                    value={rd > 0
                      ? rd.toLocaleString("de-DE", { minimumFractionDigits: 1 }) + " Std."
                      : "—"}
                    subtitle={rd > 0 ? "Pflichtstd./Vollzeitstelle" : "Nicht konfiguriert"}
                    status="neutral"
                  />
                </div>
              ) : null;
            })()}
          </div>
        );
      })}

      {/* Stellenanteile KPIs */}
      {(saKPIs.genehmigt > 0 || saKPIs.beantragt > 0 || ablaufendeBefristungen.length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-[#1A1A1A] mb-4">Stellenanteile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Genehmigte Stellenanteile"
              value={saKPIs.genehmigtStellen.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
              subtitle={`${saKPIs.genehmigt} Eintraege`}
              status="success"
            />
            <KPICard
              label="Offene Antraege"
              value={String(saKPIs.beantragt)}
              subtitle="Status: Beantragt"
              status={saKPIs.beantragt > 0 ? "warning" : "neutral"}
            />
            <KPICard
              label="Ablaufende Befristungen"
              value={String(ablaufendeBefristungen.length)}
              subtitle="Innerhalb 90 Tage"
              status={ablaufendeBefristungen.length > 0 ? "danger" : "success"}
            />
            {ablaufendeBefristungen.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
                <div className="font-bold text-red-800 mb-2">Naechste Ablaufe:</div>
                {ablaufendeBefristungen.slice(0, 3).map((b) => (
                  <div key={b.id} className="text-red-700 mb-1">
                    <span className="font-medium">{b.schuleKurzname}</span>{" "}
                    {b.stellenartBezeichnung}
                    {b.lehrerName ? ` (${b.lehrerName})` : ""} —{" "}
                    <span className="font-bold">
                      {b.befristetBis ? new Date(b.befristetBis + "T00:00:00").toLocaleDateString("de-DE") : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync-Status */}
      <div className="mt-4 p-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Letzter n8n-Sync:</span>
          <span className="font-medium">
            {latestSync
              ? new Date(latestSync.syncDatum).toLocaleString("de-DE")
              : "Noch keine Synchronisation"}
          </span>
        </div>
      </div>

      {/* Hinweis wenn keine Berechnungen */}
      {vergleiche.length === 0 && (
        <div className="mt-4 p-4 bg-[#FEF7CC] border border-[#FBC900] rounded-lg text-sm text-[#575756]">
          <strong>Hinweis:</strong> Es liegen noch keine Berechnungsergebnisse vor.
          Gehen Sie zur Seite &quot;Stellensoll&quot;, um die erste Berechnung
          durchzufuehren.
        </div>
      )}
    </PageContainer>
  );
}
