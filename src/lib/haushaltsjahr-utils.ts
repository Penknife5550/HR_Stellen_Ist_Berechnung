/**
 * Utility fuer Haushaltsjahr-Auswahl via URL-Parameter.
 *
 * Jede Seite die ein HJ braucht ruft getSelectedHaushaltsjahr() auf.
 * Das liest ?hj=2025 aus den searchParams oder faellt auf das aktuelle Jahr zurueck.
 */

import { getAlleHaushaltsjahre } from "@/lib/db/queries";

export type HaushaltsjahrOption = {
  id: number;
  jahr: number;
  gesperrt: boolean;
  istAktuell: boolean;
};

/**
 * Laedt alle HJs und bestimmt das ausgewaehlte HJ aus searchParams.
 * Gibt das HJ-Objekt + die Liste aller HJs fuer den Selector zurueck.
 */
export async function getSelectedHaushaltsjahr(
  searchParams: Record<string, string | string[] | undefined>
) {
  const alleHJs = await getAlleHaushaltsjahre();
  if (alleHJs.length === 0) {
    return { hj: null, alleHJs: [], hjOptions: [] };
  }

  const currentYear = new Date().getFullYear();
  const paramJahr = typeof searchParams.hj === "string" ? parseInt(searchParams.hj, 10) : NaN;

  // Gewaehltes HJ: aus URL-Parameter, oder aktuelles Jahr, oder neuestes vorhandenes
  const hj = Number.isFinite(paramJahr)
    ? alleHJs.find((h) => h.jahr === paramJahr) ?? alleHJs[0]
    : alleHJs.find((h) => h.jahr === currentYear) ?? alleHJs[0];

  const hjOptions: HaushaltsjahrOption[] = alleHJs.map((h) => ({
    id: h.id,
    jahr: h.jahr,
    gesperrt: h.gesperrt,
    istAktuell: h.jahr === currentYear,
  }));

  return { hj, alleHJs, hjOptions };
}
