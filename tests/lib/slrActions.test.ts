import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks muessen vor den Imports stehen
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));

const requireWriteAccessMock = vi.fn();
vi.mock("@/lib/auth/permissions", () => ({
  requireWriteAccess: () => requireWriteAccessMock(),
}));

const writeAuditLogMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args),
}));

const getAlleSchulStufenMock = vi.fn();
const getBenoetigteSchulStufenMock = vi.fn();
const getSchuljahrByIdMock = vi.fn();
const getVorgaengerSchuljahrMock = vi.fn();
const uebernehmeFehlendeSlrWerteMock = vi.fn();
vi.mock("@/lib/db/queries", () => ({
  getAlleSchulStufen: (...args: unknown[]) => getAlleSchulStufenMock(...args),
  getBenoetigteSchulStufen: (...args: unknown[]) => getBenoetigteSchulStufenMock(...args),
  getSchuljahrById: (...args: unknown[]) => getSchuljahrByIdMock(...args),
  getVorgaengerSchuljahr: (...args: unknown[]) => getVorgaengerSchuljahrMock(...args),
  uebernehmeFehlendeSlrWerte: (...args: unknown[]) => uebernehmeFehlendeSlrWerteMock(...args),
}));

// db.select().from().where() fuer Duplikat-Pruefung, Laden und Historie-Zaehlung,
// db.insert().values().returning() fuer das Anlegen, db.delete().where() fuer das Loeschen
const dbSelectMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbDeleteWhereMock = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: () => ({ values: (...args: unknown[]) => dbInsertValuesMock(...args) }),
    delete: () => ({ where: (...args: unknown[]) => dbDeleteWhereMock(...args) }),
  },
}));

import {
  createSlrWertAction,
  updateSlrWertAction,
  deleteSlrWertAction,
  uebernehmeSlrAusVorjahrAction,
} from "@/app/slr-konfiguration/actions";

/**
 * So sieht der Fehler in Produktion aus: drizzle-orm wrappt jede Treiber-Exception in
 * DrizzleQueryError ("Failed query: ..."), der PostgresError mit code haengt nur an .cause.
 */
function drizzleUniqueError(): Error {
  return Object.assign(new Error('Failed query: insert into "slr_werte" ...\nparams: 3,Gymnasium Sek II'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint "slr_werte_unique"'), {
      code: "23505",
    }),
  });
}

// Benoetigt: aktive Stufen an aktiven Schulen (getBenoetigteSchulStufen filtert schon per Join)
const benoetigteSchulStufen = [
  { id: 1, schuleId: 1, stufe: "Sek I", schulformTyp: "Gesamtschule Sek I", aktiv: true },
  { id: 2, schuleId: 1, stufe: "Sek II", schulformTyp: "Gesamtschule Sek II", aktiv: true },
  { id: 3, schuleId: 2, stufe: "Sek I", schulformTyp: "Gymnasium Sek I (G9)", aktiv: true },
  { id: 4, schuleId: 2, stufe: "Sek II", schulformTyp: "Gymnasium Sek II ", aktiv: true },
];
// Zulaessig: zusaetzlich eine deaktivierte Stufe — sie kann am Stichtag noch Schuelerzahlen haben
const alleSchulStufen = [
  ...benoetigteSchulStufen,
  { id: 5, schuleId: 3, stufe: "Primarstufe", schulformTyp: "Grundschule", aktiv: false },
];

const sj2526 = { id: 2, bezeichnung: "2025/2026", startDatum: "2025-08-01", endDatum: "2026-07-31", aktiv: true };
const sj2627 = { id: 3, bezeichnung: "2026/2027", startDatum: "2026-08-01", endDatum: "2027-07-31", aktiv: false };

