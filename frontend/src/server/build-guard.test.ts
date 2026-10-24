import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readBuildId, watchBuildId } from "./build-guard.mjs";

describe("watchBuildId", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    vi.useFakeTimers();
    dir = mkdtempSync(join(tmpdir(), "build-guard-"));
    file = join(dir, "BUILD_ID");
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports the previous and the new id once the build changes", () => {
    writeFileSync(file, "build-a\n");
    const onChange = vi.fn();
    watchBuildId({ file, intervalMs: 10, onChange });

    vi.advanceTimersByTime(50);
    expect(onChange).not.toHaveBeenCalled();

    writeFileSync(file, "build-b\n");
    vi.advanceTimersByTime(50);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("build-a", "build-b");
  });

  it("ignores a build in progress, when BUILD_ID is missing", () => {
    writeFileSync(file, "build-a");
    const onChange = vi.fn();
    watchBuildId({ file, intervalMs: 10, onChange });

    rmSync(file);
    vi.advanceTimersByTime(50);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does nothing without a build to compare with (development)", () => {
    const onChange = vi.fn();
    const stop = watchBuildId({ file, intervalMs: 10, onChange });

    writeFileSync(file, "build-a");
    vi.advanceTimersByTime(50);

    expect(onChange).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it("stops watching on request", () => {
    writeFileSync(file, "build-a");
    const onChange = vi.fn();
    watchBuildId({ file, intervalMs: 10, onChange })();

    writeFileSync(file, "build-b");
    vi.advanceTimersByTime(50);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reads and trims the id, null when absent", () => {
    expect(readBuildId(file)).toBeNull();
    writeFileSync(file, "  abc \n");
    expect(readBuildId(file)).toBe("abc");
  });
});
