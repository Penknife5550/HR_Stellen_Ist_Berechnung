import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks muessen vor den Imports stehen
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/auth/permissions", () => ({
  requireAdmin: () => requireAdminMock(),
}));

const writeAuditLogMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLogMock(...args),
}));

const createStatistikCodeMock = vi.fn();
const updateStatistikCodeMock = vi.fn();
vi.mock("@/lib/db/queries", () => ({
  createStatistikCode: (...args: unknown[]) => createStatistikCodeMock(...args),
  updateStatistikCode: (...args: unknown[]) => updateStatistikCodeMock(...args),
}));

// db.select() chain fuer Vorher-Wert in update/toggle
const dbSelectMock = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
  },
}));

import {
  createStatistikCodeAction,
  updateStatistikCodeAction,
  toggleStatistikCodeAktivAction,
} from "@/app/einstellungen/statistik-codes/actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({ name: "TestAdmin", rolle: "admin" });
  // Default db.select chain liefert leeres Array — Tests koennen ueberschreiben
  dbSelectMock.mockReturnValue({
    from: () => ({ where: () => Promise.resolve([]) }),
  });
});

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("createStatistikCodeAction", () => {
  it("blockt Nicht-Admins (requireAdmin throws)", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Nicht autorisiert."));
    await expect(
      createStatistikCodeAction(fd({ code: "L", bezeichnung: "Beamter", gruppe: "beamter", sortierung: "0" })),
    ).rejects.toThrow();
    expect(createStatistikCodeMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("verwirft ungueltige Eingabe ohne DB-Call", async () => {
    // bezeichnung leer → Zod-Fail. (code wird upper-getrimmt, daher hier nicht testbar.)
    const result = await createStatistikCodeAction(
      fd({ code: "L", bezeichnung: "", gruppe: "beamter", sortierung: "0" }),
    );
    expect(result).toHaveProperty("error");
    expect(createStatistikCodeMock).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("HappyPath: legt Code an + schreibt Audit-Log", async () => {
    createStatistikCodeMock.mockResolvedValueOnce({ id: 42 });
    const result = await createStatistikCodeAction(
      fd({ code: "L", bezeichnung: "Beamter Lebenszeit", gruppe: "beamter", sortierung: "10" }),
    );
    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(createStatistikCodeMock).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "statistik_codes", 42, "INSERT", null,
      expect.objectContaining({ code: "L", gruppe: "beamter" }),
      "TestAdmin",
    );
  });

  it("uebersetzt PG-Errorcode 23505 in deutsche Duplikatmeldung", async () => {
    const err = Object.assign(new Error("duplicate"), { code: "23505" });
    createStatistikCodeMock.mockRejectedValueOnce(err);
    const result = await createStatistikCodeAction(
      fd({ code: "L", bezeichnung: "Beamter", gruppe: "beamter", sortierung: "0" }),
    );
    expect(result).toEqual({ error: 'Code "L" existiert bereits.' });
  });
});

describe("updateStatistikCodeAction", () => {
  it("blockt Nicht-Admins", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Nicht autorisiert."));
    await expect(
      updateStatistikCodeAction(fd({ code: "L", bezeichnung: "x", gruppe: "beamter", sortierung: "0" })),
    ).rejects.toThrow();
    expect(updateStatistikCodeMock).not.toHaveBeenCalled();
  });

  it("liefert Fehler wenn Code nicht existiert", async () => {
    dbSelectMock.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });
    const result = await updateStatistikCodeAction(
      fd({ code: "X", bezeichnung: "x", gruppe: "beamter", istTeilzeit: "false", sortierung: "0" }),
    );
    expect(result).toEqual({ error: "Code nicht gefunden." });
    expect(updateStatistikCodeMock).not.toHaveBeenCalled();
  });

  it("HappyPath: liest Vorher-Wert aus DB + auditiert mit altem Wert", async () => {
    const before = { bezeichnung: "Alt", gruppe: "beamter", istTeilzeit: false, sortierung: 0, bemerkung: null };
    dbSelectMock.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([before]) }) });
    updateStatistikCodeMock.mockResolvedValueOnce({ id: 42 });

    const result = await updateStatistikCodeAction(
      fd({ code: "L", bezeichnung: "Neu", gruppe: "beamter", istTeilzeit: "true", sortierung: "5" }),
    );

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "statistik_codes", 42, "UPDATE",
      before,
      expect.objectContaining({ code: "L", bezeichnung: "Neu", istTeilzeit: true }),
      "TestAdmin",
    );
  });
});

describe("toggleStatistikCodeAktivAction", () => {
  it("blockt Nicht-Admins", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("Nicht autorisiert."));
    await expect(toggleStatistikCodeAktivAction(fd({ code: "L", aktiv: "false" }))).rejects.toThrow();
    expect(updateStatistikCodeMock).not.toHaveBeenCalled();
  });

  it("liest tatsaechlichen Vorher-Wert aus DB (statt Request-Bool zu invertieren)", async () => {
    // DB sagt: aktuell aktiv=true. Request will deaktivieren.
    dbSelectMock.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ aktiv: true }]) }) });
    updateStatistikCodeMock.mockResolvedValueOnce({ id: 42 });

    const result = await toggleStatistikCodeAktivAction(fd({ code: "L", aktiv: "false" }));

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      "statistik_codes", 42, "UPDATE",
      { aktiv: true },
      { aktiv: false },
      "TestAdmin",
    );
  });

  it("uebersetzt PG-Errorcode 23503 (FK-Verletzung)", async () => {
    dbSelectMock.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ aktiv: true }]) }) });
    const err = Object.assign(new Error("fk"), { code: "23503" });
    updateStatistikCodeMock.mockRejectedValueOnce(err);
    const result = await toggleStatistikCodeAktivAction(fd({ code: "L", aktiv: "false" }));
    expect(result).toEqual({ error: expect.stringContaining("kann nicht geloescht werden") });
  });
});
