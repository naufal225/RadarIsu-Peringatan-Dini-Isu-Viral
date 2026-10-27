// Topics and their hourly metrics (PRD §9.4, §9.8, §11, F2). Pure helpers, no UI strings.

export const CATEGORIES = ["institution", "impersonation", "opsec", "general"] as const;
export const SENSITIVITIES = ["low", "medium", "high"] as const;

export type TopicCategory = (typeof CATEGORIES)[number];
export type TopicSensitivity = (typeof SENSITIVITIES)[number];

export type Topic = {
  id: number;
  name: string;
  category: TopicCategory;
  keywords: string[];
  sensitivity: TopicSensitivity;
  is_template: boolean;
  is_active: boolean;
};

export type OfficialAccount = {
  id: number;
  handle: string;
  display_name: string;
  note: string | null;
};

export type HourlyMetric = {
  hour: string;
  volume: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  unique_accounts: number;
  anomalous_accounts: number;
  source_count: number;
};

export type MetricsResponse = {
  data: HourlyMetric[];
  /** `from` is inclusive and `to` exclusive, both UTC. */
  meta: { from: string; to: string; total: number; has_simulated_data: boolean };
};

/** Keywords typed in a textarea: one per line or comma separated, trimmed, without repeats (case-insensitive). */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const part of text.split(/[\n,]/)) {
    const keyword = part.trim();
    const key = keyword.toLowerCase();
    if (keyword === "" || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  return keywords;
}

/** PRD §9.8: template placeholders look like [nama satuan]; the API rejects them. */
export function hasPlaceholder(text: string): boolean {
  return text.includes("[") || text.includes("]");
}

const HOUR_MS = 3_600_000;

/**
 * The series with an explicit zero row for every hour of [from, to) the API left out, so a chart shows a
 * quiet hour as quiet instead of joining its neighbours.
 */
export function fillHours(rows: HourlyMetric[], from: string, to: string): HourlyMetric[] {
  const byHour = new Map(rows.map((row) => [Date.parse(row.hour), row]));
  const filled: HourlyMetric[] = [];
  for (let at = Date.parse(from); at < Date.parse(to); at += HOUR_MS) {
    filled.push(
      byHour.get(at) ?? {
        hour: new Date(at).toISOString().replace(".000Z", "Z"),
        volume: 0,
        positive_count: 0,
        negative_count: 0,
        neutral_count: 0,
        unique_accounts: 0,
        anomalous_accounts: 0,
        source_count: 0,
      },
    );
  }
  return filled;
}

export type MetricsSummary = { totalVolume: number; hoursWithData: number; peak: HourlyMetric | null };

export function summarize(rows: HourlyMetric[]): MetricsSummary {
  let peak: HourlyMetric | null = null;
  let totalVolume = 0;
  let hoursWithData = 0;
  for (const row of rows) {
    totalVolume += row.volume;
    if (row.volume > 0) hoursWithData += 1;
    if (row.volume > 0 && (peak === null || row.volume > peak.volume)) peak = row;
  }
  return { totalVolume, hoursWithData, peak };
}

/** Error codes (not field names) found in a Laravel 422 body, e.g. "keyword_has_placeholder". */
export function errorCodes(body: { errors?: Record<string, string[]> } | null): string[] {
  return [...new Set(Object.values(body?.errors ?? {}).flat())];
}

export type MetricsRange = "24h" | "7d";

/** Rows shown for a range: the API's default 7 days, or its last 24 hours. Never invents data. */
export function rowsForRange(rows: HourlyMetric[], range: MetricsRange): HourlyMetric[] {
  return range === "24h" ? rows.slice(-24) : rows;
}

/**
 * Spike reference lines for the chart, only when the server says the baseline is long enough:
 * mean and std of the baseline, and the per-hour rate at which the detector fires (never computed here).
 */
export function spikeReference(spike: {
  has_sufficient_baseline: boolean;
  mean: number;
  std: number;
  threshold_rate: number;
}): { baseline?: { mean: number; std: number }; threshold?: number } {
  if (!spike.has_sufficient_baseline) return {};
  return { baseline: { mean: spike.mean, std: spike.std }, threshold: spike.threshold_rate };
}

/** The window the detector looked at when it fired: the last `minutes` before `asOf`. Null when it did not fire. */
export function spikeWindow(triggered: boolean, asOf: string, minutes: number): { start: string; end: string } | null {
  if (!triggered) return null;
  const end = Date.parse(asOf);
  if (Number.isNaN(end)) return null;
  return { start: new Date(end - minutes * 60_000).toISOString(), end: new Date(end).toISOString() };
}
