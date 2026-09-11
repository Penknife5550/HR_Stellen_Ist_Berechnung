import { describe, it, expect } from "vitest";
import {
  findeSchuljahrFuerStichtag,
  baueSlrLookup,
  normalisiereSchulformTyp,
  findeSlrKonflikte,
  ermittleBenoetigteSchulformTypen,
  ermittleZulaessigeSchulformTypen,
  ermittleFehlendeSlrTypen,
  ermittleVerwaisteSlrTypen,
  findeVorgaengerSchuljahr,
  filterUebernehmbareSlrWerte,
  baueUebernahmeQuelle,
  formatiereRelationDE,
  ermittleSlrVorschlag,
} from "@/lib/berechnungen/schuljahrZuordnung";

const schuljahre = [
  { id: 1, bezeichnung: "2024/2025", startDatum: "2024-08-01", endDatum: "2025-07-31" },
  { id: 2, bezeichnung: "2025/2026", startDatum: "2025-08-01", endDatum: "2026-07-31" },
  { id: 3, bezeichnung: "2026/2027", startDatum: "2026-08-01", endDatum: "2027-07-31" },
];

describe("findeSchuljahrFuerStichtag", () => {
  it("ordnet den Vorjahres-Stichtag (Jan-Jul HJ 2026) dem Schuljahr 2025/2026 zu", () => {
    expect(findeSchuljahrFuerStichtag(schuljahre, "2025-10-15")?.bezeichnung).toBe("2025/2026");
  });

  it("ordnet den laufenden Stichtag (Aug-Dez HJ 2026) dem Schuljahr 2026/2027 zu", () => {
    expect(findeSchuljahrFuerStichtag(schuljahre, "2026-10-15")?.bezeichnung).toBe("2026/2027");
  });

  it("behandelt die Grenzen inklusive (01.08. und 31.07.)", () => {
    expect(findeSchuljahrFuerStichtag(schuljahre, "2026-08-01")?.bezeichnung).toBe("2026/2027");
    expect(findeSchuljahrFuerStichtag(schuljahre, "2026-07-31")?.bezeichnung).toBe("2025/2026");
  });

  it("liefert null, wenn kein Schuljahr den Stichtag abdeckt (nicht angelegt)", () => {
    const ohne2627 = schuljahre.filter((sj) => sj.id !== 3);
    expect(findeSchuljahrFuerStichtag(ohne2627, "2026-10-15")).toBeNull();
  });

  it("nimmt bei Ueberlappung das spaeter beginnende Schuljahr", () => {
    const ueberlappend = [
      ...schuljahre,
      { id: 9, bezeichnung: "2026/2027 alt", startDatum: "2026-07-01", endDatum: "2027-07-31" },
    ];
    expect(findeSchuljahrFuerStichtag(ueberlappend, "2026-10-15")?.id).toBe(3);
  });

  it("ist unabhaengig von der Reihenfolge der Eingabe", () => {
    const rueckwaerts = [...schuljahre].reverse();
    expect(findeSchuljahrFuerStichtag(rueckwaerts, "2025-10-15")?.id).toBe(2);
  });
});

describe("baueSlrLookup", () => {
  it("baut den Lookup aus numeric-Strings der DB", () => {
    const lookup = baueSlrLookup([
      { schulformTyp: "Gymnasium Sek I (G9)", relation: "19.87" },
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
    ]);
    expect(lookup["Gymnasium Sek I (G9)"]).toBe(19.87);
    expect(lookup["Gymnasium Sek II"]).toBe(12.7);
  });

  it("trimmt Leerzeichen im Schulform-Typ (Freitext-Eingabe)", () => {
    const lookup = baueSlrLookup([{ schulformTyp: "  Gesamtschule Sek I ", relation: "18.63" }]);
    expect(lookup["Gesamtschule Sek I"]).toBe(18.63);
    expect(lookup[normalisiereSchulformTyp(" Gesamtschule Sek I")]).toBe(18.63);
  });

  it("uebernimmt Werte <= 0 nicht, damit sie als fehlend erkannt werden", () => {
    const lookup = baueSlrLookup([
      { schulformTyp: "Grundschule", relation: "0" },
      { schulformTyp: "Hauptschule", relation: "17.86" },
    ]);
    expect(lookup["Grundschule"]).toBeUndefined();
    expect(lookup["Hauptschule"]).toBe(17.86);
  });
});

