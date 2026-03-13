import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { getAllPflichtstunden } from "@/lib/db/queries";
import { getOptionalSession } from "@/lib/auth/permissions";
import { PflichtstundenClient } from "./PflichtstundenClient";

export const dynamic = "force-dynamic";

export default async function PflichtstundenPage() {
  const [pflichtstundenRows, session] = await Promise.all([
    getAllPflichtstunden(),
    getOptionalSession(),
  ]);

  const canEdit = session?.rolle !== "betrachter";

  return (
    <PageContainer>
      <Header
        title="Pflichtstunden-Konfiguration"
        subtitle="Woechentliche Pflichtstunden je Schulform (Vollzeitdeputat)"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Pflichtstunden" },
        ]}
      />

      <PflichtstundenClient
        pflichtstunden={pflichtstundenRows.map((ps) => ({
          id: ps.id,
          schulform: ps.schulform,
          vollzeitDeputat: ps.vollzeitDeputat,
          rechtsgrundlage: ps.rechtsgrundlage,
        }))}
        canEdit={canEdit}
      />
    </PageContainer>
  );
}
