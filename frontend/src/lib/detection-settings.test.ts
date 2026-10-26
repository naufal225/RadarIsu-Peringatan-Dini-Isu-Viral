import { describe, expect, it } from "vitest";
import {
  effectiveZ,
  FIELD_RANGES,
  getPath,
  previewImpersonation,
  previewScore,
  setPath,
  validateDetection,
  weightsTotal,
  type DetectionSettings,
} from "./detection-settings";

// PRD §9.6 seed.
const defaults: DetectionSettings = {
  coordination_window_minutes: 15,
  z_threshold: 3,
  min_volume: 20,
  baseline_hours: 168,
  min_baseline_hours: 24,
  similarity_threshold: 0.8,
  min_accounts_cluster: 5,
  young_account_days: 30,
  impersonation_threshold: 0.6,
  spike_current_window_minutes: 60,
  spike_sample_limit: 10,
  synchronized_window_minutes: 5,
  synchronized_ratio: 0.8,
  impersonation_window_hours: 24,
  cooldown_minutes: 60,
  coordination_max_posts: 2000,
  weights: { spike: 40, anomaly: 30, sentiment: 20, reach: 10 },
  severity_cutoffs: { medium: 40, high: 70 },
  sensitivity_z_offset: { low: 1, medium: 0, high: -0.5 },
};

describe("previewImpersonation (PRD §10.7)", () => {
  it("scores round(similarity × 70) plus 30 for a young account", () => {
    const young = previewImpersonation(defaults, 0.9, true);

    expect(young.score).toBe(93);
    expect(young.severity).toBe("high");
    expect(previewImpersonation(defaults, 0.9, false).score).toBe(63);
  });

  it("uses the severity cutoffs of issue alerts", () => {
    expect(previewImpersonation(defaults, 0.6, false).severity).toBe("medium"); // 42
    expect(previewImpersonation(defaults, 0.4, false).severity).toBe("low"); // 28
    expect(previewImpersonation({ ...defaults, severity_cutoffs: { medium: 20, high: 30 } }, 0.4, false).severity).toBe("medium");
  });

  it("clamps similarity to 0..1", () => {
    expect(previewImpersonation(defaults, 3, false).score).toBe(70);
    expect(previewImpersonation(defaults, -1, false).score).toBe(0);
  });
});

describe("new detector keys", () => {
  it("accept the PRD constants and reject values out of range", () => {
    expect(validateDetection(defaults)).toEqual([]);
    expect(validateDetection({ ...defaults, cooldown_minutes: -1 })).toEqual(["cooldown_minutes"]);
    expect(validateDetection({ ...defaults, cooldown_minutes: 0 })).toEqual([]);
    expect(validateDetection({ ...defaults, synchronized_ratio: 0.4 })).toEqual(["synchronized_ratio"]);
    expect(validateDetection({ ...defaults, coordination_max_posts: 99 })).toEqual(["coordination_max_posts"]);
    expect(validateDetection({ ...defaults, spike_sample_limit: 1.5 })).toEqual(["spike_sample_limit"]);
  });
});

describe("previewScore (PRD §10.8)", () => {
  it("reproduces the CONTRACTS.md §3.3 example", () => {
    const preview = previewScore(defaults, { z: 5.1, anomalousRatio: 0.4, negativeRatio: 0.62, reachRatio: 0.67 });

    expect(preview.components.spike.value).toBeCloseTo(34, 5);
    expect(preview.components.anomaly.value).toBeCloseTo(12, 5);
    expect(preview.components.sentiment.value).toBeCloseTo(12.4, 5);
    expect(preview.components.reach.value).toBeCloseTo(6.7, 5);
    expect(preview.score).toBe(65);
    expect(preview.severity).toBe("medium");
  });

  it("caps each component at its weight and the score at 100", () => {
    const preview = previewScore(defaults, { z: 60, anomalousRatio: 5, negativeRatio: 2, reachRatio: 9 });

    expect(preview.score).toBe(100);
    expect(preview.severity).toBe("high");
  });

  it("is zero for no signal, with severity low", () => {
    const preview = previewScore(defaults, { z: 0, anomalousRatio: 0, negativeRatio: 0, reachRatio: 0 });

    expect(preview).toMatchObject({ score: 0, severity: "low" });
  });

  it("applies the cutoffs being edited", () => {
    const input = { z: 6, anomalousRatio: 0, negativeRatio: 0, reachRatio: 0 }; // 40 points
    const stricter = { ...defaults, severity_cutoffs: { medium: 50, high: 80 } };

    expect(previewScore(defaults, input).severity).toBe("medium");
    expect(previewScore(stricter, input).severity).toBe("low");
  });
});

describe("effectiveZ (PRD §10.5)", () => {
  it("adds the sensitivity offset to the threshold", () => {
    expect(effectiveZ(defaults, "low")).toBe(4);
    expect(effectiveZ(defaults, "medium")).toBe(3);
    expect(effectiveZ(defaults, "high")).toBe(2.5);
  });

  it("never goes below 2.0", () => {
    expect(effectiveZ({ ...defaults, z_threshold: 2, sensitivity_z_offset: { low: 0, medium: -1, high: -3 } }, "high")).toBe(2);
  });
});

describe("validateDetection", () => {
  it("accepts the seeded defaults", () => {
    expect(validateDetection(defaults)).toEqual([]);
  });

  it("rejects weights that do not add up to 100", () => {
    const edited = setPath(defaults, "weights.reach", 20);

    expect(weightsTotal(edited)).toBe(110);
    expect(validateDetection(edited)).toEqual(["weights"]);
  });

  it("rejects a medium cutoff that is not below high", () => {
    expect(validateDetection(setPath(defaults, "severity_cutoffs.medium", 70))).toEqual(["severity_cutoffs.medium"]);
  });

  it("rejects a minimum baseline above the baseline window", () => {
    const edited = setPath(setPath(defaults, "baseline_hours", 24), "min_baseline_hours", 48);

    expect(validateDetection(edited)).toEqual(["min_baseline_hours"]);
  });

  it("rejects offsets that are not ordered low >= medium >= high", () => {
    expect(validateDetection(setPath(defaults, "sensitivity_z_offset.medium", 2))).toEqual(["sensitivity_z_offset"]);
  });

  it("rejects out-of-range, fractional-integer and empty values by field", () => {
    expect(validateDetection(setPath(defaults, "z_threshold", 1.5))).toEqual(["z_threshold"]);
    expect(validateDetection(setPath(defaults, "young_account_days", 30.5))).toEqual(["young_account_days"]);
    expect(validateDetection(setPath(defaults, "min_volume", Number.NaN))).toEqual(["min_volume"]);
  });

  it("covers every scalar and nested field of the settings", () => {
    for (const path of Object.keys(FIELD_RANGES)) expect(Number.isFinite(getPath(defaults, path))).toBe(true);
    expect(Object.keys(FIELD_RANGES)).toHaveLength(25);
  });
});

describe("setPath", () => {
  it("returns a copy and leaves the original untouched", () => {
    const edited = setPath(defaults, "weights.spike", 35);

    expect(edited.weights.spike).toBe(35);
    expect(defaults.weights.spike).toBe(40);
  });
});
