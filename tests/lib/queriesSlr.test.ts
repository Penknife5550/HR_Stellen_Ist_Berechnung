import { describe, it, expect, vi, beforeEach } from "vitest";
import { asc, eq } from "drizzle-orm";
import { schuljahre, slrWerte } from "@/db/schema";
import { baueUebernahmeQuelle } from "@/lib/berechnungen/schuljahrZuordnung";

/**
 * Tests an der DB-Grenze fuer die SLR-Uebernahme (uebernehmeFehlendeSlrWerte) und die
 * Schuljahr-Anlage (createSchuljahr): welche Zeilen der Insert bekommt, ob der Konflikt-
 * Schluessel stimmt und was zurueckgegeben wird. Beide laufen in db.transaction(tx => ...) —
 * der Mock reicht ein tx durch, dessen Ketten die Argumente erfassen.
 */

// tx.select(sel).from(t).where(cond) — direkt awaitbar ODER .orderBy(...) awaitbar.
// Die Zeilen des naechsten SELECT liefert txSelectRowsMock (Warteschlange per mockReturnValueOnce).
const txSelectRowsMock = vi.fn();
const txWhereMock = vi.fn();
const txOrderByMock = vi.fn();
// tx.insert(t).values(v) — direkt awaitbar ODER .onConflictDoNothing(opts).returning(sel) / .returning(sel)
const txInsertMock = vi.fn();
const txValuesMock = vi.fn();
const txOnConflictMock = vi.fn();
const txReturningMock = vi.fn();

function selectKette(rows: unknown[]) {
  return {
    orderBy: (...args: unknown[]) => {
      txOrderByMock(...args);
      return Promise.resolve(rows);
    },
    then: (onFulfilled?: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  };
}

function insertKette() {
  return {
    onConflictDoNothing: (...args: unknown[]) => {
      txOnConflictMock(...args);
      return { returning: (...sel: unknown[]) => txReturningMock(...sel) };
    },
    returning: (...sel: unknown[]) => txReturningMock(...sel),
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(undefined).then(onFulfilled, onRejected),
  };
}

const tx = {
  select: () => ({
    from: () => ({
      where: (...args: unknown[]) => {
        txWhereMock(...args);
        return selectKette(txSelectRowsMock() as unknown[]);
      },
    }),
  }),
  insert: (...args: unknown[]) => {
    txInsertMock(...args);
    return {
      values: (...v: unknown[]) => {
        txValuesMock(...v);
        return insertKette();
      },
    };
  },
};

vi.mock("@/db", () => ({
  db: {
    transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx),
  },
}));

import { createSchuljahr, uebernehmeFehlendeSlrWerte } from "@/lib/db/queries";

beforeEach(() => {
  vi.clearAllMocks();
  txSelectRowsMock.mockReturnValue([]);
  txReturningMock.mockResolvedValue([]);
});

/** Spaltennamen eines Konflikt-Targets — unabhaengig von der Objektidentitaet der Drizzle-Columns */
function spaltenNamen(opts: unknown): string[] {
  return ((opts as { target: Array<{ name: string }> }).target).map((c) => c.name);
}

