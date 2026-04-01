import { db } from "@/db";
import { stellenartTypen } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { StellenartenClient } from "./StellenartenClient";

export const dynamic = "force-dynamic";

export default async function StellenartenPage() {
  // Admin-View: alle Typen laden (auch inaktive)
  const alleStellenarten = await db
    .select()
    .from(stellenartTypen)
    .orderBy(asc(stellenartTypen.sortierung));

  return (
    <PageContainer>
      <Header
        title="Stellenarten verwalten"
        subtitle="Stammdaten fuer zusaetzliche Stellenanteile"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Einstellungen", href: "/einstellungen" },
          { label: "Stellenarten" },
        ]}
      />
      <StellenartenClient stellenarten={alleStellenarten} />
    </PageContainer>
  );
}
