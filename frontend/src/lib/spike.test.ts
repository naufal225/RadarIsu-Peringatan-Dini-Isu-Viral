import { describe, expect, it } from "vitest";
import { chartPoints, isEmptySeries, SPIKE_HOUR_OPTIONS, SPIKE_STATUSES, spikeTone, type SpikePoint } from "./spike";

const point = (hour: string, volume: number, running = false): SpikePoint => ({ hour, volume, is_running_hour: running });

describe("spikeTone", () => {
  it("is loud only for a fired spike", () => {
    expect(spikeTone("triggered")).toBe("error");
    expect(spikeTone("below_threshold")).toBe("ok");
  });

  it("separates a topic that is too small from one still learning its baseline", () => {
    expect(spikeTone("below_min_volume")).toBe("warn");
    expect(spikeTone("insufficient_baseline")).toBe("muted");
  });

  it("has a tone for every status the API can return", () => {
    for (const status of SPIKE_STATUSES) expect(["error", "ok", "muted", "warn"]).toContain(spikeTone(status));
  });
});

describe("chartPoints", () => {
  it("flags the running hour as incomplete and keeps the order", () => {
    const rows = chartPoints([point("2026-10-26T10:00:00Z", 4), point("2026-10-26T11:00:00Z", 6), point("2026-10-26T12:00:00Z", 1, true)]);

    expect(rows.map((row) => row.is_complete)).toEqual([true, true, false]);
    expect(rows.map((row) => row.volume)).toEqual([4, 6, 1]);
  });

  it("returns an empty list for an empty series", () => {
    expect(chartPoints([])).toEqual([]);
  });
});

describe("isEmptySeries", () => {
  it("is true when every hour is zero, and for no hours at all", () => {
    expect(isEmptySeries([point("a", 0), point("b", 0, true)])).toBe(true);
    expect(isEmptySeries([])).toBe(true);
  });

  it("is false as soon as one hour has posts", () => {
    expect(isEmptySeries([point("a", 0), point("b", 1, true)])).toBe(false);
  });
});

describe("hour options", () => {
  it("stay inside the 6-168 range the API accepts", () => {
    for (const hours of SPIKE_HOUR_OPTIONS) {
      expect(hours).toBeGreaterThanOrEqual(6);
      expect(hours).toBeLessThanOrEqual(168);
    }
  });
});