describe("uebernehmeFehlendeSlrWerte", () => {
  const params = {
    zielSchuljahrId: 3,
    vonSchuljahrId: 2,
    vonBezeichnung: "2025/2026",
    benoetigteTypen: ["Gesamtschule Sek I", "Gymnasium Sek I (G9)", "Gymnasium Sek II"],
    benutzer: "TestUser",
  };
  // Vorlagen des Vorgaengers: einer schon im Ziel, einer mit Leerzeichen + altem Vermerk,
  // einer nicht benoetigt (Grundschule), einer mit Relation 0
  const vorlagen = [
    { id: 10, schuljahrId: 2, schulformTyp: "Gesamtschule Sek I", relation: "18.63", quelle: "§ 8 VO" },
    { id: 11, schuljahrId: 2, schulformTyp: "Gymnasium Sek II ", relation: "12.70", quelle: "uebernommen aus 2024/2025 — pruefen | § 8 VO" },
    { id: 12, schuljahrId: 2, schulformTyp: "Grundschule", relation: "21.95", quelle: null },
    { id: 13, schuljahrId: 2, schulformTyp: "Gymnasium Sek I (G9)", relation: "0.00", quelle: null },
  ];
  const vorhandene = [{ schulformTyp: "Gesamtschule Sek I" }];

  it("(a) kopiert nur benoetigte, fehlende Typen: values() genau einmal, Typ normalisiert, Vermerk ersetzt", async () => {
    txSelectRowsMock.mockReturnValueOnce(vorlagen).mockReturnValueOnce(vorhandene);
    txReturningMock.mockResolvedValueOnce([{ schulformTyp: "Gymnasium Sek II", relation: "12.70" }]);

    await uebernehmeFehlendeSlrWerte(params);

    // Vorlagen aus dem Vorgaenger (nach id), Vorhandene aus dem Ziel
    expect(txWhereMock).toHaveBeenCalledTimes(2);
    expect(txWhereMock).toHaveBeenNthCalledWith(1, eq(slrWerte.schuljahrId, 2));
    expect(txWhereMock).toHaveBeenNthCalledWith(2, eq(slrWerte.schuljahrId, 3));
    expect(txOrderByMock).toHaveBeenCalledTimes(1);
    expect(txOrderByMock).toHaveBeenCalledWith(asc(slrWerte.id));

    expect(txInsertMock).toHaveBeenCalledTimes(1);
    expect(txInsertMock).toHaveBeenCalledWith(slrWerte);
    expect(txValuesMock).toHaveBeenCalledTimes(1);
    expect(txValuesMock).toHaveBeenCalledWith([
      {
        schuljahrId: 3,
        schulformTyp: "Gymnasium Sek II",
        relation: "12.70",
        quelle: baueUebernahmeQuelle("2025/2026", "uebernommen aus 2024/2025 — pruefen | § 8 VO"),
        geaendertVon: "TestUser",
      },
    ]);
    const [zeilen] = txValuesMock.mock.calls[0] as [Array<{ relation: unknown; quelle: string }>];
    expect(typeof zeilen[0].relation).toBe("string");
    expect(zeilen[0].quelle).toBe("uebernommen aus 2025/2026 — pruefen | § 8 VO");
  });

  it("(b) ON CONFLICT DO NOTHING zielt genau auf (schuljahrId, schulformTyp) — den Unique-Schluessel slr_werte_unique", async () => {
    txSelectRowsMock.mockReturnValueOnce(vorlagen).mockReturnValueOnce(vorhandene);

    await uebernehmeFehlendeSlrWerte(params);

    expect(txOnConflictMock).toHaveBeenCalledTimes(1);
    expect(txOnConflictMock).toHaveBeenCalledWith({ target: [slrWerte.schuljahrId, slrWerte.schulformTyp] });
    expect(spaltenNamen(txOnConflictMock.mock.calls[0][0])).toEqual(["schuljahr_id", "schulform_typ"]);
    expect(txReturningMock).toHaveBeenCalledWith({ schulformTyp: slrWerte.schulformTyp, relation: slrWerte.relation });
  });

  it("(c) nichts zu kopieren (Ziel vollstaendig): liefert [] und ruft insert nie auf", async () => {
    txSelectRowsMock
      .mockReturnValueOnce(vorlagen)
      .mockReturnValueOnce(params.benoetigteTypen.map((t) => ({ schulformTyp: t })));

    const ergebnis = await uebernehmeFehlendeSlrWerte(params);

    expect(ergebnis).toEqual([]);
    expect(txInsertMock).not.toHaveBeenCalled();
    expect(txValuesMock).not.toHaveBeenCalled();
    expect(txReturningMock).not.toHaveBeenCalled();
  });

  it("(d) gibt genau das returning()-Ergebnis zurueck — bei Konflikt weniger Zeilen als values()", async () => {
    txSelectRowsMock.mockReturnValueOnce(vorlagen).mockReturnValueOnce([]);
    // Zwei Kandidaten (Gesamtschule Sek I, Gymnasium Sek II), einer wurde parallel schon angelegt
    const eingefuegt = [{ schulformTyp: "Gymnasium Sek II", relation: "12.70" }];
    txReturningMock.mockResolvedValueOnce(eingefuegt);

    const ergebnis = await uebernehmeFehlendeSlrWerte(params);

    expect((txValuesMock.mock.calls[0][0] as unknown[]).length).toBe(2);
    expect(ergebnis).toBe(eingefuegt);
  });
});

