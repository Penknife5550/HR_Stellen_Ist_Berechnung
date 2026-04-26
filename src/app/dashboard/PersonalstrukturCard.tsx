"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { GRUPPE_FARBEN, type StatistikCodeInfo } from "@/lib/statistikCode";

type PerCodeSchule = {
  code: string | null;
  schule: string | null;
  anzahl: number;
};

type Props = {
  codes: StatistikCodeInfo[];
  schulen: string[];
  perCodeSchule: PerCodeSchule[];
  codeAenderungen30T: number;
};

type Tab = "alle" | string;

export function PersonalstrukturCard({
  codes,
  schulen,
  perCodeSchule,
  codeAenderungen30T,
}: Props) {
  const [tab, setTab] = useState<Tab>("alle");

  // Aggregat: anzahl pro Code (gefiltert nach Tab)
  const counts = useMemo(() => {
    const map = new Map<string | null, number>();
    for (const r of perCodeSchule) {
      if (tab !== "alle" && r.schule !== tab) continue;
      const key = r.code; // null = ohne Code
      map.set(key, (map.get(key) ?? 0) + r.anzahl);
    }
    return map;
  }, [perCodeSchule, tab]);

  const beamteSumme = codes
    .filter((c) => c.gruppe === "beamter")
    .reduce((s, c) => s + (counts.get(c.code) ?? 0), 0);
  const angestellteSumme = codes
    .filter((c) => c.gruppe === "angestellter")
    .reduce((s, c) => s + (counts.get(c.code) ?? 0), 0);
  const ohneCode = counts.get(null) ?? 0;
  const gesamt = beamteSumme + angestellteSumme + ohneCode;

  const beamte = codes.filter((c) => c.gruppe === "beamter");
  const angestellte = codes.filter((c) => c.gruppe === "angestellter");

  const beamteBreite = gesamt > 0 ? (beamteSumme / gesamt) * 100 : 0;
  const angestellteBreite = gesamt > 0 ? (angestellteSumme / gesamt) * 100 : 0;
  const ohneCodeBreite = gesamt > 0 ? (ohneCode / gesamt) * 100 : 0;

  // Schul-Filter zum URL-Param fuer Deeplink-Tiles weitergeben
  const schulQuery = tab === "alle" ? "" : `&schule=${encodeURIComponent(tab)}`;

  return (
    <Card className="mb-6">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold text-[#1A1A1A]">Personalstruktur</h3>
          <p className="text-sm text-[#6B7280] mt-0.5">
            NRW-Statistik-Codes nach Rechtsverhältnis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {codeAenderungen30T > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[#E0F2FB] px-2.5 py-1 text-xs text-[#009AC6] font-medium"
              title={`${codeAenderungen30T} Code-Änderungen via Untis-Sync in den letzten 30 Tagen`}
            >
              <span aria-hidden="true">↻</span>
              <span className="tabular-nums">{codeAenderungen30T} Code-Wechsel · 30T</span>
            </span>
          )}
          <div className="text-right">
            <div className="text-2xl font-bold text-[#1A1A1A] tabular-nums">{gesamt}</div>
            <div className="text-xs text-[#6B7280]">aktive Lehrkräfte</div>
          </div>
        </div>
      </div>

      {/* Schul-Tabs */}
      <div
        role="tablist"
        aria-label="Schul-Filter"
        className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[#E5E7EB] p-1 bg-[#F9FAFB] w-fit"
      >
        <TabButton active={tab === "alle"} onClick={() => setTab("alle")}>
          Alle
        </TabButton>
        {schulen.map((s) => (
          <TabButton key={s} active={tab === s} onClick={() => setTab(s)}>
            {s}
          </TabButton>
        ))}
      </div>

      {/* Stacked-Bar */}
      <div
        role="img"
        aria-label={`Beamte ${beamteSumme} (${beamteBreite.toFixed(0)} Prozent), Angestellte ${angestellteSumme} (${angestellteBreite.toFixed(0)} Prozent), ohne Code ${ohneCode} (${ohneCodeBreite.toFixed(0)} Prozent)`}
        className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]"
      >
        {beamteBreite > 0 && (
          <div
            aria-hidden="true"
            style={{ width: `${beamteBreite}%`, backgroundColor: GRUPPE_FARBEN.beamter.bg }}
            title={`Beamte: ${beamteSumme} (${beamteBreite.toFixed(0)}%)`}
          />
        )}
        {angestellteBreite > 0 && (
          <div
            aria-hidden="true"
            style={{ width: `${angestellteBreite}%`, backgroundColor: GRUPPE_FARBEN.angestellter.bg }}
            title={`Angestellte: ${angestellteSumme} (${angestellteBreite.toFixed(0)}%)`}
          />
        )}
        {ohneCodeBreite > 0 && (
          <div
            aria-hidden="true"
            style={{ width: `${ohneCodeBreite}%`, backgroundColor: GRUPPE_FARBEN.ohne.bg }}
            title={`Ohne Code: ${ohneCode} (${ohneCodeBreite.toFixed(0)}%)`}
          />
        )}
      </div>
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280]">
        <Legend color={GRUPPE_FARBEN.beamter.bg} label="Beamte" value={beamteSumme} />
        <Legend color={GRUPPE_FARBEN.angestellter.bg} label="Angestellte" value={angestellteSumme} />
        {ohneCode > 0 && <Legend color={GRUPPE_FARBEN.ohne.bg} label="Ohne Code" value={ohneCode} />}
      </div>

      {/* Zwei-Spalten-Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Block
          titel="Beamte"
          farbe={GRUPPE_FARBEN.beamter.bg}
          summe={beamteSumme}
          codes={beamte}
          counts={counts}
          schulQuery={schulQuery}
        />
        <Block
          titel="Angestellte TV-L"
          farbe={GRUPPE_FARBEN.angestellter.bg}
          summe={angestellteSumme}
          codes={angestellte}
          counts={counts}
          schulQuery={schulQuery}
        />
      </div>

      {/* Footer: Ohne Code */}
      {ohneCode > 0 && (
        <Link
          href={`/mitarbeiter?gruppe=ohne${schulQuery}`}
          className="mt-5 flex items-center gap-3 rounded-lg border border-[#E2001A]/30 bg-red-50 p-3 hover:bg-red-100 transition-colors"
        >
          <span className="text-lg" aria-hidden="true">⚠</span>
          <div className="flex-1 text-sm">
            <strong className="text-[#E2001A]">
              {ohneCode} {ohneCode === 1 ? "Lehrkraft" : "Lehrkräfte"} ohne Statistik-Code
              {tab !== "alle" ? ` an ${tab}` : ""}
            </strong>
            <span className="text-[#575756] ml-2">
              — bitte ergänzen, sonst nicht im Bezirksregierungs-Export.
            </span>
          </div>
          <span className="text-xs text-[#E2001A] font-medium">Prüfen →</span>
        </Link>
      )}
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
        active ? "bg-[#1A1A1A] text-white" : "text-[#575756] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}: <strong className="text-[#1A1A1A] tabular-nums">{value}</strong>
    </span>
  );
}

function Block({
  titel,
  farbe,
  summe,
  codes,
  counts,
  schulQuery,
}: {
  titel: string;
  farbe: string;
  summe: number;
  codes: StatistikCodeInfo[];
  counts: Map<string | null, number>;
  schulQuery: string;
}) {
  const gruppe = codes[0]?.gruppe ?? "";
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-5 rounded-sm" style={{ backgroundColor: farbe }} />
          <h4 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wider">
            {titel}
          </h4>
        </div>
        <Link
          href={`/mitarbeiter?gruppe=${gruppe}${schulQuery}`}
          className="text-xs text-[#6B7280] hover:text-[#1A1A1A] hover:underline tabular-nums"
        >
          {summe} gesamt →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {codes.map((c) => (
          <Tile
            key={c.code}
            stamm={c}
            anzahl={counts.get(c.code) ?? 0}
            schulQuery={schulQuery}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({
  stamm,
  anzahl,
  schulQuery,
}: {
  stamm: StatistikCodeInfo;
  anzahl: number;
  schulQuery: string;
}) {
  const farben = GRUPPE_FARBEN[stamm.gruppe as keyof typeof GRUPPE_FARBEN] ?? GRUPPE_FARBEN.ohne;
  const isLeer = anzahl === 0;
  const kurzbez = stamm.bezeichnung.replace(/^(Beamter|Angestellter)\s+(auf\s+)?/, "");

  return (
    <Link
      href={`/mitarbeiter?gruppe=${stamm.gruppe}&code=${stamm.code}${schulQuery}`}
      className={`group block rounded-lg border p-3 transition-all ${
        isLeer
          ? "border-dashed border-[#E5E7EB] bg-[#FAFAFA] hover:bg-white"
          : "border-[#E5E7EB] bg-white hover:border-[#1A1A1A] hover:shadow-sm"
      }`}
    >
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-bold tabular-nums"
          style={{
            backgroundColor: isLeer ? "#F3F4F6" : farben.bg,
            color: isLeer ? "#9CA3AF" : farben.text,
          }}
        >
          {stamm.code}
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${
            isLeer ? "text-[#D1D5DB]" : "text-[#1A1A1A]"
          }`}
        >
          {anzahl}
        </span>
      </div>
      <div className="text-xs text-[#6B7280] leading-tight" title={stamm.bezeichnung}>
        {kurzbez}
      </div>
      <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mt-1">
        {stamm.istTeilzeit ? "Teilzeit" : "Vollzeit"}
      </div>
    </Link>
  );
}
