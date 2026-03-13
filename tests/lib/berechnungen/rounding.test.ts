import { describe, it, expect } from "vitest";
import { truncateToDecimals, roundToDecimals, roundToTen } from "@/lib/berechnungen/rounding";

describe("truncateToDecimals", () => {
  it("schneidet 28.448738 auf 28.44 ab (NICHT 28.45)", () => {
    expect(truncateToDecimals(28.448738, 2)).toBe(28.44);
  });

  it("schneidet 30.542136 auf 30.54 ab", () => {
    expect(truncateToDecimals(30.542136, 2)).toBe(30.54);
  });

  it("schneidet 15.748031 auf 15.74 ab", () => {
    expect(truncateToDecimals(15.748031, 2)).toBe(15.74);
  });

  it("schneidet 30.196176 auf 30.19 ab", () => {
    expect(truncateToDecimals(30.196176, 2)).toBe(30.19);
  });

  it("laesst exakte Werte unveraendert: 30.19 bleibt 30.19", () => {
    expect(truncateToDecimals(30.19, 2)).toBe(30.19);
  });

  it("laesst Ganzzahlen unveraendert", () => {
    expect(truncateToDecimals(42, 2)).toBe(42);
  });

  it("schneidet auf 0 Dezimalstellen ab", () => {
    expect(truncateToDecimals(28.999, 0)).toBe(28);
  });

  it("funktioniert mit negativen Zahlen", () => {
    expect(truncateToDecimals(-28.448738, 2)).toBe(-28.44);
  });

  it("schneidet auf 1 Dezimalstelle ab", () => {
    expect(truncateToDecimals(45.93, 1)).toBe(45.9);
  });

  it("schneidet auf 3 Dezimalstellen ab", () => {
    expect(truncateToDecimals(25.12345, 3)).toBe(25.123);
  });
});

describe("roundToDecimals", () => {
  it("rundet 45.93 auf 45.9 (1 Dezimalstelle)", () => {
    expect(roundToDecimals(45.93, 1)).toBe(45.9);
  });

  it("rundet 45.95 auf 46.0 (1 Dezimalstelle)", () => {
    expect(roundToDecimals(45.95, 1)).toBe(46.0);
  });

  it("rundet 28.44 auf 28.4 (1 Dezimalstelle)", () => {
    expect(roundToDecimals(28.44, 1)).toBe(28.4);
  });

  it("rundet 30.54 auf 30.5 (1 Dezimalstelle)", () => {
    expect(roundToDecimals(30.54, 1)).toBe(30.5);
  });

  it("rundet 28.45 auf 28.5 (1 Dezimalstelle)", () => {
    expect(roundToDecimals(28.45, 1)).toBe(28.5);
  });

  it("rundet auf 2 Dezimalstellen", () => {
    expect(roundToDecimals(1.235, 2)).toBe(1.24);
  });
});

describe("roundToTen", () => {
  it("rundet 1234 auf 1230", () => {
    expect(roundToTen(1234)).toBe(1230);
  });

  it("rundet 1235 auf 1240", () => {
    expect(roundToTen(1235)).toBe(1240);
  });

  it("rundet 1230 auf 1230 (bereits glatt)", () => {
    expect(roundToTen(1230)).toBe(1230);
  });
});
