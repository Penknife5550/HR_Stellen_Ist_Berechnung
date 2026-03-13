import { describe, it, expect } from "vitest";
import {
  getStichtagFuerMonat,
  getStichtageFuerHaushaltsjahr,
  getZeitraumFuerMonat,
  getMonateImZeitraum,
} from "@/lib/berechnungen/schuelerzahlen";

describe("getStichtagFuerMonat", () => {
  it("Jan-Jul 2026 → Stichtag 15.10.2025 (Vorjahr)", () => {
    for (const monat of [1, 2, 3, 4, 5, 6, 7]) {
      const stichtag = getStichtagFuerMonat(2026, monat, false);
      expect(stichtag.getFullYear()).toBe(2025);
      expect(stichtag.getMonth()).toBe(9); // Oktober = 9
      expect(stichtag.getDate()).toBe(15);
    }
  });

  it("Aug-Dez 2026 → Stichtag 15.10.2026 (laufendes Jahr)", () => {
    for (const monat of [8, 9, 10, 11, 12]) {
      const stichtag = getStichtagFuerMonat(2026, monat, false);
      expect(stichtag.getFullYear()).toBe(2026);
      expect(stichtag.getMonth()).toBe(9);
      expect(stichtag.getDate()).toBe(15);
    }
  });

  it("Aufbauschule: immer laufendes Jahr", () => {
    // Auch fuer Januar → laufendes Jahr
    const stichtag = getStichtagFuerMonat(2026, 1, true);
    expect(stichtag.getFullYear()).toBe(2026);
  });
});

describe("getStichtageFuerHaushaltsjahr", () => {
  it("gibt beide Stichtage fuer 2026 zurueck", () => {
    const stichtage = getStichtageFuerHaushaltsjahr(2026, false);
    expect(stichtage.janJul.getFullYear()).toBe(2025);
    expect(stichtage.augDez.getFullYear()).toBe(2026);
  });

  it("Aufbauschule: beide Stichtage = laufendes Jahr", () => {
    const stichtage = getStichtageFuerHaushaltsjahr(2026, true);
    expect(stichtage.janJul.getFullYear()).toBe(2026);
    expect(stichtage.augDez.getFullYear()).toBe(2026);
  });
});

describe("getZeitraumFuerMonat", () => {
  it("Monate 1-7 = jan-jul", () => {
    for (const m of [1, 2, 3, 4, 5, 6, 7]) {
      expect(getZeitraumFuerMonat(m)).toBe("jan-jul");
    }
  });

  it("Monate 8-12 = aug-dez", () => {
    for (const m of [8, 9, 10, 11, 12]) {
      expect(getZeitraumFuerMonat(m)).toBe("aug-dez");
    }
  });
});

describe("getMonateImZeitraum", () => {
  it("jan-jul = 7 Monate", () => {
    expect(getMonateImZeitraum("jan-jul")).toBe(7);
  });

  it("aug-dez = 5 Monate", () => {
    expect(getMonateImZeitraum("aug-dez")).toBe(5);
  });
});
