// F11: aturan kecil halaman Replay (logika murni, dengan tes). Tipe payload ada di lib/api-types/replay.ts.

import type { ReplayErrorBody, ReplayScenario } from "./api-types/replay";

export type { ReplayListResponse, ReplayScenario, ReplayStatus } from "./api-types/replay";

export const MIN_SPEED = 1;
export const MAX_SPEED = 100_000;

/** How often the page reloads while a scenario runs, in milliseconds. */
export const POLL_MS = 2000;

export function isRunning(scenario: Pick<ReplayScenario, "status">): boolean {
  return scenario.status === "running";
}

/** Whole percent of rows delivered, 0 for an empty scenario, never above 100. */
export function progressPercent(scenario: Pick<ReplayScenario, "progress_rows" | "total_rows">): number {
  if (scenario.total_rows <= 0) return 0;
  return Math.min(100, Math.floor((scenario.progress_rows / scenario.total_rows) * 100));
}

/** True when `value` is a speed the API accepts (an integer from 1 to 100000). */
export function isValidSpeed(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return n >= MIN_SPEED && n <= MAX_SPEED;
}

/** Status badge tone: running is highlighted, a stop with an error is a failure. */
export function statusTone(scenario: Pick<ReplayScenario, "status" | "error">): "ok" | "error" | "warn" | "muted" {
  if (scenario.status === "running") return "warn";
  if (scenario.status === "finished") return "ok";
  if (scenario.status === "stopped" && scenario.error) return "error";
  return "muted";
}

/** Which action the selected scenario allows: stop while it runs, start when nothing else runs. */
export function availableAction(scenario: Pick<ReplayScenario, "status">, anotherRunning: boolean): "start" | "stop" | "blocked" {
  if (isRunning(scenario)) return "stop";
  return anotherRunning ? "blocked" : "start";
}

/** Error codes from a 409/422 body, flattened (e.g. ["already_running"]). */
export function errorCodes(body: ReplayErrorBody): string[] {
  return Object.values(body?.errors ?? {}).flat();
}

/** Upload 422: per-field codes, the file-level code, and "line:code" row entries split apart. */
export function uploadErrors(body: ReplayErrorBody): { fields: Record<string, string[]>; file: string[]; rows: { line: string; code: string }[] } {
  const errors = body?.errors ?? {};
  const fields: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) if (key !== "file" && key !== "rows") fields[key] = value;
  const rows = (errors.rows ?? []).map((entry) => {
    const colon = entry.indexOf(":");
    return colon === -1 ? { line: "", code: entry } : { line: entry.slice(0, colon), code: entry.slice(colon + 1) };
  });
  return { fields, file: errors.file ?? [], rows };
}
