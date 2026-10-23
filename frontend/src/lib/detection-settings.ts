// Detection settings (PRD §9.6, §10.5, §10.8, F15). Ranges and rules mirror
// backend/app/Http/Controllers/Api/V1/SettingController.php and are explained in docs/DETECTION_SETTINGS.md.
// Client-side checks are a convenience; the API is what enforces them.

export const WEIGHT_KEYS = ["spike", "anomaly", "sentiment", "reach"] as const;
export const SENSITIVITIES = ["low", "medium", "high"] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Sensitivity = (typeof SENSITIVITIES)[number];
export type Severity = "low" | "medium" | "high";

export type DetectionSettings = {
  coordination_window_minutes: number;
  z_threshold: number;
  min_volume: number;
  baseline_hours: number;
  min_baseline_hours: number;
  similarity_threshold: number;
  min_accounts_cluster: number;
  young_account_days: number;
  impersonation_threshold: number;
  weights: Record<WeightKey, number>;
  severity_cutoffs: { medium: number; high: number };
  sensitivity_z_offset: Record<Sensitivity, number>;
};

export type SettingsResponse = {
  data: {
    key: string;
    value: DetectionSettings;
    updated_at: string | null;
    updated_by: { id: number; name: string } | null;
  };
};

/** Smallest threshold the spike detector will use, whatever the offset (PRD §10.5). */
export const MIN_EFFECTIVE_Z = 2;

type Range = { min: number; max: number; integer: boolean; step: number };

/** Field path (dotted, as in API validation errors) → allowed range. */
export const FIELD_RANGES: Record<string, Range> = {
  coordination_window_minutes: { min: 1, max: 180, integer: true, step: 1 },
  z_threshold: { min: 2, max: 10, integer: false, step: 0.1 },
  min_volume: { min: 1, max: 10000, integer: true, step: 1 },
  baseline_hours: { min: 24, max: 720, integer: true, step: 1 },
  min_baseline_hours: { min: 1, max: 720, integer: true, step: 1 },
  similarity_threshold: { min: 0.3, max: 1, integer: false, step: 0.05 },
  min_accounts_cluster: { min: 2, max: 1000, integer: true, step: 1 },
  young_account_days: { min: 1, max: 365, integer: true, step: 1 },
  impersonation_threshold: { min: 0.3, max: 1, integer: false, step: 0.05 },
  "weights.spike": { min: 0, max: 100, integer: true, step: 1 },
  "weights.anomaly": { min: 0, max: 100, integer: true, step: 1 },
  "weights.sentiment": { min: 0, max: 100, integer: true, step: 1 },
  "weights.reach": { min: 0, max: 100, integer: true, step: 1 },
  "severity_cutoffs.medium": { min: 0, max: 100, integer: true, step: 1 },
  "severity_cutoffs.high": { min: 0, max: 100, integer: true, step: 1 },
  "sensitivity_z_offset.low": { min: -3, max: 3, integer: false, step: 0.1 },
  "sensitivity_z_offset.medium": { min: -3, max: 3, integer: false, step: 0.1 },
  "sensitivity_z_offset.high": { min: -3, max: 3, integer: false, step: 0.1 },
};

export function getPath(settings: DetectionSettings, path: string): number {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], settings) as number;
}

export function setPath(settings: DetectionSettings, path: string, value: number): DetectionSettings {
  const next = structuredClone(settings);
  const keys = path.split(".");
  const last = keys.pop() as string;
  const parent = keys.reduce<Record<string, unknown>>((node, key) => node[key] as Record<string, unknown>, next as unknown as Record<string, unknown>);
  parent[last] = value;
  return next;
}

export function weightsTotal(settings: DetectionSettings): number {
  return WEIGHT_KEYS.reduce((sum, key) => sum + settings.weights[key], 0);
}

/** Field paths that break a rule; same names the API reports in a 422. Empty when the form is valid. */
export function validateDetection(settings: DetectionSettings): string[] {
  const invalid: string[] = [];

  for (const [path, range] of Object.entries(FIELD_RANGES)) {
    const value = getPath(settings, path);
    const ok =
      Number.isFinite(value) && value >= range.min && value <= range.max && (!range.integer || Number.isInteger(value));
    if (!ok) invalid.push(path);
  }
  if (invalid.length > 0) return invalid; // relations only make sense between valid numbers

  if (weightsTotal(settings) !== 100) invalid.push("weights");
  if (settings.severity_cutoffs.medium >= settings.severity_cutoffs.high) invalid.push("severity_cutoffs.medium");
  if (settings.min_baseline_hours > settings.baseline_hours) invalid.push("min_baseline_hours");
  const offset = settings.sensitivity_z_offset;
  if (!(offset.low >= offset.medium && offset.medium >= offset.high)) invalid.push("sensitivity_z_offset");

  return invalid;
}

/** z needed to trigger a spike for a topic of the given sensitivity (PRD §10.5 step 4). */
export function effectiveZ(settings: DetectionSettings, sensitivity: Sensitivity): number {
  return Math.max(MIN_EFFECTIVE_Z, settings.z_threshold + settings.sensitivity_z_offset[sensitivity]);
}

export type PreviewInput = {
  z: number;
  anomalousRatio: number;
  negativeRatio: number;
  reachRatio: number;
};

export type PreviewComponent = { raw: number; weight: number; value: number };

export type Preview = {
  components: Record<WeightKey, PreviewComponent>;
  score: number;
  severity: Severity;
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/** ThreatScorer formula (PRD §10.8) applied to sample inputs, using the weights and cutoffs being edited. */
export function previewScore(settings: DetectionSettings, input: PreviewInput): Preview {
  const { weights, severity_cutoffs: cutoffs } = settings;
  const components: Preview["components"] = {
    spike: { raw: input.z, weight: weights.spike, value: clamp01(input.z / 6) * weights.spike },
    anomaly: { raw: input.anomalousRatio, weight: weights.anomaly, value: clamp01(input.anomalousRatio) * weights.anomaly },
    sentiment: { raw: input.negativeRatio, weight: weights.sentiment, value: clamp01(input.negativeRatio) * weights.sentiment },
    reach: { raw: input.reachRatio, weight: weights.reach, value: clamp01(input.reachRatio) * weights.reach },
  };
  const score = Math.round(WEIGHT_KEYS.reduce((sum, key) => sum + components[key].value, 0));
  const severity: Severity = score >= cutoffs.high ? "high" : score >= cutoffs.medium ? "medium" : "low";

  return { components, score, severity };
}
