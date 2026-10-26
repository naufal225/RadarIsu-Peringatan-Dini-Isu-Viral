// Spike detection data for the topic chart (PRD §10.5, F3). Pure helpers, no UI strings.

export const SPIKE_STATUSES = ["triggered", "below_threshold", "below_min_volume", "insufficient_baseline"] as const;
export type SpikeStatus = (typeof SPIKE_STATUSES)[number];

/** Hours offered for the chart; the API accepts 6-168. */
export const SPIKE_HOUR_OPTIONS = [24, 72, 168] as const;
export const DEFAULT_SPIKE_HOURS = 72;

export type SpikeSnapshot = {
  triggered: boolean;
  status: SpikeStatus;
  has_sufficient_baseline: boolean;
  current: number;
  current_rate: number;
  mean: number;
  std: number;
  z: number;
  z_effective: number;
  baseline_hours: number;
  /** Posts per hour at which z reaches z_effective. */
  threshold_rate: number;
  thresholds: {
    z_threshold: number;
    sensitivity: string;
    sensitivity_z_offset: number;
    z_effective: number;
    min_volume: number;
    min_baseline_hours: number;
    baseline_window_hours: number;
    current_window_minutes: number;
  };
};

export type SpikePoint = { hour: string; volume: number; is_running_hour: boolean };

export type SpikeBaselineResponse = {
  data: { topic_id: number; as_of: string; spike: SpikeSnapshot; series: SpikePoint[] };
};

export type SpikeTone = "error" | "ok" | "muted" | "warn";

/** Badge tone: a fired spike is the loud one, a topic still learning its baseline is neutral. */
export function spikeTone(status: SpikeStatus): SpikeTone {
  switch (status) {
    case "triggered":
      return "error";
    case "below_min_volume":
      return "warn";
    case "insufficient_baseline":
      return "muted";
    default:
      return "ok";
  }
}

export type ChartPoint = SpikePoint & { is_complete: boolean };

/** Series for the chart: the running hour is partial, so it is flagged and drawn apart from full hours. */
export function chartPoints(series: SpikePoint[]): ChartPoint[] {
  return series.map((point) => ({ ...point, is_complete: !point.is_running_hour }));
}

/** True when the series has no post at all, so the chart is replaced by an empty message. */
export function isEmptySeries(series: SpikePoint[]): boolean {
  return series.every((point) => point.volume === 0);
}
