import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { MONATE_KURZ } from "@/lib/constants";
import {
  getSchulen,
  getAktuellesHaushaltsjahr,
  getLehrerMitDeputaten,
  getLatestSync,
} from "@/lib/db/queries";
import { DeputateClient } from "./DeputateClient";

export default async function DeputatePage() {
  const [schulen, aktuellesHj, latestSync] = await Promise.all([
    getSchulen(),
    getAktuellesHaushaltsjahr(),
    getLatestSync(),
  ]);

  if (!aktuellesHj) {
    return (
      <PageContainer>
        <Header
          title="Deputatsuebersicht"
          subtitle="Monatliche Wochenstunden pro Lehrkraft (Daten aus Untis via n8n)"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Deputate" },
          ]}
        />
        <Card>
          <div className="text-center py-12 text-[#6B7280]">
            <p className="text-lg font-medium">Kein aktuelles Haushaltsjahr gefunden.</p>
          </div>
        </Card>
      </PageContainer>
    );
  }

  // Deputate fuer alle Lehrer laden (ohne Schulfilter)
  const deputatRaw = await getLehrerMitDeputaten(aktuellesHj.id);

  // Daten zu Lehrer-Objekten gruppieren
  type LehrerDeputat = {
    lehrerId: number;
    name: string;
    stammschuleCode: string | null;
    stammschuleId: number | null;
    stunden: (number | null)[];
  };

  const lehrerMap = new Map<number, LehrerDeputat>();
  for (const row of deputatRaw) {
    if (!lehrerMap.has(row.lehrerId)) {
      lehrerMap.set(row.lehrerId, {
        lehrerId: row.lehrerId,
        name: row.name,
        stammschuleCode: row.stammschuleCode,
        stammschuleId: row.stammschuleId,
        stunden: Array(12).fill(null),
      });
    }
    const l = lehrerMap.get(row.lehrerId)!;
    const monatIdx = row.monat - 1; // Monat 1-12 → Index 0-11
    l.stunden[monatIdx] = row.deputatGesamt ? Number(row.deputatGesamt) : null;
  }

  const lehrerListe = Array.from(lehrerMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  // Farbmap fuer Schulen
  const schulFarben: Record<string, string> = {};
  for (const s of schulen) {
    schulFarben[s.kurzname] = s.farbe;
  }

  const syncText = latestSync
    ? `Letzte Synchronisation: ${latestSync.syncDatum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "Noch keine Synchronisation durchgefuehrt";

  return (
    <PageContainer>
      <Header
        title="Deputatsuebersicht"
        subtitle={`Monatliche Wochenstunden pro Lehrkraft — Haushaltsjahr ${aktuellesHj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deputate" },
        ]}
      />

      {lehrerListe.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-[#6B7280]">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-lg font-medium">Noch keine Deputatsdaten vorhanden</p>
            <p className="text-sm mt-2">
              Deputatsdaten werden automatisch ueber den n8n-Workflow synchronisiert.
              <br />
              Sobald Daten aus Untis uebertragen werden, erscheinen sie hier.
            </p>
          </div>
        </Card>
      ) : (
        <DeputateClient
          lehrerListe={lehrerListe.map((l) => ({
            ...l,
            stunden: l.stunden,
          }))}
          schulen={schulen.map((s) => ({
            id: s.id,
            kurzname: s.kurzname,
            farbe: s.farbe,
          }))}
          schulFarben={schulFarben}
        />
      )}

      <div className="mt-4 flex items-center gap-4 text-sm text-[#6B7280]">
        {schulen.map((s) => (
          <span key={s.id} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.farbe }}
            />
            {s.kurzname}
          </span>
        ))}
        <span className="ml-auto">{syncText}</span>
      </div>
    </PageContainer>
  );
}