describe("findeSlrKonflikte", () => {
  it("meldet Typen, die nur durch Leerzeichen abweichen und verschiedene Relationen tragen", () => {
    const konflikte = findeSlrKonflikte([
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
      { schulformTyp: "Gymnasium Sek II ", relation: "13.00" },
      { schulformTyp: "Grundschule", relation: "21.95" },
    ]);
    expect(konflikte).toEqual(["Gymnasium Sek II"]);
  });

  it("wertet gleiche Relation nicht als Konflikt", () => {
    expect(
      findeSlrKonflikte([
        { schulformTyp: "Grundschule", relation: "21.95" },
        { schulformTyp: " Grundschule", relation: 21.95 },
      ])
    ).toEqual([]);
  });

  it("liefert eine leere Liste ohne Duplikate", () => {
    expect(findeSlrKonflikte([{ schulformTyp: "Gesamtschule Sek I", relation: "18.63" }])).toEqual([]);
  });
});

// Typen der aktiven Schulstufen, wie sie /einstellungen -> Schulstufen liefert
const benoetigteTypen = ["Gesamtschule Sek I", "Gesamtschule Sek II", "Gymnasium Sek I (G9)", "Gymnasium Sek II"];

describe("ermittleBenoetigteSchulformTypen", () => {
  it("normalisiert, dedupliziert und sortiert die Typen aktiver Schulstufen", () => {
    const typen = ermittleBenoetigteSchulformTypen([
      { schulformTyp: "Gymnasium Sek II", aktiv: true },
      { schulformTyp: " Gymnasium Sek II", aktiv: true },
      { schulformTyp: "Gesamtschule Sek I ", aktiv: true },
      { schulformTyp: "Gesamtschule Sek I" },
    ]);
    expect(typen).toEqual(["Gesamtschule Sek I", "Gymnasium Sek II"]);
  });

  it("ignoriert inaktive Schulstufen", () => {
    const typen = ermittleBenoetigteSchulformTypen([
      { schulformTyp: "Grundschule", aktiv: false },
      { schulformTyp: "Hauptschule", aktiv: true },
    ]);
    expect(typen).toEqual(["Hauptschule"]);
  });

  it("laesst leere Typen weg", () => {
    expect(ermittleBenoetigteSchulformTypen([{ schulformTyp: "   " }])).toEqual([]);
  });
});

describe("ermittleZulaessigeSchulformTypen", () => {
  it("enthaelt auch die Typen inaktiver Schulstufen (deaktivierte Stufe mit Schuelerzahlen am Stichtag)", () => {
    // aktiv wird bewusst ignoriert — dieselben Zeilen, die ermittleBenoetigteSchulformTypen filtert
    const stufen = [
      { schulformTyp: "Grundschule", aktiv: false },
      { schulformTyp: "Hauptschule", aktiv: true },
    ];
    expect(ermittleZulaessigeSchulformTypen(stufen)).toEqual(["Grundschule", "Hauptschule"]);
    expect(ermittleBenoetigteSchulformTypen(stufen)).toEqual(["Hauptschule"]);
  });

  it("normalisiert, dedupliziert und sortiert wie ermittleBenoetigteSchulformTypen", () => {
    const typen = ermittleZulaessigeSchulformTypen([
      { schulformTyp: "Gymnasium Sek II" },
      { schulformTyp: " Gymnasium Sek II" },
      { schulformTyp: "Gesamtschule Sek I " },
      { schulformTyp: "Gesamtschule Sek I" },
    ]);
    expect(typen).toEqual(["Gesamtschule Sek I", "Gymnasium Sek II"]);
  });

  it("laesst leere Typen weg", () => {
    expect(ermittleZulaessigeSchulformTypen([{ schulformTyp: "   " }])).toEqual([]);
  });

  it("ist eine Obermenge der benoetigten Typen derselben Stufen", () => {
    const stufen = [
      { schulformTyp: "Grundschule", aktiv: false },
      { schulformTyp: "Gymnasium Sek I (G9)", aktiv: true },
      { schulformTyp: "Gymnasium Sek II", aktiv: true },
    ];
    const zulaessig = ermittleZulaessigeSchulformTypen(stufen);
    for (const typ of ermittleBenoetigteSchulformTypen(stufen)) expect(zulaessig).toContain(typ);
    expect(zulaessig).toContain("Grundschule");
  });
});

