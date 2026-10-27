import { describe, expect, it } from "vitest";
import { formatUtc, formatWib, parseTime, toIso } from "./time";

describe("formatWib", () => {
  it("renders Jakarta time with a manual WIB suffix", () => {
    expect(formatWib("2026-10-27T07:29:00Z")).toBe("27 Okt 2026 · 14.29 WIB");
    expect(formatWib("2026-10-27T07:29:00Z", "time")).toBe("14.29 WIB");
    expect(formatWib("2026-10-27T07:29:00Z", "date")).toBe("27 Okt 2026");
  });

  it("rolls over to the next day after 17:00 UTC", () => {
    expect(formatWib("2026-10-27T17:30:00Z")).toBe("28 Okt 2026 · 00.30 WIB");
  });

  it("uses a 24-hour clock without 24.xx at midnight", () => {
    expect(formatWib("2026-10-26T17:00:00Z", "time")).toBe("00.00 WIB");
  });

  it("accepts a Date and an offset timestamp", () => {
    expect(formatWib(new Date("2026-10-27T07:29:00Z"))).toBe("27 Okt 2026 · 14.29 WIB");
    expect(formatWib("2026-10-27T14:29:00+07:00")).toBe("27 Okt 2026 · 14.29 WIB");
  });

  it("gives a dash for empty or invalid values", () => {
    for (const bad of [null, undefined, "", "bukan tanggal"]) expect(formatWib(bad)).toBe("—");
  });
});

describe("formatUtc", () => {
  it("renders the same instant in UTC", () => {
    expect(formatUtc("2026-10-27T07:29:00Z", "time")).toBe("07.29 UTC");
    expect(formatUtc("2026-10-27T07:29:00Z")).toBe("27 Okt 2026 · 07.29 UTC");
    expect(formatUtc(null)).toBe("—");
  });
});

describe("parseTime and toIso", () => {
  it("returns null for anything that is not a date", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("x")).toBeNull();
    expect(parseTime("2026-10-27T07:29:00Z")?.toISOString()).toBe("2026-10-27T07:29:00.000Z");
  });

  it("normalises to a UTC ISO string", () => {
    expect(toIso("2026-10-27T14:29:00+07:00")).toBe("2026-10-27T07:29:00.000Z");
    expect(toIso("x")).toBe("");
  });
});
