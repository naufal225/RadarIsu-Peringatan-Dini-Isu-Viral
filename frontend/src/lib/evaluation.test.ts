import { describe, expect, it } from "vitest";
import { describeErrorCode } from "./labels";
import { describeNote, f1Change, formatPercent, type EvaluationRun } from "./evaluation";
import { evaluationUi } from "./labels/evaluation";

function run(id: number, f1: number | null, scenarioId: number | null = null): EvaluationRun {
  return {
    id,
    scenario: scenarioId === null ? null : { id: scenarioId, name: `S${scenarioId}` },
    run_by: "Analis",
    labeled_posts: 100,
    tp: 1,
    fp: 0,
    fn: 0,
    precision: 1,
    recall: 1,
    f1,
    detection_latency_seconds: null,
    notes: [],
    created_at: "2026-10-26T10:00:00Z",
  };
}

describe("formatPercent", () => {
  it("uses the Indonesian decimal comma", () => {
    expect(formatPercent(0.8333)).toBe("83,3%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("f1Change", () => {
  it("compares with the previous run of the same scope, newest first", () => {
    const runs = [run(3, 0.9), run(2, 0.5, 7), run(1, 0.6)];
    expect(f1Change(runs, 0)).toBe(30);
    expect(f1Change(runs, 1)).toBeNull();
    expect(f1Change(runs, 2)).toBeNull();
  });

  it("is null without an earlier value", () => {
    expect(f1Change([run(2, null), run(1, 0.5)], 0)).toBeNull();
  });
});

describe("notes and labels", () => {
  it("describes stored note codes", () => {
    expect(describeNote("no_labeled_accounts")).toContain("Belum ada akun berlabel");
    expect(describeNote("mixed_label_accounts:2")).toContain("(2)");
    expect(describeNote("something_new")).toBe("something_new");
  });

  it("describes the evaluation error code", () => {
    expect(describeErrorCode("scenario_not_replayed")).toBe("Skenario ini belum pernah diputar ulang");
  });

  it("formats latency", () => {
    expect(evaluationUi.seconds(45)).toBe("45 detik");
    expect(evaluationUi.seconds(125)).toBe("2 menit 5 detik");
  });
});
