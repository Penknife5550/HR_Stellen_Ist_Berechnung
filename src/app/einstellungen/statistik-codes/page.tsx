import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { getAlleStatistikCodesAdmin } from "@/lib/db/queries";
import { getOptionalSession } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { StatistikCodesClient } from "./StatistikCodesClient";

export const dynamic = "force-dynamic";

export default async function StatistikCodesPage() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  if (session.rolle !== "admin") redirect("/einstellungen");

  const codes = await getAlleStatistikCodesAdmin();

  return (
    <PageContainer>
      <Header
        title="Statistik-Codes verwalten"
        subtitle="NRW-Personalstatistik-Codes (Beamte/Angestellte) fuer Bezirksregierungs-Exporte"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Einstellungen", href: "/einstellungen" },
          { label: "Statistik-Codes" },
        ]}
      />
      <StatistikCodesClient codes={codes} />
    </PageContainer>
  );
}
