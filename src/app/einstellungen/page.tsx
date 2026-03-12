import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { getSchulen, getLatestSync, getSchuljahre, getHaushaltsjahre } from "@/lib/db/queries";
import { getOptionalSession } from "@/lib/auth/permissions";
import { EinstellungenClient } from "./EinstellungenClient";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const [schulen, latestSync, schuljahreList, haushaltsjahreListe, session] = await Promise.all([
    getSchulen(),
    getLatestSync(),
    getSchuljahre(),
    getHaushaltsjahre(),
    getOptionalSession(),
  ]);

  const isAdmin = session?.rolle === "admin";

  return (
    <PageContainer>
      <Header
        title="Einstellungen"
        subtitle="Schulverwaltung und Systemkonfiguration"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Einstellungen" },
        ]}
      />

      {/* Schuljahre & Haushaltsjahre (interaktiv) */}
      <EinstellungenClient
        schuljahre={schuljahreList}
        haushaltsjahre={haushaltsjahreListe}
        isAdmin={isAdmin}
      />

      {/* Registrierte Schulen (statisch) */}
      <Card className="mt-6 mb-6">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">Registrierte Schulen</h3>

        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-[#575756]">
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Schulnummer</th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Name</th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Kurzname</th>
              <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Schulform</th>
              <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Farbe</th>
              <th className="text-center py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {schulen.map((s, i) => (
              <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                <td className="py-3 px-4 text-[15px] font-mono">{s.schulnummer}</td>
                <td className="py-3 px-4 text-[15px]">{s.name}</td>
                <td className="py-3 px-4">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: s.farbe }}>
                    {s.kurzname}
                  </span>
                </td>
                <td className="py-3 px-4 text-[15px]">{s.schulform}</td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block w-6 h-6 rounded" style={{ backgroundColor: s.farbe }} />
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block w-3 h-3 rounded-full ${s.aktiv ? "bg-[#22C55E]" : "bg-[#D1D5DB]"}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* n8n-Synchronisation (statisch) */}
      <Card>
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">n8n-Synchronisation</h3>
        <div className="space-y-3 text-[15px]">
          <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
            <span className="text-[#6B7280]">Sync-Endpoint:</span>
            <code className="text-sm bg-[#F3F4F6] px-2 py-1 rounded">/api/deputate/sync</code>
          </div>
          <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
            <span className="text-[#6B7280]">Letzter Sync:</span>
            <span className="font-medium">
              {latestSync
                ? new Date(latestSync.syncDatum).toLocaleString("de-DE")
                : "—"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#E5E7EB]">
            <span className="text-[#6B7280]">Sync-Status:</span>
            <span className={`font-medium ${latestSync ? "text-[#22C55E]" : "text-[#F59E0B]"}`}>
              {latestSync
                ? `Erfolgreich (${latestSync.anzahlLehrer} Lehrer)`
                : "Warte auf Verbindung"}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#6B7280]">Anzahl Schulen:</span>
            <span className="font-medium">{schulen.length}</span>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