describe("createSchuljahr", () => {
  const data = { bezeichnung: "2026/2027", startDatum: "2026-08-01", endDatum: "2027-07-31" };
  const schuljahrNeu = { id: 3, ...data, untisSchoolyearId: null, aktiv: false };
  const slrUebernahme = { vonSchuljahrId: 2, vonBezeichnung: "2025/2026", benutzer: "TestAdmin" };

  it("(e) legt das Schuljahr INAKTIV an und liefert es zurueck", async () => {
    txReturningMock.mockResolvedValueOnce([schuljahrNeu]);

    const { schuljahr } = await createSchuljahr(data);

    expect(txInsertMock).toHaveBeenNthCalledWith(1, schuljahre);
    expect(txValuesMock).toHaveBeenNthCalledWith(1, { ...data, aktiv: false });
    expect(schuljahr).toEqual(schuljahrNeu);
  });

  it("(f) kopiert ALLE Vorgaenger-Werte (auch nicht benoetigte) mit dedupliziertem Vermerk", async () => {
    txReturningMock.mockResolvedValueOnce([schuljahrNeu]);
    const vorlagen = [
      { id: 10, schuljahrId: 2, schulformTyp: "Gesamtschule Sek I", relation: "18.63", quelle: "§ 8 VO" },
      { id: 11, schuljahrId: 2, schulformTyp: "Grundschule", relation: "21.95", quelle: null },
      { id: 12, schuljahrId: 2, schulformTyp: "Gymnasium Sek II", relation: "12.70", quelle: "uebernommen aus 2024/2025 — pruefen | Erlass 2025" },
    ];
    txSelectRowsMock.mockReturnValueOnce(vorlagen);

    const { uebernommen } = await createSchuljahr(data, slrUebernahme);

    expect(txWhereMock).toHaveBeenCalledWith(eq(slrWerte.schuljahrId, 2));
    expect(txInsertMock).toHaveBeenCalledTimes(2);
    expect(txInsertMock).toHaveBeenNthCalledWith(2, slrWerte);
    expect(txValuesMock).toHaveBeenNthCalledWith(2, [
      { schuljahrId: 3, schulformTyp: "Gesamtschule Sek I", relation: "18.63", quelle: "uebernommen aus 2025/2026 — pruefen | § 8 VO", geaendertVon: "TestAdmin" },
      { schuljahrId: 3, schulformTyp: "Grundschule", relation: "21.95", quelle: "uebernommen aus 2025/2026 — pruefen", geaendertVon: "TestAdmin" },
      { schuljahrId: 3, schulformTyp: "Gymnasium Sek II", relation: "12.70", quelle: "uebernommen aus 2025/2026 — pruefen | Erlass 2025", geaendertVon: "TestAdmin" },
    ]);
    expect(uebernommen).toEqual([
      { schulformTyp: "Gesamtschule Sek I", relation: "18.63" },
      { schulformTyp: "Grundschule", relation: "21.95" },
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
    ]);
  });

  it("(g) ohne slrUebernahme: kein SELECT, kein zweiter INSERT, uebernommen leer", async () => {
    txReturningMock.mockResolvedValueOnce([schuljahrNeu]);

    const { uebernommen } = await createSchuljahr(data);

    expect(txWhereMock).not.toHaveBeenCalled();
    expect(txInsertMock).toHaveBeenCalledTimes(1);
    expect(txValuesMock).toHaveBeenCalledTimes(1);
    expect(uebernommen).toEqual([]);
  });

  it("mit slrUebernahme, aber Vorgaenger ohne Werte: kein zweiter INSERT, uebernommen leer", async () => {
    txReturningMock.mockResolvedValueOnce([schuljahrNeu]);
    txSelectRowsMock.mockReturnValueOnce([]);

    const { uebernommen } = await createSchuljahr(data, slrUebernahme);

    expect(txWhereMock).toHaveBeenCalledTimes(1);
    expect(txInsertMock).toHaveBeenCalledTimes(1);
    expect(uebernommen).toEqual([]);
  });
});
