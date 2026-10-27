import { describe, expect, it } from "vitest";
import { formatInteger, formatNumber, formatPercent, formatScore } from "./number";

describe("number formats", () => {
  it("uses thousand dots and decimal commas", () => {
    expect(formatInteger(12345)).toBe("12.345");
    expect(formatNumber(0.912, 3, 3)).toBe("0,912");
    expect(formatNumber(5.1)).toBe("5,1");
  });

  it("shows similarity as a whole percent by default", () => {
    expect(formatPercent(0.912)).toBe("91%");
    expect(formatPercent(0.8333, 1)).toBe("83,3%");
    expect(formatPercent(0)).toBe("0%");
  });

  it("rounds and clamps scores to 0-100", () => {
    expect(formatScore(62.6)).toBe("63");
    expect(formatScore(140)).toBe("100");
    expect(formatScore(-3)).toBe("0");
  });

  it("gives a dash for missing or non-finite values", () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatInteger(bad)).toBe("—");
      expect(formatNumber(bad)).toBe("—");
      expect(formatPercent(bad)).toBe("—");
      expect(formatScore(bad)).toBe("—");
    }
  });
});