describe("ermittleFehlendeSlrTypen", () => {
  it("meldet den Vorfall vom 10.09.2026: 'Gesamtschule SEK I' ist NICHT 'Gesamtschule Sek I'", () => {
    const fehlend = ermittleFehlendeSlrTypen(benoetigteTypen, [
      { schulformTyp: "Gesamtschule SEK I", relation: "18.63" },
      { schulformTyp: "GYM G9", relation: "19.87" },
      { schulformTyp: "GYM Sek II", relation: "12.70" },
      { schulformTyp: "Gesamtschule Sek II", relation: "12.58" },
    ]);
    expect(fehlend).toEqual(["Gesamtschule Sek I", "Gymnasium Sek I (G9)", "Gymnasium Sek II"]);
  });

  it("zaehlt die Leerzeichen-Variante als vorhanden", () => {
    const fehlend = ermittleFehlendeSlrTypen(
      ["Gesamtschule Sek I"],
      [{ schulformTyp: " Gesamtschule Sek I ", relation: "18.63" }]
    );
    expect(fehlend).toEqual([]);
  });

  it("zaehlt relation '0' als fehlend", () => {
    const fehlend = ermittleFehlendeSlrTypen(
      ["Gesamtschule Sek I", "Gymnasium Sek II"],
      [
        { schulformTyp: "Gesamtschule Sek I", relation: "0" },
        { schulformTyp: "Gymnasium Sek II", relation: 12.7 },
      ]
    );
    expect(fehlend).toEqual(["Gesamtschule Sek I"]);
  });

  it("liefert alle benoetigten Typen, wenn das Schuljahr keine Werte hat", () => {
    expect(ermittleFehlendeSlrTypen(benoetigteTypen, [])).toEqual(benoetigteTypen);
  });
});

describe("ermittleVerwaisteSlrTypen", () => {
  it("meldet Tippfehler-Typen, die zu keiner aktiven Schulstufe gehoeren", () => {
    const verwaist = ermittleVerwaisteSlrTypen(benoetigteTypen, [
      { schulformTyp: "Gesamtschule SEK I" },
      { schulformTyp: "GYM G9" },
      { schulformTyp: "Gymnasium Sek II" },
    ]);
    expect(verwaist).toEqual(["Gesamtschule SEK I", "GYM G9"]);
  });

  it("wertet die Leerzeichen-Variante nicht als verwaist", () => {
    expect(ermittleVerwaisteSlrTypen(["Gymnasium Sek II"], [{ schulformTyp: "Gymnasium Sek II " }])).toEqual([]);
  });

  it("dedupliziert verwaiste Typen nach Normalisierung", () => {
    expect(
      ermittleVerwaisteSlrTypen(["Gymnasium Sek II"], [{ schulformTyp: "GYM G9" }, { schulformTyp: " GYM G9" }])
    ).toEqual(["GYM G9"]);
  });
});

describe("findeVorgaengerSchuljahr", () => {
  it("liefert das zuletzt begonnene Schuljahr vor dem Startdatum", () => {
    expect(findeVorgaengerSchuljahr(schuljahre, "2026-08-01")?.bezeichnung).toBe("2025/2026");
  });

  it("liefert null fuer das aelteste Schuljahr", () => {
    expect(findeVorgaengerSchuljahr(schuljahre, "2024-08-01")).toBeNull();
  });

  it("schliesst das gleiche Startdatum aus (Grenze exklusiv)", () => {
    expect(findeVorgaengerSchuljahr(schuljahre, "2025-08-01")?.id).toBe(1);
  });

  it("nimmt bei Ueberlappung das spaeter beginnende Schuljahr", () => {
    const ueberlappend = [
      ...schuljahre,
      { id: 9, bezeichnung: "2025/2026 alt", startDatum: "2025-07-01", endDatum: "2026-07-31" },
    ];
    expect(findeVorgaengerSchuljahr(ueberlappend, "2026-08-01")?.id).toBe(2);
  });

  it("ist unabhaengig von der Reihenfolge der Eingabe", () => {
    expect(findeVorgaengerSchuljahr([...schuljahre].reverse(), "2026-08-01")?.id).toBe(2);
  });
});

