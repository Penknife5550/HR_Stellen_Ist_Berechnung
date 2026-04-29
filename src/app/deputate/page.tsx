import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { MONATE_KURZ } from "@/lib/constants";
import {
  getSchulen,
  getLehrerMitDeputaten,
  getLatestSync,
  getEchteAenderungenAlleLehrer,
  getLehrerStatistikGruppen,
} from "@/lib/db/queries";
import { getSelectedHaushaltsjahr } from "@/lib/haushaltsjahr-utils";
import { HaushaltsjahrSelector } from "@/components/ui/HaushaltsjahrSelector";
import { DeputateClient } from "./DeputateClient";
import { DeputatStrukturCard } from "./DeputatStrukturCard";
import {
  berechneLehrerDeputatEffektiv,
  adaptiereEchteAenderungen,
} from "@/lib/berechnungen/deputatEffektiv";
import {
  buildDeputatStruktur,
  vergleicheLehrerNachSchuleGruppeName,
} from "@/lib/statistikCode";

export default async function DeputatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { hj, hjOptions } = await getSelectedHaushaltsjahr(await searchParams);

  const [schulen, latestSync, lehrerGruppen] = await Promise.all([
    getSchulen(),
    getLatestSync(),
    getLehrerStatistikGruppen(),
  ]);

  if (!hj) {
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

  // Deputate + echte Wertwechsel (Periodenmodell) laden
  const [deputatRaw, echteAenderungen] = await Promise.all([
    getLehrerMitDeputaten(hj.id),
    getEchteAenderungenAlleLehrer(hj.jahr),
  ]);

  // Aenderungs-Flags pro Lehrer ableiten:
  // gehaltsrelevant = Gesamt-Wert hat sich geaendert (delta_gesamt != 0)
  // verteilungsaenderung = nur GES/GYM/BK-Verteilung geaendert
  const lehrerMitGehaltsaenderung = new Set<number>();
  const lehrerMitVerteilungsaenderung = new Set<number>();
  const aenderungenByLehrer = new Map<number, typeof echteAenderungen>();
  for (const a of echteAenderungen) {
    const deltaGesamt = Math.abs(Number(a.delta_gesamt));
    if (deltaGesamt > 0.001) {
      lehrerMitGehaltsaenderung.add(a.lehrer_id);
    } else {
      lehrerMitVerteilungsaenderung.add(a.lehrer_id);
    }
    const arr = aenderungenByLehrer.get(a.lehrer_id) ?? [];
    arr.push(a);
    aenderungenByLehrer.set(a.lehrer_id, arr);
  }

  // Daten zu Lehrer-Objekten gruppieren (inkl. schulspezifischer Deputate)
  type MonatDetail = {
    gesamt: number;
    ges: number;
    gym: number;
    bk: number;
  };

  type LehrerDeputat = {
    lehrerId: number;
    name: string;
    stammschuleCode: string | null;
    stammschuleId: number | null;
    stunden: (number | null)[];
    monatsDetails: (MonatDetail | null)[];
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
        monatsDetails: Array(12).fill(null),
      });
    }
    const l = lehrerMap.get(row.lehrerId)!;
    const monatIdx = row.monat - 1;
    l.stunden[monatIdx] = row.deputatGesamt ? Number(row.deputatGesamt) : null;
    l.monatsDetails[monatIdx] = {
      gesamt: Number(row.deputatGesamt ?? 0),
      ges: Number(row.deputatGes ?? 0),
      gym: Number(row.deputatGym ?? 0),
      bk: Number(row.deputatBk ?? 0),
    };
  }

  // Taggenaue Korrektur pro Lehrer anwenden — aus echten Wertwechseln (Periodenmodell)
  const lehrerKorrekturFlags = new Map<number, boolean[]>(); // lehrerId -> Array[12] bool
  for (const l of lehrerMap.values()) {
    const monatsDaten = l.monatsDetails
      .map((d, i) => d ? ({
        monat: i + 1,
        deputatGesamt: d.gesamt,
        deputatGes: d.ges,
        deputatGym: d.gym,
        deputatBk: d.bk,
      }) : null)
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const adaptiert = adaptiereEchteAenderungen(
      aenderungenByLehrer.get(l.lehrerId) ?? [],
      hj.jahr,
    );
    const eff = berechneLehrerDeputatEffektiv(monatsDaten, adaptiert, hj.jahr);
    const korrFlags: boolean[] = Array(12).fill(false);
    for (const [monat, r] of eff) {
      if (!r.hatKorrektur) continue;
      const idx = monat - 1;
      korrFlags[idx] = true;
      l.stunden[idx] = r.effektiv.gesamt;
      l.monatsDetails[idx] = {
        gesamt: r.effektiv.gesamt,
        ges: r.effektiv.ges,
        gym: r.effektiv.gym,
        bk: r.effektiv.bk,
      };
    }
    lehrerKorrekturFlags.set(l.lehrerId, korrFlags);
  }

  // Statistik-Gruppe pro Lehrer (fuer Sortierung Schule -> Gruppe -> Name)
  const gruppeByLehrer = new Map<number, string | null>();
  for (const ld of lehrerGruppen) {
    gruppeByLehrer.set(ld.id, ld.statistikGruppe);
  }

  const lehrerListe = Array.from(lehrerMap.values()).sort((a, b) =>
    vergleicheLehrerNachSchuleGruppeName(
      { stammschule: a.stammschuleCode, gruppe: gruppeByLehrer.get(a.lehrerId) ?? null, name: a.name },
      { stammschule: b.stammschuleCode, gruppe: gruppeByLehrer.get(b.lehrerId) ?? null, name: b.name },
    )
  );

  // Farbmap fuer Schulen
  const schulFarben: Record<string, string> = {};
  for (const s of schulen) {
    schulFarben[s.kurzname] = s.farbe;
  }

  // Deputatsstruktur: Aggregation pro (Schule, Statistik-Gruppe) via Pure Helper
  // (gruppeByLehrer wurde oben fuer Sortierung schon gebaut)
  const strukturRows = buildDeputatStruktur({
    schulen: schulen.map((s) => ({ id: s.id, kurzname: s.kurzname, farbe: s.farbe })),
    lehrer: lehrerListe.map((l) => {
      const positive = l.stunden.filter((s): s is number => s != null && s > 0);
      const avg = positive.length > 0 ? positive.reduce((a, b) => a + b, 0) / positive.length : 0;
      return {
        lehrerId: l.lehrerId,
        stammschuleId: l.stammschuleId,
        gruppe: gruppeByLehrer.get(l.lehrerId) ?? null,
        avgStunden: avg,
      };
    }),
  });

  const syncText = latestSync
    ? `Letzte Synchronisation: ${latestSync.syncDatum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "Noch keine Synchronisation durchgefuehrt";

  return (
    <PageContainer>
      <Header
        title="Deputatsuebersicht"
        subtitle={`Monatliche Wochenstunden pro Lehrkraft — Haushaltsjahr ${hj.jahr}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deputate" },
        ]}
      />
      {hjOptions.length > 1 && <div className="flex justify-end mb-4"><HaushaltsjahrSelector options={hjOptions} selectedJahr={hj.jahr} /></div>}

      {strukturRows.length > 0 && (
        <DeputatStrukturCard rows={strukturRows} jahr={hj.jahr} />
      )}

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
        <>
          {/* Warnungs-Banner fuer gehaltsrelevante Aenderungen */}
          {lehrerMitGehaltsaenderung.size > 0 && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-[#E2001A] rounded-lg flex items-start gap-3">
              <span className="text-2xl">⚠</span>
              <div>
                <p className="font-bold text-[#E2001A] text-[15px]">
                  {lehrerMitGehaltsaenderung.size} Lehrkraft/Lehrkraefte mit gehaltsrelevanter Deputatsaenderung
                </p>
                <p className="text-sm text-[#575756] mt-1">
                  Bei diesen Lehrkraeften hat sich das Gesamtdeputat (PlannedWeek) geaendert.
                  Dies beeinflusst die Verguetung. Klicken Sie auf den Namen fuer Details.
                </p>
              </div>
            </div>
          )}

          <DeputateClient
            lehrerListe={lehrerListe.map((l) => ({
              ...l,
              stunden: l.stunden,
              monatsDetails: l.monatsDetails,
              hatGehaltsaenderung: lehrerMitGehaltsaenderung.has(l.lehrerId),
              hatVerteilungsaenderung: lehrerMitVerteilungsaenderung.has(l.lehrerId),
              taggenauKorrektur: lehrerKorrekturFlags.get(l.lehrerId) ?? Array(12).fill(false),
            }))}
            schulen={schulen.map((s) => ({
              id: s.id,
              kurzname: s.kurzname,
              farbe: s.farbe,
            }))}
            schulFarben={schulFarben}
            anzahlGehaltsaenderungen={lehrerMitGehaltsaenderung.size}
          />
        </>
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
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E2001A]" />
          Gehaltsrelevant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FBC900]" />
          Verteilung
        </span>
        <span className="ml-auto">{syncText}</span>
      </div>
    </PageContainer>
  );
}
