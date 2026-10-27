// Fixture /topics dan /topics/[id] untuk /dev/preview/topics dan tes. Bentuknya mengikuti respons nyata
// GET /topics, /topics/{id}/metrics, /topics/{id}/spike-baseline, dan /official-accounts.

import type { MetricsResponse, OfficialAccount, SpikeBaselineResponse, Topic } from "@/lib/api-types/topics";

export const TOPICS: Topic[] = [
  { id: 4, name: "Layanan publik satuan contoh", category: "institution", keywords: ["layanan satuan", "antrean loket", "pengaduan"], sensitivity: "high", is_template: false, is_active: true },
  { id: 5, name: "Demo Replay: narasi terkoordinasi (simulasi)", category: "general", keywords: ["institusi contoh"], sensitivity: "medium", is_template: false, is_active: true },
  { id: 6, name: "Istilah internal lama", category: "opsec", keywords: ["sandi lama"], sensitivity: "low", is_template: false, is_active: false },
  // UC1–UC3 templates (TopicTemplateSeeder): keywords are placeholders the analyst must replace.
  { id: 1, name: "Isu terhadap [nama institusi/satuan]", category: "institution", keywords: ["[nama institusi]", "[nama satuan]"], sensitivity: "medium", is_template: true, is_active: false },
  { id: 2, name: "Peniruan akun resmi [nama satuan]", category: "impersonation", keywords: ["[nama satuan]", "[nama akun resmi]"], sensitivity: "medium", is_template: true, is_active: false },
  { id: 3, name: "Istilah sensitif [ditetapkan satuan]", category: "opsec", keywords: ["[istilah sensitif]"], sensitivity: "medium", is_template: true, is_active: false },
];

const START = Date.UTC(2026, 9, 20, 0);
const HOUR = 3_600_000;

/** 7 days (168 hours) of metrics with a burst near the end; gaps are left out like the API does. */
export const METRICS: MetricsResponse = {
  data: Array.from({ length: 168 }, (_, h) => {
    const volume = 12 + Math.round(5 * Math.sin(h / 4)) + (h >= 160 && h <= 163 ? [30, 90, 140, 60][h - 160] : 0);
    return {
      hour: new Date(START + h * HOUR).toISOString().replace(".000Z", "Z"),
      volume,
      positive_count: Math.round(volume * 0.2),
      negative_count: Math.round(volume * 0.4),
      neutral_count: volume - Math.round(volume * 0.2) - Math.round(volume * 0.4),
      unique_accounts: Math.round(volume * 0.8),
      anomalous_accounts: 0,
      source_count: 2,
    };
  }).filter((_, h) => h % 23 !== 7),
  meta: { from: new Date(START).toISOString().replace(".000Z", "Z"), to: new Date(START + 168 * HOUR).toISOString().replace(".000Z", "Z"), total: 0, has_simulated_data: true },
};

export const METRICS_EMPTY: MetricsResponse = { data: [], meta: { ...METRICS.meta, total: 0, has_simulated_data: false } };

const asOf = new Date(START + 163 * HOUR + 40 * 60_000).toISOString();

export const SPIKE: SpikeBaselineResponse = {
  data: {
    topic_id: 4,
    as_of: asOf,
    spike: {
      triggered: true,
      status: "triggered",
      has_sufficient_baseline: true,
      current: 140,
      current_rate: 140,
      mean: 12.4,
      std: 3.6,
      z: 35.4,
      z_effective: 2.5,
      baseline_hours: 168,
      threshold_rate: 21.4,
      thresholds: {
        z_threshold: 3,
        sensitivity: "high",
        sensitivity_z_offset: -0.5,
        z_effective: 2.5,
        min_volume: 20,
        min_baseline_hours: 24,
        baseline_window_hours: 168,
        current_window_minutes: 60,
      },
    },
    series: [],
  },
};

export const SPIKE_LEARNING: SpikeBaselineResponse = {
  data: {
    ...SPIKE.data,
    spike: { ...SPIKE.data.spike, triggered: false, status: "insufficient_baseline", has_sufficient_baseline: false, baseline_hours: 9, z: 0, mean: 0, std: 0, threshold_rate: 0 },
  },
};

export const OFFICIAL_ACCOUNTS: OfficialAccount[] = [
  { id: 1, handle: "@satuan_contoh", display_name: "Satuan Contoh", note: "Akun utama" },
  { id: 2, handle: "@humas_satuan", display_name: "Humas Satuan Contoh", note: null },
];
