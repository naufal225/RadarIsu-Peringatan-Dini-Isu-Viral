// /topics, /topics/{id}/metrics, /topics/{id}/spike-baseline, /official-accounts (PRD §11, F2, F3).
// Bentuk dari TopicController, TopicSpikeController, dan OfficialAccountController; tipe tinggal di
// lib/topics.ts dan lib/spike.ts (sudah dipakai detektor dan tes), di sini hanya dikumpulkan.

export type { HourlyMetric, MetricsResponse, OfficialAccount, Topic, TopicCategory, TopicSensitivity } from "@/lib/topics";
export type { SpikeBaselineResponse, SpikePoint, SpikeSnapshot, SpikeStatus } from "@/lib/spike";

/** GET /topics returns all topics, templates included (`is_template`), without pagination. */
export type TopicList = { data: import("@/lib/topics").Topic[] };
