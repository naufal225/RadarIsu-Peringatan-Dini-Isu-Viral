// GET/POST /replay/scenarios, POST .../start|stop (PRD §11, F11). Bentuk dari ReplayScenarioResource
// dan ReplayController::replayScenarios (meta.clock_now, meta.data_now), bukan dari harapan.

import type { replayStatusLabels } from "@/lib/labels/replay";

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
  source_id?: number | null;
  created_at?: string;
};

export type ReplayListResponse = {
  data: ReplayScenario[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    /** Jam data virtual selama Replay berjalan; null bila detektor memakai jam sebenarnya. */
    clock_now: string | null;
    /** Waktu "sekarang" yang dipakai detektor (DataClock::now()). */
    data_now: string;
  };
};

/** 409 dari start/stop dan 422 dari unggah membawa kode galat (`lib/labels/replay.ts` replayErrorCodes). */
export type ReplayErrorBody = { message?: string; errors?: Record<string, string[]> } | null;

/** GET /replay/scenarios/{id}/composition: komposisi baris skenario menurut fase dan label manual. */
export type ReplayComposition = {
  total: number;
  phases: { baseline: number; incident: number };
  labels: { organic: number; anomalous: number; unlabeled: number };
};
