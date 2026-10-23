import { describe, expect, it } from "vitest";
import { errorCodes, fillHours, hasPlaceholder, parseKeywords, summarize, type HourlyMetric } from "./topics";

const metric = (hour: string, volume: number): HourlyMetric => ({
  hour,
  volume,
  positive_count: 0,
  negative_count: 0,
  neutral_count: volume,
  unique_accounts: 1,
  anomalous_accounts: 0,
  source_count: 1,
});

describe("parseKeywords", () => {
  it("splits on lines and commas, trims, and drops blanks", () => {
    expect(parseKeywords("hoaks,  disinformasi \n\n bansos ,")).toEqual(["hoaks", "disinformasi", "bansos"]);
  });

  it("removes repeats regardless of case and keeps the first spelling", () => {
    expect(parseKeywords("Hoaks\nhoaks, HOAKS\nBansos")).toEqual(["Hoaks", "Bansos"]);
  });

  it("keeps multi-word phrases together", () => {
    expect(parseKeywords("bantuan sosial\ntni ad")).toEqual(["bantuan sosial", "tni ad"]);
  });

  it("returns nothing for empty input", () => {
    expect(parseKeywords("")).toEqual([]);
    expect(parseKeywords(" ,\n, ")).toEqual([]);
  });
});

describe("hasPlaceholder (PRD §9.8)", () => {
  it("detects template brackets", () => {
    expect(hasPlaceholder("[nama satuan]")).toBe(true);
    expect(hasPlaceholder("bantuan [wilayah]")).toBe(true);
    expect(hasPlaceholder("bansos]")).toBe(true);
    expect(hasPlaceholder("bansos")).toBe(false);
  });
});

describe("fillHours", () => {
  it("adds zero rows for hours without data and keeps the given rows", () => {
    const rows = [metric("2026-10-20T08:00:00Z", 5), metric("2026-10-20T11:00:00Z", 2)];

    const filled = fillHours(rows, "2026-10-20T07:00:00Z", "2026-10-20T12:00:00Z");

    expect(filled.map((row) => row.hour)).toEqual([
      "2026-10-20T07:00:00Z",
      "2026-10-20T08:00:00Z",
      "2026-10-20T09:00:00Z",
      "2026-10-20T10:00:00Z",
      "2026-10-20T11:00:00Z",
    ]);
    expect(filled.map((row) => row.volume)).toEqual([0, 5, 0, 0, 2]);
  });

  it("treats the end as exclusive and returns nothing for an empty range", () => {
    expect(fillHours([], "2026-10-20T00:00:00Z", "2026-10-21T00:00:00Z")).toHaveLength(24);
    expect(fillHours([], "2026-10-20T00:00:00Z", "2026-10-20T00:00:00Z")).toEqual([]);
  });

  it("covers the default seven days with 168 hours", () => {
    expect(fillHours([], "2026-10-14T00:00:00Z", "2026-10-21T00:00:00Z")).toHaveLength(168);
  });

  it("ignores rows outside the range", () => {
    const filled = fillHours([metric("2026-10-19T23:00:00Z", 9)], "2026-10-20T00:00:00Z", "2026-10-20T02:00:00Z");

    expect(filled.map((row) => row.volume)).toEqual([0, 0]);
  });
});

describe("summarize", () => {
  it("totals the volume and finds the peak hour", () => {
    const rows = [metric("2026-10-20T08:00:00Z", 5), metric("2026-10-20T09:00:00Z", 0), metric("2026-10-20T10:00:00Z", 9)];

    const summary = summarize(rows);

    expect(summary.totalVolume).toBe(14);
    expect(summary.hoursWithData).toBe(2);
    expect(summary.peak?.hour).toBe("2026-10-20T10:00:00Z");
  });

  it("has no peak without any posts", () => {
    expect(summarize([metric("2026-10-20T08:00:00Z", 0)])).toEqual({ totalVolume: 0, hoursWithData: 0, peak: null });
    expect(summarize([])).toEqual({ totalVolume: 0, hoursWithData: 0, peak: null });
  });
});

describe("errorCodes", () => {
  it("lists the distinct messages of a 422 body", () => {
    expect(
      errorCodes({ errors: { "keywords.0": ["keyword_has_placeholder"], "keywords.1": ["keyword_has_placeholder"], topic: ["template_readonly"] } }),
    ).toEqual(["keyword_has_placeholder", "template_readonly"]);
    expect(errorCodes(null)).toEqual([]);
  });
});
