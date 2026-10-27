import { describe, expect, it } from "vitest";
import { clipWindow, hourLabel, normalizeSeries, peakPoint, placeMarkers, rangeMean, summarize, tickTimes, tooltipTime } from "./signal-chart";

const h = (hour: number, day = 27) => `2026-10-${day}T${String(hour).padStart(2, "0")}:00:00Z`;

describe("normalizeSeries", () => {
  it("sorts by time, drops invalid points, and keeps the last value of a repeated hour", () => {
    const points = normalizeSeries([
      { hour: h(5), volume: 7 },
      { hour: h(3), volume: 2 },
      { hour: "bukan tanggal", volume: 1 },
      { hour: h(4), volume: Number.NaN },
      { hour: h(6), volume: -1 },
      { hour: h(3), volume: 9 },
    ]);

    expect(points.map((p) => [p.hour, p.volume])).toEqual([
      ["2026-10-27T03:00:00.000Z", 9],
      ["2026-10-27T05:00:00.000Z", 7],
    ]);
  });

  it("is empty for an empty series", () => {
    expect(normalizeSeries([])).toEqual([]);
  });
});

describe("rangeMean and peak", () => {
  const points = normalizeSeries([
    { hour: h(1), volume: 10 },
    { hour: h(2), volume: 30 },
    { hour: h(3), volume: 20 },
  ]);

  it("averages only the points shown", () => {
    expect(rangeMean(points)).toBe(20);
    expect(rangeMean([])).toBeNull();
  });

  it("finds the earliest peak", () => {
    expect(peakPoint(points)?.volume).toBe(30);
    expect(peakPoint(normalizeSeries([{ hour: h(1), volume: 5 }, { hour: h(2), volume: 5 }]))?.hour).toBe("2026-10-27T01:00:00.000Z");
    expect(peakPoint([])).toBeNull();
    expect(summarize(points)).toMatchObject({ count: 3, mean: 20 });
  });
});

describe("placeMarkers", () => {
  const points = normalizeSeries([
    { hour: h(1), volume: 4 },
    { hour: h(2), volume: 40 },
    { hour: h(3), volume: 6 },
  ]);

  it("snaps a pin to the point of its hour and takes that point's volume", () => {
    const { placed, dropped } = placeMarkers(points, [{ at: "2026-10-27T02:20:00Z", severity: "high", label: "Alert 1" }]);
    expect(dropped).toBe(0);
    expect(placed[0]).toMatchObject({ volume: 40, severity: "high", label: "Alert 1", t: points[1].t });
  });

  it("drops and counts markers outside the shown range or with a bad time", () => {
    const { placed, dropped } = placeMarkers(points, [
      { at: "2026-10-27T09:00:00Z", severity: "low", label: "jauh" },
      { at: "x", severity: "medium", label: "rusak" },
      { at: "2026-10-27T03:00:00Z", severity: "medium", label: "ada" },
    ]);
    expect(placed.map((m) => m.label)).toEqual(["ada"]);
    expect(dropped).toBe(2);
  });

  it("drops everything on an empty series", () => {
    expect(placeMarkers([], [{ at: h(1), severity: "low", label: "a" }])).toEqual({ placed: [], dropped: 1 });
  });
});

describe("clipWindow", () => {
  const points = normalizeSeries([1, 2, 3, 4, 5].map((hour) => ({ hour: h(hour), volume: 1 })));

  it("clips to the shown range", () => {
    expect(clipWindow(points, { start: h(0), end: h(3) })).toEqual({ from: points[0].t, to: points[2].t });
    expect(clipWindow(points, { start: h(4), end: h(9) })).toEqual({ from: points[3].t, to: points[4].t });
  });

  it("is null when missing, reversed, invalid, or outside", () => {
    expect(clipWindow(points, undefined)).toBeNull();
    expect(clipWindow(points, { start: h(4), end: h(2) })).toBeNull();
    expect(clipWindow(points, { start: "x", end: h(2) })).toBeNull();
    expect(clipWindow(points, { start: h(8), end: h(9) })).toBeNull();
    expect(clipWindow([], { start: h(1), end: h(2) })).toBeNull();
  });
});

describe("ticks and labels", () => {
  const points = normalizeSeries(Array.from({ length: 48 }, (_, i) => ({ hour: new Date(Date.UTC(2026, 9, 26, i)).toISOString(), volume: i })));

  it("never returns more ticks than asked for and always starts at the first point", () => {
    const ticks = tickTimes(points, 8);
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks[0]).toBe(points[0].t);
    expect(tickTimes(points, 100)).toHaveLength(48);
    expect(tickTimes([], 5)).toEqual([]);
  });

  it("labels hours in WIB and adds the date at the start and on day change", () => {
    const first = Date.UTC(2026, 9, 27, 7);
    expect(hourLabel(first, null)).toBe("27 Okt 14.00");
    expect(hourLabel(Date.UTC(2026, 9, 27, 8), first)).toBe("15.00");
    expect(hourLabel(Date.UTC(2026, 9, 27, 17), Date.UTC(2026, 9, 27, 16))).toBe("28 Okt 00.00");
  });

  it("writes the tooltip heading in WIB with UTC", () => {
    expect(tooltipTime(Date.UTC(2026, 9, 27, 7))).toBe("14.00 WIB (07.00 UTC)");
  });
});
