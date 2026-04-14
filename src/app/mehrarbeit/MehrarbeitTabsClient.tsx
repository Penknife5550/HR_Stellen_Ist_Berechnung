"use client";

import { useState } from "react";
import { Building2, Users } from "lucide-react";
import { MehrarbeitClient } from "./MehrarbeitClient";
import { SchulMehrarbeitTable } from "./SchulMehrarbeitTable";

type Schule = { id: number; kurzname: string; farbe: string; name: string };
type Lehrer = { id: number; name: string; stammschuleId: number | null; stammschuleCode: string | null };
type MehrarbeitEintrag = {
  id: number;
  lehrerId: number;
  monat: number;
  stunden: string;
  schuleId: number | null;
  bemerkung: string | null;
  lehrerName: string;
  schulKurzname: string | null;
  schulFarbe: string | null;
};

interface SchulEintrag {
  schuleId: number;
  monat: number;
  stellenanteil: string;
}
interface Bemerkung {
  schuleId: number;
  bemerkung: string;
}

interface Props {
  schulen: Schule[];
  lehrerListe: Lehrer[];
  mehrarbeitEintraege: MehrarbeitEintrag[];
  schulEintraege: SchulEintrag[];
  schulBemerkungen: Bemerkung[];
  haushaltsjahrId: number;
  haushaltsjahrJahr: number;
}

export function MehrarbeitTabsClient({
  schulen,
  lehrerListe,
  mehrarbeitEintraege,
  schulEintraege,
  schulBemerkungen,
  haushaltsjahrId,
  haushaltsjahrJahr,
}: Props) {
  const [tab, setTab] = useState<"schule" | "lehrer">("schule");

  return (
    <>
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab("schule")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "schule"
              ? "text-[#575756] border-[#575756]"
              : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          <Building2 size={16} />
          Pro Schule (Stellenanteile)
        </button>
        <button
          onClick={() => setTab("lehrer")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "lehrer"
              ? "text-[#575756] border-[#575756]"
              : "text-gray-500 border-transparent hover:text-gray-700"
          }`}
        >
          <Users size={16} />
          Pro Lehrkraft (Stunden)
        </button>
      </div>

      {tab === "schule" && (
        <SchulMehrarbeitTable
          schulen={schulen}
          eintraege={schulEintraege}
          bemerkungen={schulBemerkungen}
          haushaltsjahrId={haushaltsjahrId}
          haushaltsjahrJahr={haushaltsjahrJahr}
        />
      )}

      {tab === "lehrer" && (
        <MehrarbeitClient
          schulen={schulen.map((s) => ({ id: s.id, kurzname: s.kurzname, farbe: s.farbe }))}
          lehrerListe={lehrerListe}
          mehrarbeitEintraege={mehrarbeitEintraege}
          haushaltsjahrId={haushaltsjahrId}
          haushaltsjahrJahr={haushaltsjahrJahr}
        />
      )}
    </>
  );
}
