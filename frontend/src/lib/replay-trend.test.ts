import { describe, expect, it } from "vitest";
import { incidentWindow, replayTrend, utcDay } from "./replay-trend";
import type { HourlyMetric } from "./topics";

function metric(hour: string, volume: number): HourlyMetric {
  return {
    hour,
    volume,
    positive_count: 0,
    negative_count: 0,
    neutral_count: volume,
    unique_accounts: 0,
    anomalous_accounts: 0,
    source_count: 0,
  } as HourlyMetric;
}

describe("replayTrend", () => {
  const anchor = new Date("2026-10-28T08:00:00Z");

  it("sums volume across topics for the same hour", () => {
    const a = [metric("2026-10-28T08:00:00Z", 5), metric("2026-10-28T09:00:00Z", 2)];
    const b = [metric("2026-10-28T08:00:00Z", 3)];
    const series = replayTrend([a, b], anchor, new Date("2026-10-28T09:30:00Z"));

    expect(series).toEqual([
      { hour: "2026-10-28T08:00:00.000Z", volume: 8 },
      { hour: "2026-10-28T09:00:00.000Z", volume: 2 },
    ]);
  });

  it("fills hours without metric rows with zero", () => {
    const series = replayTrend([[metric("2026-10-28T08:00:00Z", 4)]], anchor, new Date("2026-10-28T10:00:00Z"));

    expect(series.map((p) => p.volume)).toEqual([4, 0, 0]);
  });

  it("stops at the current data hour, so later hours do not appear early", () => {
    const rows = [metric("2026-10-28T08:00:00Z", 1), metric("2026-10-28T11:00:00Z", 99)];
    const series = replayTrend([rows], anchor, new Date("2026-10-28T09:59:59Z"));

    expect(series.at(-1)?.hour).toBe("2026-10-28T09:00:00.000Z");
    expect(series.some((p) => p.volume === 99)).toBe(false);
  });

  it("returns an empty series before the anchor hour", () => {
    expect(replayTrend([], anchor, new Date("2026-10-28T07:00:00Z"))).toEqual([]);
  });
});

describe("incidentWindow", () => {
  it("starts at anchor plus incident offset and ends at the current data time", () => {
    expect(incidentWindow("2026-10-28T08:00:00Z", 3600, "2026-10-28T10:30:00Z")).toEqual({
      start: "2026-10-28T09:00:00.000Z",
      end: "2026-10-28T10:30:00.000Z",
    });
  });

  it("is null while the incident has not started or inputs are missing", () => {
    expect(incidentWindow("2026-10-28T08:00:00Z", 3600, "2026-10-28T08:30:00Z")).toBeNull();
    expect(incidentWindow(null, 3600, "2026-10-28T10:00:00Z")).toBeNull();
    expect(incidentWindow("2026-10-28T08:00:00Z", null, "2026-10-28T10:00:00Z")).toBeNull();
  });
});

describe("utcDay", () => {
  it("formats the UTC calendar day used by the metrics query", () => {
    expect(utcDay(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-28");
  });
});
