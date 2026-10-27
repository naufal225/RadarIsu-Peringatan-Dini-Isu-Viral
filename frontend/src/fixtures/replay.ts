// Fixture /admin/replay untuk /dev/preview/replay dan tes. Bentuknya mengikuti respons nyata GET /replay/scenarios.

import type { ReplayListResponse, ReplayScenario } from "@/lib/api-types/replay";

const base: ReplayScenario = {
  id: 1,
  name: "Narasi terkoordinasi terhadap institusi",
  description: "30 jam percakapan normal, lalu 40 akun menyebarkan pesan yang hampir sama.",
  total_rows: 202,
  incident_start_offset_seconds: 108000,
  default_speed_factor: 600,
  status: "idle",
  speed_factor: null,
  run_number: 0,
  progress_rows: 0,
  started_at: null,
  virtual_anchor_at: null,
  heartbeat_at: null,
  finished_at: null,
  error: null,
  source_id: null,
  created_at: "2026-10-26T15:40:00+00:00",
};

export const REPLAY_IDLE: ReplayScenario = base;

export const REPLAY_RUNNING: ReplayScenario = {
  ...base,
  status: "running",
  speed_factor: 600,
  run_number: 2,
  progress_rows: 131,
  started_at: "2026-10-27T07:02:45+00:00",
  virtual_anchor_at: "2026-10-26T01:02:45+00:00",
  heartbeat_at: "2026-10-27T07:05:10+00:00",
  source_id: 9,
};

export const REPLAY_FINISHED: ReplayScenario = {
  ...base,
  id: 2,
  name: "Lonjakan topik layanan publik",
  description: null,
  total_rows: 96,
  incident_start_offset_seconds: 72000,
  status: "finished",
  speed_factor: 1200,
  run_number: 1,
  progress_rows: 96,
  started_at: "2026-10-26T12:00:00+00:00",
  virtual_anchor_at: "2026-10-25T16:00:00+00:00",
  finished_at: "2026-10-26T12:04:00+00:00",
  source_id: 10,
};

export const REPLAY_FAILED: ReplayScenario = {
  ...base,
  id: 3,
  name: "Peniruan akun resmi",
  description: null,
  total_rows: 48,
  status: "stopped",
  speed_factor: 60,
  run_number: 1,
  progress_rows: 12,
  started_at: "2026-10-26T09:00:00+00:00",
  virtual_anchor_at: "2026-10-25T09:00:00+00:00",
  finished_at: "2026-10-26T09:03:00+00:00",
  error: "heartbeat_lost",
  source_id: 11,
};

const meta = { current_page: 1, last_page: 1, per_page: 25, total: 3, clock_now: null, data_now: "2026-10-27T07:05:00+00:00" };

export const REPLAY_LIST_IDLE: ReplayListResponse = { data: [REPLAY_IDLE, REPLAY_FINISHED, REPLAY_FAILED], meta };

export const REPLAY_LIST_RUNNING: ReplayListResponse = {
  data: [REPLAY_RUNNING, REPLAY_FINISHED, REPLAY_FAILED],
  meta: { ...meta, clock_now: "2026-10-26T13:20:00+00:00", data_now: "2026-10-26T13:20:00+00:00" },
};

export const REPLAY_LIST_EMPTY: ReplayListResponse = { data: [], meta: { ...meta, total: 0 } };