/** Ergebnis fuer einen db.select(...).from(...).where(...)-Aufruf */
function selectErgebnis(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireWriteAccessMock.mockResolvedValue({ name: "TestUser", rolle: "mitarbeiter" });
  getAlleSchulStufenMock.mockResolvedValue(alleSchulStufen);
  getBenoetigteSchulStufenMock.mockResolvedValue(benoetigteSchulStufen);
  // Default: keine vorhandenen SLR-Werte im Schuljahr
  dbSelectMock.mockReturnValue(selectErgebnis([]));
  dbInsertValuesMock.mockReturnValue({ returning: () => Promise.resolve([{ id: 42 }]) });
  dbDeleteWhereMock.mockResolvedValue(undefined);
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("createSlrWertAction", () => {
  it("blockt ohne Schreibrecht (requireWriteAccess rejected) und greift nicht auf die DB zu", async () => {
    requireWriteAccessMock.mockRejectedValueOnce(new Error("Nicht autorisiert."));
    await expect(
      createSlrWertAction(fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation: "12,70" })),
    ).rejects.toThrow();
    expect(getAlleSchulStufenMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("lehnt einen Typ ab, der zu keiner Schulstufe gehoert (Vorfall 'GYM G9') und schreibt nichts", async () => {
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "GYM G9", relation: "19,87" }),
    );
    expect(result).toEqual({
      error: 'Schulform-Typ "GYM G9" gehoert zu keiner Schulstufe. Bitte aus der Auswahl waehlen.',
    });
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("akzeptiert den Typ einer INAKTIVEN Schulstufe (Grundschule) — zulaessig, auch wenn nicht benoetigt", async () => {
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Grundschule", relation: "21,95" }),
    );
    expect(result).toEqual({ success: true, message: 'SLR "Grundschule" hinzugefuegt.' });
    // Validierung laeuft gegen ALLE Schulstufen, nicht gegen die benoetigten
    expect(getAlleSchulStufenMock).toHaveBeenCalledTimes(1);
    expect(getBenoetigteSchulStufenMock).not.toHaveBeenCalled();
    expect(dbInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ schuljahrId: 3, schulformTyp: "Grundschule", relation: "21.95" }),
    );
  });

  it("lehnt 'Gesamtschule SEK I' ab, obwohl 'Gesamtschule Sek I' existiert (Gross-/Kleinschreibung)", async () => {
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gesamtschule SEK I", relation: "18,63" }),
    );
    expect(result).toHaveProperty("error");
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it("akzeptiert einen bekannten Typ, legt an, auditiert und revalidiert /stellensoll", async () => {
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "  Gymnasium Sek II ", relation: "12,70", quelle: "§ 8 VO" }),
    );
    expect(result).toEqual({ success: true, message: 'SLR "Gymnasium Sek II" hinzugefuegt.' });
    expect(dbInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        schuljahrId: 3,
        schulformTyp: "Gymnasium Sek II",
        relation: "12.70",
        quelle: "§ 8 VO",
        geaendertVon: "TestUser",
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "slr_werte", 42, "INSERT", null,
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
      "TestUser",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/slr-konfiguration");
    expect(revalidatePathMock).toHaveBeenCalledWith("/stellensoll");
  });

  it("meldet ein Duplikat (normalisiert verglichen) ohne Insert", async () => {
    dbSelectMock.mockReturnValueOnce(
      selectErgebnis([{ id: 7, schuljahrId: 3, schulformTyp: "Gymnasium Sek II ", relation: "12.70" }]),
    );
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation: "13,00" }),
    );
    expect(result).toEqual({ error: 'SLR fuer "Gymnasium Sek II" existiert bereits in diesem Schuljahr.' });
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("uebersetzt eine Unique-Constraint-Verletzung (23505) in eine deutsche Meldung statt 500", async () => {
    const err = Object.assign(new Error('duplicate key value violates unique constraint "slr_werte_unique"'), {
      code: "23505",
    });
    dbInsertValuesMock.mockReturnValueOnce({ returning: () => Promise.reject(err) });
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation: "12,70" }),
    );
    expect(result).toEqual({ error: 'SLR fuer "Gymnasium Sek II" existiert bereits in diesem Schuljahr.' });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("erkennt die Unique-Verletzung auch im DrizzleQueryError-Wrapper (code nur in .cause)", async () => {
    dbInsertValuesMock.mockReturnValueOnce({ returning: () => Promise.reject(drizzleUniqueError()) });
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation: "12,70" }),
    );
    expect(result).toEqual({ error: 'SLR fuer "Gymnasium Sek II" existiert bereits in diesem Schuljahr.' });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("liefert bei sonstigen DB-Fehlern eine generische deutsche Meldung (kein 'unique'-Textraten)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbInsertValuesMock.mockReturnValueOnce({
      returning: () => Promise.reject(new Error("Failed query: insert ... unique_violation_text_without_code")),
    });
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation: "12,70" }),
    );
    expect(result).toEqual({ error: "Fehler beim Anlegen des SLR-Werts." });
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("verwirft ungueltige Relation ohne DB-Call", async () => {
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation: "abc" }),
    );
    expect(result).toHaveProperty("error");
    expect(getAlleSchulStufenMock).not.toHaveBeenCalled();
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });

  it.each(["0", "0,00", "0.0"])("lehnt Relation %s ab — eine 0-Zeile waere fuer die Berechnung 'fehlend', im Dropdown aber belegt", async (relation) => {
    const result = await createSlrWertAction(
      fd({ schuljahrId: "3", schulformTyp: "Gymnasium Sek II", relation }),
    );
    expect(result).toEqual({ error: "Schueler je Stelle muss groesser als 0 sein." });
    expect(getAlleSchulStufenMock).not.toHaveBeenCalled();
    expect(dbInsertValuesMock).not.toHaveBeenCalled();
  });
});

