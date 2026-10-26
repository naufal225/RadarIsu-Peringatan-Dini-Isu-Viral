// F11: scenario list payload (GET /replay/scenarios) and the small rules the Replay page needs.

import { replayStatusLabels } from "./labels/replay";

export type ReplayStatus = keyof typeof replayStatusLabels;

export type ReplayScenario = {
  id: number;
  name: string;
  description: string | null;
  total_rows: number;
  incident_start_offset_seconds: number | null;
  default_speed_factor: number;
  status: ReplayStatus;
  speed_factor: number | null;
  run_number: number;
  progress_rows: number;
  started_at: string | null;
  virtual_anchor_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  error: string | null;
};

export type ReplayListResponse = {
  data: ReplayScenario[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; clock_now: string | null; data_now: string };
};

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
