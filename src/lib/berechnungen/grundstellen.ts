/**
 * Grundstellenberechnung nach NRW-Recht.
 *
 * Formel: Grundstellenzahl = Schuelerzahl / Schueler-Lehrer-Relation (SLR)
 *
 * KRITISCHE Rundungsregeln (§ 3 FESchVO):
 * 1. Jedes Teilergebnis nach 2 Dezimalstellen ABSCHNEIDEN (nicht runden!)
 * 2. Teilergebnisse addieren
 * 3. Gesamtergebnis auf 1 Dezimalstelle RUNDEN (kaufmaennisch)
 */

import { truncateToDecimals, roundToDecimals } from "./rounding";

export interface GrundstellenStufe {
  stufe: string;           // z.B. "Sek I", "Sek II"
  schulformTyp: string;    // z.B. "Gesamtschule Sek I" (fuer SLR-Lookup)
  schueler: number;        // Schuelerzahl
  slr: number;             // Schueler-Lehrer-Relation
}

export interface GrundstellenTeilErgebnis {
  stufe: string;
  schulformTyp: string;
  schueler: number;
  slr: number;
  ergebnisRoh: number;     // Rohes Divisionsergebnis
  ergebnisTrunc: number;   // Nach 2 Dezimalstellen abgeschnitten
}

export interface GrundstellenErgebnis {
  teilErgebnisse: GrundstellenTeilErgebnis[];
  summeTrunc: number;        // Summe der abgeschnittenen Teilergebnisse
  grundstellenzahl: number;  // Endergebnis: auf 1 Dezimalstelle gerundet
}

/**
 * Berechnet die Grundstellenzahl fuer eine Schule.
 *
 * @param stufen - Array mit Schuelerzahlen und SLR pro Stufe
 * @returns Berechnungsergebnis mit allen Zwischenschritten
 * @throws Error wenn SLR = 0 (Division durch Null)
 */
export function berechneGrundstellen(
  stufen: GrundstellenStufe[]
): GrundstellenErgebnis {
  const teilErgebnisse: GrundstellenTeilErgebnis[] = stufen.map((stufe) => {
    // KRITISCH: SLR darf nicht 0 sein (Division durch Null)
    if (stufe.slr <= 0) {
      throw new Error(
        `SLR fuer "${stufe.schulformTyp}" ist ${stufe.slr}. ` +
        `SLR muss groesser als 0 sein. Bitte SLR-Konfiguration pruefen.`
      );
    }

    const ergebnisRoh = stufe.schueler / stufe.slr;
    const ergebnisTrunc = truncateToDecimals(ergebnisRoh, 2);

    return {
      stufe: stufe.stufe,
      schulformTyp: stufe.schulformTyp,
      schueler: stufe.schueler,
      slr: stufe.slr,
      ergebnisRoh,
      ergebnisTrunc,
    };
  });

  const summeTrunc = teilErgebnisse.reduce(
    (sum, te) => sum + te.ergebnisTrunc,
    0
  );

  const grundstellenzahl = roundToDecimals(summeTrunc, 1);

  return {
    teilErgebnisse,
    summeTrunc,
    grundstellenzahl,
  };
}
