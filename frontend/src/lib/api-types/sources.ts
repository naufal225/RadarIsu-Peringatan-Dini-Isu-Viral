// /sources, /sources/{id}/test, /sources/{id}/import, /sources/{id}/imports (PRD §11, F1).
// Bentuk dari SourceResource, ImportBatchResource, dan SourceController, bukan dari harapan.

import type { sourceStatusLabels, sourceTypeLabels } from "@/lib/labels";

export type SourceType = keyof typeof sourceTypeLabels;
export type SourceStatus = keyof typeof sourceStatusLabels;

export type SourceConfig = { url?: string; max_items?: number; video_ids?: string[] };

export type Source = {
  id: number;
  type: SourceType;
  name: string;
  /** rss: {url, max_items}; youtube: {video_ids}; csv/replay: {}. Kunci API tidak pernah dikirim. */
  config: SourceConfig;
  /** null for csv and replay sources. */
  interval_minutes: number | null;
  is_active: boolean;
  is_simulated: boolean;
  last_fetched_at: string | null;
  last_status: SourceStatus;
  last_error: string | null;
  created_at: string;
  raw_items_count: number;
};

/** GET /sources is not paginated (all sources, ordered by name). */
export type SourceList = { data: Source[] };

export type ImportRowError = { row: number; message: string };

export type ImportBatch = {
  id: number;
  source_id: number;
  filename: string;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  /** First 200 row problems; `message` is an error code (errorCodeLabels). */
  errors: ImportRowError[];
  created_by: number;
  created_at: string;
};

/** Types an admin may create (replay sources are made by Replay itself). */
export const CREATABLE_SOURCE_TYPES: SourceType[] = ["rss", "youtube", "csv"];