describe("updateSlrWertAction", () => {
  it("lehnt Relation 0 auch beim Bearbeiten ab, ohne DB-Zugriff", async () => {
    const result = await updateSlrWertAction(fd({ id: "7", relation: "0,00", grund: "Test" }));
    expect(result).toEqual({ error: "Schueler je Stelle muss groesser als 0 sein." });
    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });
});

describe("deleteSlrWertAction", () => {
  const bestand = {
    id: 7,
    schuljahrId: 3,
    schulformTyp: "Gymnasium Sek II",
    relation: "12.70",
    quelle: "§ 8 VO",
    geaendertVon: "TestUser",
  };
  const nichtLoeschbar =
    'SLR-Wert fuer "Gymnasium Sek II" wurde bereits bearbeitet und hat eine Aenderungshistorie — ' +
    'er kann nicht geloescht werden. Bitte den Wert ueber "Bearbeiten" korrigieren.';

  it("blockt ohne Schreibrecht (requireWriteAccess rejected) und greift nicht auf die DB zu", async () => {
    requireWriteAccessMock.mockRejectedValueOnce(new Error("Nicht autorisiert."));
    await expect(deleteSlrWertAction(fd({ id: "7" }))).rejects.toThrow();
    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(dbDeleteWhereMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("liefert Fehler, wenn der Wert nicht existiert", async () => {
    const result = await deleteSlrWertAction(fd({ id: "99" }));
    expect(result).toEqual({ error: "SLR-Wert nicht gefunden." });
    expect(dbDeleteWhereMock).not.toHaveBeenCalled();
  });

  it("lehnt das Loeschen bei vorhandener Aenderungshistorie ab — kein Delete, kein Audit", async () => {
    dbSelectMock
      .mockReturnValueOnce(selectErgebnis([bestand]))   // Wert laden
      .mockReturnValueOnce(selectErgebnis([{ n: 2 }])); // Historie zaehlen
    const result = await deleteSlrWertAction(fd({ id: "7" }));
    expect(result).toEqual({ error: nichtLoeschbar });
    expect(dbDeleteWhereMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("loescht ohne Historie, auditiert mit schuljahrId und quelle und revalidiert beide Pfade", async () => {
    dbSelectMock
      .mockReturnValueOnce(selectErgebnis([bestand]))
      .mockReturnValueOnce(selectErgebnis([{ n: 0 }]));
    const result = await deleteSlrWertAction(fd({ id: "7" }));
    expect(result).toEqual({ success: true, message: 'SLR "Gymnasium Sek II" geloescht.' });
    expect(dbDeleteWhereMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "slr_werte", 7, "DELETE",
      { schuljahrId: 3, schulformTyp: "Gymnasium Sek II", relation: "12.70", quelle: "§ 8 VO" },
      null,
      "TestUser",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/slr-konfiguration");
    expect(revalidatePathMock).toHaveBeenCalledWith("/stellensoll");
  });

  it("uebersetzt eine FK-Verletzung (23503 in .cause, Historie parallel entstanden) in dieselbe deutsche Meldung", async () => {
    dbSelectMock
      .mockReturnValueOnce(selectErgebnis([bestand]))
      .mockReturnValueOnce(selectErgebnis([{ n: 0 }]));
    dbDeleteWhereMock.mockRejectedValueOnce(
      Object.assign(new Error('Failed query: delete from "slr_werte" ...'), {
        cause: Object.assign(
          new Error('update or delete on table "slr_werte" violates foreign key constraint "slr_historie_slr_wert_id_slr_werte_id_fk"'),
          { code: "23503" },
        ),
      }),
    );
    const result = await deleteSlrWertAction(fd({ id: "7" }));
    expect(result).toEqual({ error: nichtLoeschbar });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("liefert bei sonstigen DB-Fehlern eine generische deutsche Meldung statt zu werfen", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    dbSelectMock
      .mockReturnValueOnce(selectErgebnis([bestand]))
      .mockReturnValueOnce(selectErgebnis([{ n: 0 }]));
    dbDeleteWhereMock.mockRejectedValueOnce(new Error("connection refused"));
    const result = await deleteSlrWertAction(fd({ id: "7" }));
    expect(result).toEqual({ error: "Fehler beim Loeschen des SLR-Werts." });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});

describe("uebernehmeSlrAusVorjahrAction", () => {
  it("blockt ohne Schreibrecht (requireWriteAccess rejected) und greift nicht auf die DB zu", async () => {
    requireWriteAccessMock.mockRejectedValueOnce(new Error("Nicht autorisiert."));
    await expect(uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }))).rejects.toThrow();
    expect(getSchuljahrByIdMock).not.toHaveBeenCalled();
    expect(getVorgaengerSchuljahrMock).not.toHaveBeenCalled();
    expect(uebernehmeFehlendeSlrWerteMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("liefert Fehler bei ungueltiger Schuljahr-ID", async () => {
    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "x" }));
    expect(result).toEqual({ error: "Ungueltiges Schuljahr." });
    expect(getSchuljahrByIdMock).not.toHaveBeenCalled();
  });

  it("liefert Fehler, wenn das Schuljahr nicht existiert", async () => {
    getSchuljahrByIdMock.mockResolvedValueOnce(null);
    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "99" }));
    expect(result).toEqual({ error: "Schuljahr nicht gefunden." });
    expect(uebernehmeFehlendeSlrWerteMock).not.toHaveBeenCalled();
  });

  it("liefert Fehler ohne Vorgaenger-Schuljahr", async () => {
    getSchuljahrByIdMock.mockResolvedValueOnce(sj2627);
    getVorgaengerSchuljahrMock.mockResolvedValueOnce(null);
    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }));
    expect(result).toEqual({ error: "Kein Vorgaenger-Schuljahr gefunden." });
    expect(getVorgaengerSchuljahrMock).toHaveBeenCalledWith("2026-08-01");
    expect(uebernehmeFehlendeSlrWerteMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("uebernimmt n Werte: Meldung nennt Anzahl und Vorgaenger, Audit-Log genau einmal", async () => {
    getSchuljahrByIdMock.mockResolvedValueOnce(sj2627);
    getVorgaengerSchuljahrMock.mockResolvedValueOnce(sj2526);
    const werte = [
      { schulformTyp: "Gesamtschule Sek I", relation: "18.63" },
      { schulformTyp: "Gymnasium Sek I (G9)", relation: "19.87" },
      { schulformTyp: "Gymnasium Sek II", relation: "12.70" },
    ];
    uebernehmeFehlendeSlrWerteMock.mockResolvedValueOnce(werte);

    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }));

    expect(result).toEqual({ success: true, message: "3 SLR-Werte aus 2025/2026 uebernommen — bitte pruefen." });
    expect(uebernehmeFehlendeSlrWerteMock).toHaveBeenCalledTimes(1);
    expect(uebernehmeFehlendeSlrWerteMock).toHaveBeenCalledWith({
      zielSchuljahrId: 3,
      vonSchuljahrId: 2,
      vonBezeichnung: "2025/2026",
      // normalisiert + sortiert aus den benoetigten Schulstufen (aktiv, an aktiver Schule)
      benoetigteTypen: ["Gesamtschule Sek I", "Gesamtschule Sek II", "Gymnasium Sek I (G9)", "Gymnasium Sek II"],
      benutzer: "TestUser",
    });
    expect(writeAuditLogMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "slr_werte", 3, "INSERT", null,
      { uebernommenAus: "2025/2026", werte },
      "TestUser",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/slr-konfiguration");
    expect(revalidatePathMock).toHaveBeenCalledWith("/stellensoll");
  });

  it("uebergibt nur benoetigte Typen — der Typ einer inaktiven Stufe (Grundschule) wird NICHT kopiert", async () => {
    getSchuljahrByIdMock.mockResolvedValueOnce(sj2627);
    getVorgaengerSchuljahrMock.mockResolvedValueOnce(sj2526);
    uebernehmeFehlendeSlrWerteMock.mockResolvedValueOnce([]);

    await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }));

    expect(getBenoetigteSchulStufenMock).toHaveBeenCalledTimes(1);
    expect(getAlleSchulStufenMock).not.toHaveBeenCalled();
    const { benoetigteTypen } = uebernehmeFehlendeSlrWerteMock.mock.calls[0][0] as { benoetigteTypen: string[] };
    expect(benoetigteTypen).not.toContain("Grundschule");
    expect(benoetigteTypen).toEqual(["Gesamtschule Sek I", "Gesamtschule Sek II", "Gymnasium Sek I (G9)", "Gymnasium Sek II"]);
  });

  it("meldet 0 kopierte Werte als Erfolg mit Hinweis, ohne Audit-Log", async () => {
    getSchuljahrByIdMock.mockResolvedValueOnce(sj2627);
    getVorgaengerSchuljahrMock.mockResolvedValueOnce(sj2526);
    uebernehmeFehlendeSlrWerteMock.mockResolvedValueOnce([]);

    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }));

    expect(result).toEqual({
      success: true,
      message: "Keine fehlenden Werte, die aus 2025/2026 uebernommen werden koennten.",
    });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("uebersetzt eine parallele Uebernahme (slr_werte_unique, 23505 in .cause) in eine deutsche Meldung", async () => {
    getSchuljahrByIdMock.mockResolvedValueOnce(sj2627);
    getVorgaengerSchuljahrMock.mockResolvedValueOnce(sj2526);
    uebernehmeFehlendeSlrWerteMock.mockRejectedValueOnce(drizzleUniqueError());

    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }));

    expect(result).toEqual({
      error: "Die SLR-Werte wurden gerade parallel angelegt — bitte Seite neu laden und pruefen.",
    });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    // Die Werte des ersten Aufrufs stehen — Seite muss neu gerendert werden
    expect(revalidatePathMock).toHaveBeenCalledWith("/slr-konfiguration");
    expect(revalidatePathMock).toHaveBeenCalledWith("/stellensoll");
  });

  it("liefert bei sonstigen DB-Fehlern eine deutsche Meldung statt zu werfen", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getSchuljahrByIdMock.mockResolvedValueOnce(sj2627);
    getVorgaengerSchuljahrMock.mockResolvedValueOnce(sj2526);
    uebernehmeFehlendeSlrWerteMock.mockRejectedValueOnce(new Error("connection refused"));

    const result = await uebernehmeSlrAusVorjahrAction(fd({ schuljahrId: "3" }));

    expect(result).toEqual({ error: "Fehler beim Uebernehmen der SLR-Werte." });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
