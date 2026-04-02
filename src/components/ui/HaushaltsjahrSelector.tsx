"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type HJOption = {
  id: number;
  jahr: number;
  gesperrt: boolean;
  istAktuell: boolean;
};

interface HaushaltsjahrSelectorProps {
  options: HJOption[];
  selectedJahr: number;
}

/**
 * Dropdown zur Auswahl des Haushaltsjahres.
 * Navigiert via URL-Parameter ?hj=YYYY.
 */
export function HaushaltsjahrSelector({ options, selectedJahr }: HaushaltsjahrSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newJahr = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    const currentYear = new Date().getFullYear();

    if (parseInt(newJahr) === currentYear) {
      // Aktuelles Jahr: Parameter entfernen (saubere URL)
      params.delete("hj");
    } else {
      params.set("hj", newJahr);
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-[#6B7280] font-medium">Haushaltsjahr</label>
      <select
        value={selectedJahr}
        onChange={handleChange}
        className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[15px] font-bold bg-white min-h-[36px] tabular-nums"
      >
        {options.map((o) => (
          <option key={o.jahr} value={o.jahr}>
            {o.jahr}{o.istAktuell ? " (aktuell)" : ""}{o.gesperrt ? " — gesperrt" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
