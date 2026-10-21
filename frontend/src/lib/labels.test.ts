import { describe, expect, it } from "vitest";
import {
  alertActionLabels,
  alertKindLabels,
  alertStatusLabels,
  evidenceReasonLabels,
  manualLabelLabels,
  roleLabels,
  sentimentLabels,
  severityLabels,
  topicCategoryLabels,
} from "./labels";
import { ROLES } from "./permissions";

const keys = (map: object) => Object.keys(map).sort();

// PRD §14: every identifier shown in the UI has an Indonesian label.
describe("label map", () => {
  it("covers every role from the generated permissions", () => {
    expect(keys(roleLabels)).toEqual([...ROLES].sort());
    expect(roleLabels).toEqual({ admin: "Admin Sistem", analyst: "Analis", leader: "Pimpinan" });
  });

  it("covers every alert status, kind and severity (§9.5)", () => {
    expect(keys(alertStatusLabels)).toEqual(
      ["approved", "closed", "escalated", "false_positive", "new", "returned", "reviewing"],
    );
    expect(keys(alertKindLabels)).toEqual(["impersonation", "issue"]);
    expect(keys(severityLabels)).toEqual(["high", "low", "medium"]);
  });

  it("covers evidence reasons, sentiments, manual labels and topic categories", () => {
    expect(keys(evidenceReasonLabels)).toEqual(
      ["name_similarity", "similar_text", "spike_sample", "synchronized_posting", "young_account"],
    );
    expect(keys(sentimentLabels)).toEqual(["negative", "neutral", "positive"]);
    expect(keys(manualLabelLabels)).toEqual(["anomalous", "organic"]);
    expect(keys(topicCategoryLabels)).toEqual(["general", "impersonation", "institution", "opsec"]);
  });

  it("uses the PRD wording for workflow actions", () => {
    expect(alertActionLabels.return).toBe("Minta analisis lanjutan");
    expect(alertStatusLabels.escalated).toBe("Dieskalasi");
  });

  it("has no empty labels", () => {
    const maps = [
      roleLabels, alertStatusLabels, severityLabels, alertKindLabels, sentimentLabels,
      manualLabelLabels, evidenceReasonLabels, topicCategoryLabels, alertActionLabels,
    ];
    for (const map of maps) {
      for (const value of Object.values(map)) expect(value.trim()).not.toBe("");
    }
  });
});
