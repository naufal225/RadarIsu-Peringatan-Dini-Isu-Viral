import { describe, expect, it } from "vitest";
import { minuteTrend } from "./replay-trend";

describe("minuteTrend", () => {
  it("fills minutes without posts with zero between the first post and the data clock", () => {
    const series = minuteTrend(
      [
        { t: "2026-11-10T09:00:00.000Z", count: 2 },
        { t: "2026-11-10T09:02:00.000Z", count: 1 },
      ],
      new Date("2026-11-10T09:03:30Z"),
    );

    expect(series.map((p) => p.count)).toEqual([2, 0, 1, 0]);
    expect(series[0].t).toBe("2026-11-10T09:00:00.000Z");
    expect(series.at(-1)?.t).toBe("2026-11-10T09:03:00.000Z");
  });

  it("does not show posts later than the data clock", () => {
    const series = minuteTrend(
      [
        { t: "2026-11-10T09:00:20Z", count: 3 },
        { t: "2026-11-10T09:05:00Z", count: 9 },
      ],
      new Date("2026-11-10T09:01:10Z"),
    );

    expect(series).toEqual([
      { t: "2026-11-10T09:00:00.000Z", count: 3 },
      { t: "2026-11-10T09:01:00.000Z", count: 0 },
    ]);
  });

  it("merges several rows in the same minute", () => {
    const series = minuteTrend(
      [
        { t: "2026-11-10T09:00:05Z", count: 1 },
        { t: "2026-11-10T09:00:40Z", count: 4 },
      ],
      new Date("2026-11-10T09:00:59Z"),
    );

    expect(series).toEqual([{ t: "2026-11-10T09:00:00.000Z", count: 5 }]);
  });

  it("is empty while nothing has arrived yet", () => {
    expect(minuteTrend([], new Date("2026-11-10T09:00:00Z"))).toEqual([]);
    expect(minuteTrend([{ t: "2026-11-10T10:00:00Z", count: 1 }], new Date("2026-11-10T09:00:00Z"))).toEqual([]);
  });
});
