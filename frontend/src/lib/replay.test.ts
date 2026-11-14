import { describe, expect, it } from "vitest";
import { describeErrorCode, ui } from "./labels";
import { replayErrorCodes, replayStatusLabels } from "./labels/replay";
import { isRunning, isValidSpeed, progressPercent, speedInputValue, statusTone } from "./replay";

describe("progressPercent", () => {
  it("is a whole percent of the delivered rows", () => {
    expect(progressPercent({ progress_rows: 0, total_rows: 200 })).toBe(0);
    expect(progressPercent({ progress_rows: 50, total_rows: 200 })).toBe(25);
    expect(progressPercent({ progress_rows: 199, total_rows: 200 })).toBe(99);
    expect(progressPercent({ progress_rows: 200, total_rows: 200 })).toBe(100);
  });

  it("copes with an empty scenario and with overshoot", () => {
    expect(progressPercent({ progress_rows: 0, total_rows: 0 })).toBe(0);
    expect(progressPercent({ progress_rows: 5, total_rows: 0 })).toBe(0);
    expect(progressPercent({ progress_rows: 300, total_rows: 200 })).toBe(100);
  });
});

describe("isValidSpeed", () => {
  it("accepts integers from 1 to 100000 only", () => {
    for (const ok of ["1", "60", " 600 ", "100000"]) expect(isValidSpeed(ok)).toBe(true);
    for (const bad of ["", "0", "100001", "-5", "1.5", "fast", "1e3", "٣"]) expect(isValidSpeed(bad)).toBe(false);
  });
});

describe("status helpers", () => {
  it("knows a running scenario", () => {
    expect(isRunning({ status: "running" })).toBe(true);
    expect(isRunning({ status: "finished" })).toBe(false);
  });

  it("colours the badge by outcome", () => {
    expect(statusTone({ status: "running", error: null })).toBe("warn");
    expect(statusTone({ status: "finished", error: null })).toBe("ok");
    expect(statusTone({ status: "stopped", error: null })).toBe("muted");
    expect(statusTone({ status: "stopped", error: "heartbeat_lost" })).toBe("error");
    expect(statusTone({ status: "idle", error: null })).toBe("muted");
  });
});

describe("replay labels", () => {
  it("labels every status the API can return", () => {
    expect(Object.keys(replayStatusLabels).sort()).toEqual(["finished", "idle", "running", "stopped"]);
  });

  it("describes the replay error codes through describeErrorCode", () => {
    for (const code of Object.keys(replayErrorCodes)) expect(describeErrorCode(code)).not.toBe(code);
    expect(describeErrorCode("already_running")).toBe("Skenario ini sedang berjalan");
    expect(describeErrorCode("missing_columns:text")).toContain("text");
  });

  it("has no empty text", () => {
    const copy = ui.replay;
    const strings = [copy.title, copy.intro, copy.clockIdle, copy.empty, ...Object.values(copy.columns), ...Object.values(replayErrorCodes), copy.upload.format];
    for (const text of strings) expect(text.trim()).not.toBe("");
  });
});

describe("speedInputValue", () => {
  it("uses the scenario default until the user edits the field", () => {
    expect(speedInputValue(null, 600)).toBe("600");
    expect(speedInputValue(null, null)).toBe("");
  });

  it("keeps the field empty when the user clears it instead of reverting to the default", () => {
    expect(speedInputValue("", 600)).toBe("");
    expect(isValidSpeed(speedInputValue("", 600))).toBe(false);
  });

  it("shows what the user typed", () => {
    expect(speedInputValue("1", 600)).toBe("1");
  });
});
