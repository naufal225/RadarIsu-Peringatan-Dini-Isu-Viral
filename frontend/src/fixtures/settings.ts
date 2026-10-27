// Fixture /admin/settings untuk /dev/preview/settings dan tes. Bentuknya mengikuti respons nyata
// GET /settings/detection dan GET /settings/offline-mode; nilainya adalah nilai awal PRD §9.6.

import type { DetectionSettings, OfflineModeResponse, SettingsResponse } from "@/lib/api-types/settings";

export const DEFAULT_DETECTION: DetectionSettings = {
  coordination_window_minutes: 15,
  z_threshold: 3,
  min_volume: 20,
  baseline_hours: 168,
  min_baseline_hours: 24,
  similarity_threshold: 0.8,
  min_accounts_cluster: 5,
  young_account_days: 30,
  impersonation_threshold: 0.6,
  spike_current_window_minutes: 60,
  spike_sample_limit: 10,
  synchronized_window_minutes: 5,
  synchronized_ratio: 0.8,
  impersonation_window_hours: 24,
  cooldown_minutes: 60,
  coordination_max_posts: 2000,
  weights: { spike: 40, anomaly: 30, sentiment: 20, reach: 10 },
  severity_cutoffs: { medium: 40, high: 70 },
  sensitivity_z_offset: { low: 1, medium: 0, high: -0.5 },
};

export const DETECTION_RESPONSE: SettingsResponse = {
  data: { key: "detection", value: DEFAULT_DETECTION, updated_at: "2026-10-26T09:15:00+00:00", updated_by: { id: 1, name: "Admin Demo" } },
};

export const DETECTION_NEVER_CHANGED: SettingsResponse = {
  data: { key: "detection", value: DEFAULT_DETECTION, updated_at: null, updated_by: null },
};

export const OFFLINE_RESPONSE: OfflineModeResponse = {
  data: { key: "offline_mode", value: { enabled: false }, updated_at: null, updated_by: null },
};
