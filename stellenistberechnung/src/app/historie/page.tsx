import { PageContainer } from "@/components/layout/PageContainer";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { getBerechnungsHistorie } from "@/lib/db/queries";

function formatDatum(d: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type HistorieEintrag = {
  datum: Date;
  typ: "Stellensoll" | "Stellenist" | "n8n-Sync";
  schule: string;
  farbe: string;
  wert: string;
  benutzer: string;
  istAktuell: boolean;
};

export default async function HistoriePage() {
  const { sollRows, istRows, syncRows } = await getBerechnungsHistorie(50);

  // Eintraege aus allen Quellen zusammenfuehren
  const eintraege: HistorieEintrag[] = [];

  for (const row of sollRows) {
    eintraege.push({
      datum: row.berechnetAm,
      typ: "Stellensoll",
      schule: row.schulKurzname,
      farbe: row.schulFarbe,
      wert: `${Number(row.stellensoll).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${row.zeitraum === "jan-jul" ? "Jan-Jul" : "Aug-Dez"})`,
      benutzer: row.berechnetVon ?? "System",
      istAktuell: row.istAktuell,
    });
  }

  for (const row of istRows) {
    eintraege.push({
      datum: row.berechnetAm,
      typ: "Stellenist",
      schule: row.schulKurzname,
      farbe: row.schulFarbe,
      wert: `${Number(row.stellenistGesamt).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${row.zeitraum === "jan-jul" ? "Jan-Jul" : "Aug-Dez"})`,
      benutzer: row.berechnetVon ?? "System",
      istAktuell: row.istAktuell,
    });
  }

  for (const row of syncRows) {
    eintraege.push({
      datum: row.syncDatum,
      typ: "n8n-Sync",
      schule: "Alle",
      farbe: "#575756",
      wert: row.status === "success"
        ? `${row.anzahlLehrer ?? 0} Lehrer synchronisiert`
        : `Fehler: ${row.fehlerDetails ?? "Unbekannt"}`,
      benutzer: "n8n",
      istAktuell: true,
    });
  }

  // Nach Datum sortieren (neueste zuerst)
  eintraege.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());

  const typFarben: Record<string, string> = {
    Stellensoll: "bg-[#E8F5D6] text-[#4A7A15]",
    Stellenist: "bg-[#DFE8EF] text-[#3B5C7A]",
    "n8n-Sync": "bg-[#FEF7CC] text-[#8B6C00]",
  };

  return (
    <PageContainer>
      <Header
        title="Historie"
        subtitle="Berechnungshistorie und Synchronisationsprotokoll"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Historie" },
        ]}
      />

      {eintraege.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-[#6B7280]">
            <div className="text-4xl mb-3">📜</div>
            <p className="text-lg font-medium">Noch keine Eintraege vorhanden</p>
            <p className="text-sm mt-1">
              Sobald Berechnungen durchgefuehrt oder Daten synchronisiert werden,
              erscheinen sie hier.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 text-sm text-[#6B7280]">
            {eintraege.length} Eintraege insgesamt
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[#575756]">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Datum
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Typ
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Schule
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Wert
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Benutzer
                </th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((h, i) => (
                <tr
                  key={`${h.typ}-${i}`}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}
                >
                  <td className="py-3 px-4 text-[15px] tabular-nums whitespace-nowrap">
                    {formatDatum(h.datum)}
                  </td>
                  <td className="py-3 px-4 text-[15px]">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${typFarben[h.typ] ?? "bg-[#F3F4F6] text-[#575756]"}`}
                    >
                      {h.typ}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[15px]">
                    {h.schule !== "Alle" ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-bold text-white"
                        style={{ backgroundColor: h.farbe }}
                      >
                        {h.schule}
                      </span>
                    ) : (
                      <span className="text-[#6B7280]">{h.schule}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[15px] font-medium tabular-nums">
                    {h.wert}
                  </td>
                  <td className="py-3 px-4 text-sm text-[#6B7280]">{h.benutzer}</td>
                  <td className="py-3 px-4 text-sm">
                    {h.istAktuell ? (
                      <span className="text-[#22C55E] font-medium">Aktuell</span>
                    ) : (
                      <span className="text-[#9CA3AF]">Veraltet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-4 text-sm text-[#6B7280]">
        Alle Berechnungen und Aenderungen werden protokolliert fuer die Bezirksregierung.
      </div>
    </PageContainer>
  );
}
