import { describe, expect, it } from "vitest";
import {
  alertActionLabels,
  alertKindLabels,
  alertStatusLabels,
  auditActionLabels,
  describeErrorCode,
  errorCodeLabels,
  evidenceReasonLabels,
  manualLabelLabels,
  roleLabels,
  sensitivityLabels,
  sentimentLabels,
  severityLabels,
  sourceStatusLabels,
  sourceTypeLabels,
  topicCategoryLabels,
  ui,
} from "./labels";
import { FIELD_RANGES } from "./detection-settings";
import { authUi, roleLabels as authRoleLabels } from "./labels/auth";
import { settingsUi } from "./labels/settings";
import { ROLES } from "./permissions";
import { CATEGORIES, SENSITIVITIES } from "./topics";

const keys = (map: object) => Object.keys(map).sort();

// PRD §14: every identifier shown in the UI has an Indonesian label.
describe("label map", () => {
  it("covers every role from the generated permissions", () => {
    expect(keys(roleLabels)).toEqual([...ROLES].sort());
    expect(roleLabels).toEqual({ admin: "Admin Sistem", analyst: "Analis", leader: "Pimpinan" });
  });

  it("merges the F12 label file into the shared map", () => {
    expect(roleLabels).toBe(authRoleLabels);
    expect(ui.login).toBe(authUi.login);
    expect(ui.logout).toBe(authUi.logout);
    expect(ui.forbidden).toBe(authUi.forbidden);
    expect(ui.users).toBe(authUi.users);
  });

  it("merges the F15 label file and labels every settings field", () => {
    expect(ui.settings).toBe(settingsUi);
    expect(ui.nav.settings).toBe(settingsUi.title);
    expect(keys(settingsUi.fields)).toEqual([...Object.keys(FIELD_RANGES)].sort());
    for (const field of Object.values(settingsUi.fields)) {
      expect(field.label.trim()).not.toBe("");
      expect(field.hint.trim()).not.toBe("");
    }
  it("labels every topic category and sensitivity, and the API error codes of topics", () => {
    expect(keys(topicCategoryLabels)).toEqual([...CATEGORIES].sort());
    expect(keys(sensitivityLabels)).toEqual([...SENSITIVITIES].sort());
    // Codes TopicController returns as validation messages.
    expect(keys(ui.topics.errors)).toEqual(["keyword_has_placeholder", "keywords_unmatchable", "range_too_long", "template_readonly"]);
    for (const message of Object.values(ui.topics.errors)) expect(message.trim()).not.toBe("");
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

  it("covers every PRD §9.7 audit action", () => {
    expect(Object.keys(auditActionLabels)).toHaveLength(28);
    expect(auditActionLabels["source.import"]).toBe("Impor CSV");
  });

  it("covers source types and statuses (§9.2)", () => {
    expect(keys(sourceTypeLabels)).toEqual(["csv", "replay", "rss", "youtube"]);
    expect(keys(sourceStatusLabels)).toEqual(["error", "never", "ok"]);
  });

  it("labels every error code the backend emits", () => {
    // Codes from CsvImporter and SourceController (backend/app/...).
    const backendCodes = [
      "missing_text", "missing_account_handle", "invalid_posted_at", "invalid_account_created_at",
      "field_too_long", "column_count_mismatch", "duplicate_row", "empty_file", "invalid_encoding",
      "too_many_rows", "missing_columns", "unknown_columns", "duplicate_columns", "source_not_csv",
      "offline_mode_enabled", "connection_test_not_supported",
    ];
    expect(keys(errorCodeLabels)).toEqual([...backendCodes].sort());
  });

  it("describes error codes, keeping the detail after the colon", () => {
    expect(describeErrorCode("duplicate_row")).toBe(errorCodeLabels.duplicate_row);
    expect(describeErrorCode("missing_columns:text,posted_at")).toBe("Kolom wajib tidak ada: text,posted_at");
    expect(describeErrorCode("something_new")).toBe("something_new");
  });

  it("has no empty labels", () => {
    const maps = [
      roleLabels, alertStatusLabels, severityLabels, alertKindLabels, sentimentLabels,
      manualLabelLabels, evidenceReasonLabels, topicCategoryLabels, alertActionLabels,
      sourceTypeLabels, sourceStatusLabels, auditActionLabels, errorCodeLabels,
    ];
    for (const map of maps) {
      for (const value of Object.values(map)) expect(value.trim()).not.toBe("");
    }
  });
});
