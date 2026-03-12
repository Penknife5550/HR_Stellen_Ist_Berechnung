/**
 * Stellensoll-Berechnung (Gesamtpipeline).
 *
 * Stellensoll = Grundstellen + Zuschlaege
 *
 * Gesetzliche Grundlage: § 3 FESchVO, VV zu § 3 FESchVO
 */

import { berechneGrundstellen, type GrundstellenStufe, type GrundstellenErgebnis } from "./grundstellen";
import { roundToDecimals } from "./rounding";

export interface ZuschlagEintrag {
  bezeichnung: string;
  wert: number;             // In Stellen (FTE)
  bemerkung?: string;
}

export interface StellensollInput {
  stufen: GrundstellenStufe[];
  zuschlaege: ZuschlagEintrag[];
}

export interface StellensollErgebnis {
  grundstellen: GrundstellenErgebnis;
  zuschlaege: ZuschlagEintrag[];
  zuschlaegeSumme: number;
  stellensoll: number;       // Endwert: Grundstellen + Zuschlaege, gerundet auf 1 Dezimalstelle
}

/**
 * Berechnet das Stellensoll fuer eine Schule und einen Zeitraum.
 */
export function berechneStellensoll(input: StellensollInput): StellensollErgebnis {
  // 1. Grundstellen berechnen
  const grundstellen = berechneGrundstellen(input.stufen);

  // 2. Zuschlaege summieren
  const zuschlaegeSumme = input.zuschlaege.reduce(
    (sum, z) => sum + z.wert,
    0
  );

  // 3. Stellensoll = Grundstellen (gerundet) + Zuschlaege
  const stellensoll = roundToDecimals(
    grundstellen.grundstellenzahl + zuschlaegeSumme,
    1
  );

  return {
    grundstellen,
    zuschlaege: input.zuschlaege,
    zuschlaegeSumme,
    stellensoll,
  };
}
