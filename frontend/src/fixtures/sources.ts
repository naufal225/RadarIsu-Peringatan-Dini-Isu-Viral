// Fixture /admin/sources untuk /dev/preview/sources dan tes. Bentuknya mengikuti respons nyata GET /sources.

import type { ImportBatch, Source, SourceList } from "@/lib/api-types/sources";

export const SOURCES: Source[] = [
  {
    id: 3,
    type: "csv",
    name: "Arsip unggahan humas",
    config: {},
    interval_minutes: null,
    is_active: true,
    is_simulated: false,
    last_fetched_at: null,
    last_status: "never",
    last_error: null,
    created_at: "2026-10-22T03:00:00+00:00",
    raw_items_count: 1240,
  },
  {
    id: 1,
    type: "rss",
    name: "Portal berita daerah",
    config: { url: "https://contoh.test/rss.xml", max_items: 50 },
    interval_minutes: 15,
    is_active: true,
    is_simulated: false,
    last_fetched_at: "2026-10-27T07:20:00+00:00",
    last_status: "ok",
    last_error: null,
    created_at: "2026-10-21T08:00:00+00:00",
    raw_items_count: 382,
  },
  {
    id: 2,
    type: "youtube",
    name: "Kanal video publik",
    config: { video_ids: ["dQw4w9WgXcQ", "aBcDeFgHiJk"] },
    interval_minutes: 60,
    is_active: false,
    is_simulated: false,
    last_fetched_at: "2026-10-26T09:10:00+00:00",
    last_status: "error",
    last_error: "HTTP 403 dari YouTube Data API: kuota habis",
    created_at: "2026-10-21T08:30:00+00:00",
    raw_items_count: 0,
  },
  {
    id: 9,
    type: "replay",
    name: "Replay: Narasi terkoordinasi terhadap institusi",
    config: {},
    interval_minutes: null,
    is_active: false,
    is_simulated: true,
    last_fetched_at: null,
    last_status: "never",
    last_error: null,
    created_at: "2026-10-26T15:40:00+00:00",
    raw_items_count: 202,
  },
];

export const SOURCE_LIST: SourceList = { data: SOURCES };

export const IMPORT_RESULT: ImportBatch = {
  id: 7,
  source_id: 3,
  filename: "humas-oktober.csv",
  total_rows: 120,
  success_rows: 117,
  failed_rows: 3,
  errors: [
    { row: 14, message: "invalid_posted_at" },
    { row: 52, message: "missing_text" },
    { row: 88, message: "duplicate_row" },
  ],
  created_by: 1,
  created_at: "2026-10-27T07:40:00+00:00",
};
