import { describe, it, expect } from "vitest";
import {
  statistikCodeCreateSchema,
  statistikCodeUpdateSchema,
} from "@/lib/validation";

describe("statistikCodeCreateSchema", () => {
  const validInput = {
    code: "L",
    bezeichnung: "Beamter Lebenszeit",
    gruppe: "beamter" as const,
    istTeilzeit: false,
    sortierung: 0,
  };

  it("akzeptiert minimal gueltige Eingabe", () => {
    const result = statistikCodeCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("akzeptiert alle 4 Beamten-Codes (L, LT, P, PT)", () => {
    for (const code of ["L", "LT", "P", "PT"]) {
      const r = statistikCodeCreateSchema.safeParse({ ...validInput, code });
      expect(r.success).toBe(true);
    }
  });

  it("akzeptiert max-Laenge 5 Zeichen", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, code: "ABCDE" });
    expect(r.success).toBe(true);
  });

  it("verwirft Code mit Kleinbuchstaben", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, code: "l" });
    expect(r.success).toBe(false);
  });

  it("verwirft Code mit fuehrendem Whitespace", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, code: " L" });
    expect(r.success).toBe(false);
  });

  it("verwirft leeren Code", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, code: "" });
    expect(r.success).toBe(false);
  });

  it("verwirft Code laenger als 5 Zeichen", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, code: "ABCDEF" });
    expect(r.success).toBe(false);
  });

  it("verwirft Code mit Ziffern oder Sonderzeichen", () => {
    for (const code of ["L1", "L-T", "L T"]) {
      const r = statistikCodeCreateSchema.safeParse({ ...validInput, code });
      expect(r.success).toBe(false);
    }
  });

  it("verwirft leere Bezeichnung", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, bezeichnung: "" });
    expect(r.success).toBe(false);
  });

  it("verwirft Bezeichnung > 150 Zeichen", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, bezeichnung: "x".repeat(151) });
    expect(r.success).toBe(false);
  });

  it("verwirft ungueltige Gruppe", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, gruppe: "honorarkraft" });
    expect(r.success).toBe(false);
  });

  it("verwirft NaN-Sortierung mit deutscher Meldung", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, sortierung: NaN });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/Sortierung/);
    }
  });

  it("verwirft negative Sortierung", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, sortierung: -1 });
    expect(r.success).toBe(false);
  });

  it("verwirft nicht-ganze Sortierung", () => {
    const r = statistikCodeCreateSchema.safeParse({ ...validInput, sortierung: 1.5 });
    expect(r.success).toBe(false);
  });
});

describe("statistikCodeUpdateSchema", () => {
  const validInput = {
    bezeichnung: "Beamter Lebenszeit",
    gruppe: "beamter" as const,
    istTeilzeit: true,
    sortierung: 5,
  };

  it("akzeptiert minimal gueltige Update-Eingabe", () => {
    expect(statistikCodeUpdateSchema.safeParse(validInput).success).toBe(true);
  });

  it("verlangt explizite Sortierung (kein Default)", () => {
    const { sortierung: _s, ...without } = validInput;
    void _s;
    expect(statistikCodeUpdateSchema.safeParse(without).success).toBe(false);
  });

  it("verlangt explizites istTeilzeit-Flag", () => {
    const { istTeilzeit: _t, ...without } = validInput;
    void _t;
    expect(statistikCodeUpdateSchema.safeParse(without).success).toBe(false);
  });
});