describe("filterUebernehmbareSlrWerte", () => {
  const vorlagen = [
    { id: 1, schulformTyp: "Gesamtschule Sek I", relation: "18.63" },
    { id: 2, schulformTyp: "Gesamtschule Sek II", relation: "12.58" },
    { id: 3, schulformTyp: "Gymnasium Sek I (G9)", relation: "19.87" },
    { id: 4, schulformTyp: "Grundschule", relation: "21.95" },
  ];

  it("kopiert nur benoetigte Typen, die im Ziel fehlen", () => {
    const ergebnis = filterUebernehmbareSlrWerte(
      vorlagen,
      [{ schulformTyp: "Gesamtschule Sek II" }],
      benoetigteTypen
    );
    expect(ergebnis.map((v) => v.id)).toEqual([1, 3]);
  });

  it("ueberschreibt vorhandene Werte auch dann nicht, wenn sie nur durch Leerzeichen abweichen", () => {
    const ergebnis = filterUebernehmbareSlrWerte(
      vorlagen,
      [{ schulformTyp: " Gesamtschule Sek I " }],
      ["Gesamtschule Sek I"]
    );
    expect(ergebnis).toEqual([]);
  });

  it("laesst verwaiste Typen des Vorgaengers weg (Grundschule ohne aktive Schulstufe)", () => {
    const ergebnis = filterUebernehmbareSlrWerte(vorlagen, [], benoetigteTypen);
    expect(ergebnis.map((v) => v.schulformTyp)).not.toContain("Grundschule");
    expect(ergebnis).toHaveLength(3);
  });

  it("nimmt bei doppelten Vorlagen (nur Leerzeichen-Unterschied) die erste", () => {
    const ergebnis = filterUebernehmbareSlrWerte(
      [
        { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
        { schulformTyp: "Gymnasium Sek II ", relation: "13.00" },
      ],
      [],
      ["Gymnasium Sek II"]
    );
    expect(ergebnis).toEqual([{ schulformTyp: "Gymnasium Sek II", relation: "12.70" }]);
  });

  it("liefert leer, wenn das Ziel bereits alle benoetigten Typen hat", () => {
    const ergebnis = filterUebernehmbareSlrWerte(
      vorlagen,
      benoetigteTypen.map((t) => ({ schulformTyp: t })),
      benoetigteTypen
    );
    expect(ergebnis).toEqual([]);
  });

  it("kopiert keine 0-Werte (waeren im Ziel sofort wieder 'fehlend', der Typ aber belegt)", () => {
    const ergebnis = filterUebernehmbareSlrWerte(
      [
        { schulformTyp: "Gesamtschule Sek I", relation: "0" },
        { schulformTyp: "Gesamtschule Sek II", relation: "0.00" },
        { schulformTyp: "Gymnasium Sek I (G9)", relation: 19.87 },
      ],
      [],
      benoetigteTypen
    );
    expect(ergebnis).toEqual([{ schulformTyp: "Gymnasium Sek I (G9)", relation: 19.87 }]);
  });
});

describe("formatiereRelationDE", () => {
  it("formatiert numeric-Strings der DB mit zwei Nachkommastellen und Komma", () => {
    expect(formatiereRelationDE("12.7")).toBe("12,70");
    expect(formatiereRelationDE("18.63")).toBe("18,63");
  });

  it("formatiert Zahlen (Standardwerte aus constants.ts)", () => {
    expect(formatiereRelationDE(18.63)).toBe("18,63");
    expect(formatiereRelationDE(41.64)).toBe("41,64");
  });
});

describe("baueUebernahmeQuelle", () => {
  it("stellt den Pruef-Vermerk vor die Originalquelle", () => {
    expect(baueUebernahmeQuelle("2025/2026", "§ 8 VO zu § 93 Abs. 2 SchulG")).toBe(
      "uebernommen aus 2025/2026 — pruefen | § 8 VO zu § 93 Abs. 2 SchulG"
    );
  });

  it("liefert ohne Originalquelle nur den Vermerk", () => {
    expect(baueUebernahmeQuelle("2025/2026", null)).toBe("uebernommen aus 2025/2026 — pruefen");
  });

  it("kuerzt auf die Spaltenlaenge 200, der Vermerk ueberlebt", () => {
    const quelle = baueUebernahmeQuelle("2025/2026", "x".repeat(300));
    expect(quelle).toHaveLength(200);
    expect(quelle.startsWith("uebernommen aus 2025/2026 — pruefen | ")).toBe(true);
  });

  it("ersetzt einen vorhandenen Uebernahme-Vermerk statt ihn zu verketten", () => {
    expect(
      baueUebernahmeQuelle("2026/2027", "uebernommen aus 2025/2026 — pruefen | § 8 VO zu § 93 Abs. 2 SchulG")
    ).toBe("uebernommen aus 2026/2027 — pruefen | § 8 VO zu § 93 Abs. 2 SchulG");
  });

  it("entfernt auch mehrfach verkettete Vermerke aus Altdaten", () => {
    expect(
      baueUebernahmeQuelle(
        "2027/2028",
        "uebernommen aus 2026/2027 — pruefen | uebernommen aus 2025/2026 — pruefen | § 8 VO"
      )
    ).toBe("uebernommen aus 2027/2028 — pruefen | § 8 VO");
  });

  it("liefert nur den neuen Vermerk, wenn die Originalquelle nur aus einem Vermerk bestand", () => {
    expect(baueUebernahmeQuelle("2026/2027", "uebernommen aus 2025/2026 — pruefen")).toBe(
      "uebernommen aus 2026/2027 — pruefen"
    );
  });
});

describe("ermittleSlrVorschlag", () => {
  const defaults = { "Gesamtschule Sek I": 18.63, "Gymnasium Sek II": 12.7 };
  const defaultsQuelle = "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)";
  const vorgaenger = {
    bezeichnung: "2025/2026",
    werte: [
      { schulformTyp: "Gesamtschule Sek I", relation: "18.90", quelle: "Bewirtschaftungserlass 2025/26" },
      { schulformTyp: " Gymnasium Sek II ", relation: "12.58", quelle: null },
      { schulformTyp: "Grundschule", relation: "0", quelle: null },
    ],
  };

  it("nimmt den Vorjahreswert vor dem Standardwert, Quelle mit Uebernahme-Vermerk", () => {
    expect(ermittleSlrVorschlag("Gesamtschule Sek I", vorgaenger, defaults, defaultsQuelle)).toEqual({
      relation: "18,90",
      quelle: "uebernommen aus 2025/2026 — pruefen | Bewirtschaftungserlass 2025/26",
      herkunft: "vorjahr",
    });
  });

  it("findet den Vorjahreswert auch in der Leerzeichen-Variante, ohne Originalquelle nur der Vermerk", () => {
    expect(ermittleSlrVorschlag("Gymnasium Sek II", vorgaenger, defaults, defaultsQuelle)).toEqual({
      relation: "12,58",
      quelle: "uebernommen aus 2025/2026 — pruefen",
      herkunft: "vorjahr",
    });
  });

  it("wertet Vorjahres-Relation 0 als nicht vorhanden und faellt auf den Standardwert zurueck", () => {
    expect(
      ermittleSlrVorschlag("Grundschule", vorgaenger, { ...defaults, Grundschule: 21.95 }, defaultsQuelle)
    ).toEqual({ relation: "21,95", quelle: defaultsQuelle, herkunft: "standard" });
  });

  it("nimmt ohne Vorgaenger den Standardwert mit exakter Quelle", () => {
    expect(ermittleSlrVorschlag("Gymnasium Sek II", null, defaults, defaultsQuelle)).toEqual({
      relation: "12,70",
      quelle: "§ 8 VO zu § 93 Abs. 2 SchulG (GV. NRW. S. 349 vom 28.06.2024)",
      herkunft: "standard",
    });
  });

  it("vergleicht die Standardwert-Keys normalisiert", () => {
    expect(
      ermittleSlrVorschlag(" Gymnasium Sek II ", null, { "Gymnasium Sek II ": 12.7 }, defaultsQuelle).herkunft
    ).toBe("standard");
  });

  it("liefert leer fuer unbekannte Typen", () => {
    expect(ermittleSlrVorschlag("Berufskolleg Dual", vorgaenger, defaults, defaultsQuelle)).toEqual({
      relation: "",
      quelle: "",
      herkunft: null,
    });
  });
});
