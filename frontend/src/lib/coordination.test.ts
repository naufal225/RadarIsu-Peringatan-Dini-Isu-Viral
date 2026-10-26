import { describe, expect, it } from "vitest";
import { countFlags, summarizeEvidence, type CoordinationAccount } from "./coordination";
import { ui } from "./labels";

const account = (overrides: Partial<CoordinationAccount>): CoordinationAccount => ({
  id: 1,
  handle: "@a",
  similarity: 0.9,
  young: false,
  age_days: null,
  synchronized: false,
  posts_count: 1,
  ...overrides,
});

describe("summarizeEvidence", () => {
  it("reads a similar_text row from the numbers the detector stored", () => {
    const text = summarizeEvidence("similar_text", { similarity: 0.912, cluster_id: 2, cluster_accounts: 40, cluster_posts: 41 });

    expect(text).toBe("Kemiripan 0,91 dengan teks klaster 2 (40 akun, 41 posting).");
  });

  it("says when the window was truncated", () => {
    const text = summarizeEvidence("similar_text", { similarity: 0.9, cluster_id: 1, cluster_accounts: 5, cluster_posts: 5, truncated: true });

    expect(text).toContain(ui.coordination.evidence.truncated);
  });

  it("does not mention truncation when it did not happen", () => {
    const text = summarizeEvidence("similar_text", { similarity: 0.9, cluster_id: 1, cluster_accounts: 5, cluster_posts: 5, truncated: false });

    expect(text).not.toContain(ui.coordination.evidence.truncated);
  });

  it("reads a young_account row", () => {
    expect(summarizeEvidence("young_account", { account_age_days: 4, young_account_days: 30 })).toBe(
      "Akun berumur 4 hari saat memposting (batas akun baru 30 hari).",
    );
  });

  it("reads a synchronized_posting row", () => {
    const text = summarizeEvidence("synchronized_posting", {
      cluster_posts: 40,
      synchronized: { is_synchronized: true, ratio: 0.85, posts_in_window: 34, window_minutes: 5 },
    });

    expect(text).toBe("34 dari 40 posting klaster berada dalam 5 menit (porsi 0,85).");
  });

  it("reads a spike_sample row", () => {
    const text = summarizeEvidence("spike_sample", { current_rate: 64, baseline_mean: 5, z: 59, thresholds: { z_effective: 3 } });

    expect(text).toBe("Volume 64 posting per jam, rata-rata baseline 5; z 59 (ambang 3).");
  });

  it("returns null when the detail lacks the numbers, so only the raw data is shown", () => {
    expect(summarizeEvidence("similar_text", {})).toBeNull();
    expect(summarizeEvidence("similar_text", { similarity: "0.9", cluster_id: 1 })).toBeNull();
    expect(summarizeEvidence("young_account", { account_age_days: null, young_account_days: 30 })).toBeNull();
    expect(summarizeEvidence("synchronized_posting", { cluster_posts: 5, synchronized: null })).toBeNull();
    expect(summarizeEvidence("spike_sample", { z: Number.NaN })).toBeNull();
  });

  it("returns null for reasons without a summary and for empty or missing detail", () => {
    expect(summarizeEvidence("name_similarity", { similarity: 0.7 })).toBeNull();
    expect(summarizeEvidence("something_new", { a: 1 })).toBeNull();
    expect(summarizeEvidence("similar_text", null)).toBeNull();
    expect(summarizeEvidence("similar_text", undefined)).toBeNull();
  });
});

describe("countFlags", () => {
  it("counts young and synchronized accounts separately", () => {
    const flags = countFlags([account({ young: true }), account({ young: true, synchronized: true }), account({ synchronized: true }), account({})]);

    expect(flags).toEqual({ young: 2, synchronized: 2 });
  });

  it("is zero for no accounts", () => {
    expect(countFlags([])).toEqual({ young: 0, synchronized: 0 });
  });
});

describe("coordination labels", () => {
  it("has no empty text", () => {
    const strings = [
      ...Object.values(ui.coordination.panel.columns),
      ui.coordination.panel.title,
      ui.coordination.panel.intro,
      ui.coordination.panel.empty,
      ui.coordination.panel.young,
      ui.coordination.evidence.raw,
    ];

    for (const text of strings) expect(text.trim()).not.toBe("");
  });
});
