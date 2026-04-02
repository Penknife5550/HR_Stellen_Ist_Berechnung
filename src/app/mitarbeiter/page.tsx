import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { getAlleLehrerMitDetails, getSchulen, getAktuellesHaushaltsjahr } from "@/lib/db/queries";
import { db } from "@/db";
import { deputatMonatlich } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { MitarbeiterClient } from "./MitarbeiterClient";

export const dynamic = "force-dynamic";

export default async function MitarbeiterPage() {
  const [alleLehrer, schulen, hj] = await Promise.all([
    getAlleLehrerMitDetails(),
    getSchulen(),
    getAktuellesHaushaltsjahr(),
  ]);

  // Aktuelles Deputat pro Lehrer laden (Durchschnitt ueber alle Monate mit Daten)
  const deputatByLehrer: Record<number, number> = {};
  if (hj) {
    const depRows = await db
      .select({
        lehrerId: deputatMonatlich.lehrerId,
        avg: sql<string>`ROUND(AVG(NULLIF(${deputatMonatlich.deputatGesamt}::numeric, 0)), 1)`,
      })
      .from(deputatMonatlich)
      .where(eq(deputatMonatlich.haushaltsjahrId, hj.id))
      .groupBy(deputatMonatlich.lehrerId);
    for (const row of depRows) {
      if (row.avg) deputatByLehrer[row.lehrerId] = Number(row.avg);
    }
  }

  return (
    <PageContainer>
      <Header
        title="Mitarbeiter"
        subtitle="Zentrale Verwaltung aller Lehrkraefte"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Mitarbeiter" },
        ]}
      />

      <MitarbeiterClient
        lehrer={alleLehrer.map((l) => ({
          id: l.id,
          untisTeacherId: l.untisTeacherId,
          personalnummer: l.personalnummer,
          vollname: l.vollname,
          vorname: l.vorname,
          nachname: l.nachname,
          stammschuleId: l.stammschuleId,
          schuleKurzname: l.schuleKurzname,
          schuleName: l.schuleName,
          schuleFarbe: l.schuleFarbe,
          quelle: l.quelle,
          aktiv: l.aktiv,
          deputat: deputatByLehrer[l.id] ?? null,
        }))}
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          name: s.name,
          farbe: s.farbe,
        }))}
      />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Hinweis:</strong> Lehrkraefte der weiterfuehrenden Schulen werden automatisch
        aus Untis synchronisiert. Fuer Grundschulen ohne Untis koennen Lehrkraefte hier
        manuell angelegt werden.
      </div>
    </PageContainer>
  );
}
