import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { getAlleSchulen, getAlleSchulStufenAdmin, getLatestSync, getSchuljahre, getHaushaltsjahre } from "@/lib/db/queries";
import { getOptionalSession } from "@/lib/auth/permissions";
import { EinstellungenClient } from "./EinstellungenClient";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const [schulen, schulStufen, latestSync, schuljahreList, haushaltsjahreListe, session] = await Promise.all([
    getAlleSchulen(),
    getAlleSchulStufenAdmin(),
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

      {/* Schulen, Schuljahre & Haushaltsjahre (interaktiv) */}
      <EinstellungenClient
        schulen={schulen}
        schulStufen={schulStufen}
        schuljahre={schuljahreList}
        haushaltsjahre={haushaltsjahreListe}
        isAdmin={isAdmin}
      />

      {/* Stammdaten-Verwaltung (Admin-Subseiten) */}
      {isAdmin && (
        <Card className="mb-6">
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-3">Stammdaten</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link
              href="/einstellungen/stellenarten"
              className="block p-4 border border-[#E5E7EB] rounded-lg hover:border-[#575756] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="font-medium text-[#1A1A1A]">Stellenarten</div>
              <div className="text-sm text-[#6B7280] mt-1">
                Stammdaten fuer zusaetzliche Stellenanteile (SBV, Personalrat, etc.)
              </div>
            </Link>
            <Link
              href="/einstellungen/statistik-codes"
              className="block p-4 border border-[#E5E7EB] rounded-lg hover:border-[#575756] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="font-medium text-[#1A1A1A]">Statistik-Codes</div>
              <div className="text-sm text-[#6B7280] mt-1">
                NRW-Personalstatistik-Codes (Beamte/Angestellte) fuer Bezirksregierungs-Exporte
              </div>
            </Link>
          </div>
        </Card>
      )}

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
            <span className="font-medium">{schulen.filter(s => s.aktiv).length}</span>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
