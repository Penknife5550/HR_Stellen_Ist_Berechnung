import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import {
  getSchulen,
  getSchuelerzahlenBySchule,
  getSchulStufenBySchule,
} from "@/lib/db/queries";
import { SchuelerzahlenClient } from "./SchuelerzahlenClient";

export const dynamic = "force-dynamic";

export default async function SchuelerzahlenPage() {
  const schulen = await getSchulen();

  // Fuer jede Schule: Schuelerzahlen + Stufen laden
  const schulenMitDaten = await Promise.all(
    schulen.map(async (schule) => {
      const zahlen = await getSchuelerzahlenBySchule(schule.id);
      const stufen = await getSchulStufenBySchule(schule.id);
      return {
        id: schule.id,
        kurzname: schule.kurzname,
        name: schule.name,
        farbe: schule.farbe,
        stufen: stufen.map((s) => ({
          id: s.id,
          stufe: s.stufe,
          schulformTyp: s.schulformTyp,
        })),
        zahlen: zahlen.map((z) => ({
          id: z.id,
          schulStufeId: z.schulStufeId,
          stichtag: z.stichtag,
          anzahl: z.anzahl,
          bemerkung: z.bemerkung,
          stufe: z.stufe,
          schulformTyp: z.schulformTyp,
          giltFuer: berechneGiltFuer(z.stichtag),
        })),
      };
    })
  );

  return (
    <PageContainer>
      <Header
        title="Schülerzahlen"
        subtitle="Schülerzahlen pro Schule und Stufe verwalten (Stichtag 15. Oktober)"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Schülerzahlen" },
        ]}
      />

      <SchuelerzahlenClient schulen={schulenMitDaten} />

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#575756]">
        <strong>Regelung:</strong> Januar bis Juli = Schülerzahl vom 15.10. des Vorjahres.
        August bis Dezember = Schülerzahl vom 15.10. des laufenden Jahres.
      </div>
    </PageContainer>
  );
}

function berechneGiltFuer(stichtag: string): string {
  // Stichtag ist z.B. "2024-10-15"
  const jahr = parseInt(stichtag.substring(0, 4), 10);
  const folgeJahr = jahr + 1;
  return `Aug-Dez ${jahr} + Jan-Jul ${folgeJahr}`;
}
