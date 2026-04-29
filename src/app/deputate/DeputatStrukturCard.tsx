import { Card } from "@/components/ui/Card";
import { GRUPPE_FARBEN, summeDeputatStruktur, type DeputatStrukturRow } from "@/lib/statistikCode";

export type { DeputatStrukturRow };

interface Props {
  rows: DeputatStrukturRow[];
  jahr: number;
}

function fmtH(n: number): string {
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

export function DeputatStrukturCard({ rows, jahr }: Props) {
  if (rows.length === 0) return null;

  const total = summeDeputatStruktur(rows);

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#1A1A1A]">
            Deputatsstruktur (intern)
          </h3>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Aufteilung der Wochenstunden nach Schule und Statistik-Gruppe — Haushaltsjahr {jahr}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRUPPE_FARBEN.beamter.bg }} />
            Beamte
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRUPPE_FARBEN.angestellter.bg }} />
            Angestellte
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GRUPPE_FARBEN.ohne.bg }} />
            Ohne Code
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              <th className="py-2 pr-4">Schule</th>
              <th className="py-2 px-3 text-right">Beamte</th>
              <th className="py-2 px-3 text-right">Angestellte</th>
              <th className="py-2 px-3 text-right">Ohne Code</th>
              <th className="py-2 pl-3 text-right">Gesamt</th>
              <th className="py-2 pl-4 w-[180px]">Verteilung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <SchulRow key={r.schuleId} row={r} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1A1A1A] font-semibold">
              <td className="py-2 pr-4">{total.schulKurzname}</td>
              <td className="py-2 px-3 text-right tabular-nums">
                <div>{fmtH(total.beamteStunden)}</div>
                <div className="text-xs font-normal text-[#6B7280]">{total.beamteAnzahl} Pers.</div>
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                <div>{fmtH(total.angestellteStunden)}</div>
                <div className="text-xs font-normal text-[#6B7280]">{total.angestellteAnzahl} Pers.</div>
              </td>
              <td className="py-2 px-3 text-right tabular-nums">
                <div>{fmtH(total.ohneStunden)}</div>
                <div className="text-xs font-normal text-[#6B7280]">{total.ohneAnzahl} Pers.</div>
              </td>
              <td className="py-2 pl-3 text-right tabular-nums">
                <div>{fmtH(total.gesamtStunden)}</div>
                <div className="text-xs font-normal text-[#6B7280]">{total.gesamtAnzahl} Pers.</div>
              </td>
              <td className="py-2 pl-4">
                <Stacked row={total} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function SchulRow({ row }: { row: DeputatStrukturRow }) {
  return (
    <tr className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA]">
      <td className="py-2 pr-4">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.schulFarbe }} />
          <span className="font-medium">{row.schulKurzname}</span>
        </span>
      </td>
      <td className="py-2 px-3 text-right tabular-nums">
        <div>{row.beamteStunden > 0 ? fmtH(row.beamteStunden) : <span className="text-[#9CA3AF]">—</span>}</div>
        {row.beamteAnzahl > 0 && (
          <div className="text-xs text-[#6B7280]">{row.beamteAnzahl} Pers.</div>
        )}
      </td>
      <td className="py-2 px-3 text-right tabular-nums">
        <div>{row.angestellteStunden > 0 ? fmtH(row.angestellteStunden) : <span className="text-[#9CA3AF]">—</span>}</div>
        {row.angestellteAnzahl > 0 && (
          <div className="text-xs text-[#6B7280]">{row.angestellteAnzahl} Pers.</div>
        )}
      </td>
      <td className="py-2 px-3 text-right tabular-nums">
        <div>{row.ohneStunden > 0 ? fmtH(row.ohneStunden) : <span className="text-[#9CA3AF]">—</span>}</div>
        {row.ohneAnzahl > 0 && (
          <div className="text-xs text-[#6B7280]">{row.ohneAnzahl} Pers.</div>
        )}
      </td>
      <td className="py-2 pl-3 text-right tabular-nums font-medium">
        <div>{fmtH(row.gesamtStunden)}</div>
        <div className="text-xs font-normal text-[#6B7280]">{row.gesamtAnzahl} Pers.</div>
      </td>
      <td className="py-2 pl-4">
        <Stacked row={row} />
      </td>
    </tr>
  );
}

function Stacked({ row }: { row: DeputatStrukturRow }) {
  const total = row.gesamtStunden;
  if (total <= 0) {
    return <div className="h-2 rounded-full bg-[#F3F4F6]" aria-hidden="true" />;
  }
  const beamtePct = (row.beamteStunden / total) * 100;
  const angPct = (row.angestellteStunden / total) * 100;
  const ohnePct = (row.ohneStunden / total) * 100;
  const ariaLabel = `Beamte ${beamtePct.toFixed(0)} Prozent, Angestellte ${angPct.toFixed(0)} Prozent, ohne Code ${ohnePct.toFixed(0)} Prozent`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="h-2 rounded-full overflow-hidden flex"
      title={`Beamte ${beamtePct.toFixed(1)}% · Angestellte ${angPct.toFixed(1)}% · Ohne ${ohnePct.toFixed(1)}%`}
    >
      {beamtePct > 0 && (
        <div aria-hidden="true" style={{ width: `${beamtePct}%`, backgroundColor: GRUPPE_FARBEN.beamter.bg }} />
      )}
      {angPct > 0 && (
        <div aria-hidden="true" style={{ width: `${angPct}%`, backgroundColor: GRUPPE_FARBEN.angestellter.bg }} />
      )}
      {ohnePct > 0 && (
        <div aria-hidden="true" style={{ width: `${ohnePct}%`, backgroundColor: GRUPPE_FARBEN.ohne.bg }} />
      )}
    </div>
  );
}
