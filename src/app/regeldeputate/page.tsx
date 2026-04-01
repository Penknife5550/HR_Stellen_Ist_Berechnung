import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { getAlleRegeldeputate } from "@/lib/db/queries";
import { RegeldeputateClient } from "./RegeldeputateClient";

export const dynamic = "force-dynamic";

export default async function RegeldeputatePage() {
  const regeldeputate = await getAlleRegeldeputate();

  return (
    <PageContainer>
      <Header
        title="Regeldeputate"
        subtitle="Pflichtstunden je Vollzeitstelle nach Schulform (VO zu § 93 Abs. 2 SchulG)"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Regeldeputate" },
        ]}
      />

      <RegeldeputateClient
        regeldeputate={regeldeputate.map((r) => ({
          id: r.id,
          schulformCode: r.schulformCode,
          schulformName: r.schulformName,
          regeldeputat: r.regeldeputat,
          rechtsgrundlage: r.rechtsgrundlage,
          bassFundstelle: r.bassFundstelle,
          gueltigAb: r.gueltigAb,
          bemerkung: r.bemerkung,
        }))}
      />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Rechtsgrundlage:</strong> Die Regeldeputate (Pflichtstunden je Vollzeitstelle)
        sind in <strong>§ 2 Abs. 1 der VO zu § 93 Abs. 2 SchulG NRW</strong> festgelegt
        (BASS 11-11 Nr. 1, zuletzt geaendert am 13.05.2025).
        Bei 25,5 und 27,5 Std. wird innerhalb von drei Schuljahren fuer drei Schulhalbjahre
        auf- und drei Schulhalbjahre abgerundet (§ 2 Abs. 1 Satz 2).
        Die Werte sind Massstab fuer die Stellenberechnung im Rahmen der Ersatzschulfinanzierung.
      </div>
    </PageContainer>
  );
}
