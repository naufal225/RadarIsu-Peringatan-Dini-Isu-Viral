import { describe, expect, it } from "vitest";
import { evidenceComposition, f1Trend, sentimentMix } from "./insight";

describe("evidenceComposition", () => {
  it("counts reasons and distinct accounts per category", () => {
    const composition = evidenceComposition([
      { reason: "similar_text", account: { id: 1 } },
      { reason: "similar_text", account: { id: 2 } },
      { reason: "young_account", account: { id: 1 } },
      { reason: "synchronized_posting", account: { id: 1 } },
      { reason: "synchronized_posting", account: { id: 3 } },
      { reason: "spike_sample", account: null },
    ]);

    expect(composition.total).toBe(6);
    expect(composition.byReason).toEqual({ similar_text: 2, young_account: 1, synchronized_posting: 2, spike_sample: 1 });
    expect(composition.accounts).toBe(3);
    expect(composition.youngAccounts).toBe(1);
    expect(composition.synchronizedAccounts).toBe(2);
  });

  it("is empty for an alert without evidence", () => {
    expect(evidenceComposition([])).toEqual({ total: 0, byReason: {}, accounts: 0, youngAccounts: 0, synchronizedAccounts: 0 });
  });
});

describe("sentimentMix", () => {
  it("sums counts across hours and computes shares", () => {
    const mix = sentimentMix([
      { positive_count: 2, negative_count: 1, neutral_count: 1 },
      { positive_count: 0, negative_count: 0, neutral_count: 4 },
    ]);

    expect(mix.total).toBe(8);
    expect(mix.share.positive).toBeCloseTo(0.25);
    expect(mix.share.negative).toBeCloseTo(0.125);
    expect(mix.onlyNeutral).toBe(false);
  });

  it("flags data where every post is neutral", () => {
    const mix = sentimentMix([{ positive_count: 0, negative_count: 0, neutral_count: 50 }]);
    expect(mix.onlyNeutral).toBe(true);
  });

  it("reports zero shares when there are no posts", () => {
    const mix = sentimentMix([]);
    expect(mix.total).toBe(0);
    expect(mix.share).toEqual({ positive: 0, negative: 0, neutral: 0 });
    expect(mix.onlyNeutral).toBe(false);
  });
});

describe("f1Trend", () => {
  it("returns runs oldest first", () => {
    const trend = f1Trend([
      { id: 2, created_at: "2026-11-02T10:00:00Z", f1: 0.9 },
      { id: 1, created_at: "2026-11-01T10:00:00Z", f1: null },
    ]);
    expect(trend.map((p) => p.id)).toEqual([1, 2]);
    expect(trend[0].f1).toBeNull();
  });
});
