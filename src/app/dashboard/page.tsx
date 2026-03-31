import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { KPICard } from "@/components/ui/Card";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getAktuelleVergleiche,
  getLatestSync,
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

  // Vergleichsdaten laden (falls Berechnungen existieren)
  let vergleiche: Awaited<ReturnType<typeof getAktuelleVergleiche>> = [];
  if (hjId) {
    vergleiche = await getAktuelleVergleiche(hjId);
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
          </div>
        );
      })}

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
