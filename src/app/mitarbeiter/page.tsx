import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import {
  getAlleLehrerMitDetails,
  getSchulen,
  getAktuellesHaushaltsjahr,
  getLehrerMitDeputaten,
  getDeputatAenderungen,
  getStatistikCodesAktiv,
} from "@/lib/db/queries";
import { MitarbeiterClient } from "./MitarbeiterClient";
import { berechneLehrerDeputatEffektiv } from "@/lib/berechnungen/deputatEffektiv";

export const dynamic = "force-dynamic";

export default async function MitarbeiterPage() {
  const [alleLehrer, schulen, hj, statistikCodes] = await Promise.all([
    getAlleLehrerMitDetails(),
    getSchulen(),
    getAktuellesHaushaltsjahr(),
    getStatistikCodesAktiv(),
  ]);

  // Taggenauer Durchschnitt pro Lehrer (Monatswerte effektiv, dann gemittelt)
  const deputatByLehrer: Record<number, number> = {};
  if (hj) {
    const [deputate, aenderungen] = await Promise.all([
      getLehrerMitDeputaten(hj.id),
      getDeputatAenderungen(hj.id),
    ]);

    const aenderungenByLehrer = new Map<number, typeof aenderungen>();
    for (const a of aenderungen) {
      const arr = aenderungenByLehrer.get(a.lehrerId) ?? [];
      arr.push(a);
      aenderungenByLehrer.set(a.lehrerId, arr);
    }

    const depByLehrer = new Map<number, Array<{ monat: number; deputatGesamt: number; deputatGes: number; deputatGym: number; deputatBk: number }>>();
    for (const d of deputate) {
      const arr = depByLehrer.get(d.lehrerId) ?? [];
      arr.push({
        monat: d.monat,
        deputatGesamt: Number(d.deputatGesamt ?? 0),
        deputatGes: Number(d.deputatGes ?? 0),
        deputatGym: Number(d.deputatGym ?? 0),
        deputatBk: Number(d.deputatBk ?? 0),
      });
      depByLehrer.set(d.lehrerId, arr);
    }

    for (const [lehrerId, monate] of depByLehrer) {
      const eff = berechneLehrerDeputatEffektiv(
        monate,
        aenderungenByLehrer.get(lehrerId) ?? [],
        hj.jahr,
      );
      const werte: number[] = [];
      for (const r of eff.values()) {
        const v = r.hatKorrektur ? r.effektiv.gesamt : r.pauschal.gesamt;
        if (v > 0) werte.push(v);
      }
      if (werte.length > 0) {
        const avg = werte.reduce((s, v) => s + v, 0) / werte.length;
        deputatByLehrer[lehrerId] = Math.round(avg * 10) / 10;
      }
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
          statistikCode: l.statistikCode,
          statistikBezeichnung: l.statistikBezeichnung,
          statistikGruppe: l.statistikGruppe,
          statistikIstTeilzeit: l.statistikIstTeilzeit,
        }))}
        schulen={schulen.map((s) => ({
          id: s.id,
          kurzname: s.kurzname,
          name: s.name,
          farbe: s.farbe,
        }))}
        statistikCodes={statistikCodes}
      />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Hinweis:</strong> Lehrkraefte der weiterfuehrenden Schulen werden automatisch
        aus Untis synchronisiert. Fuer Grundschulen ohne Untis koennen Lehrkraefte hier
        manuell angelegt werden.
      </div>
    </PageContainer>
  );
}
