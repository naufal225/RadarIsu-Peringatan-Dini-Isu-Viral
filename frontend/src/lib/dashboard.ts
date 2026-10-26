// Types and pure utility functions for Situation Dashboard (F8, Domain C).
// Reference: PRD §11.2, §12.2, docs/CONTRACTS.md §2.4, §3.2.

export type TrendPoint = {
  hour: string;
  volume: number;
};

export type DashboardSummary = {
  active_issues: number;
  highest_severity: "low" | "medium" | "high" | null;
  awaiting_decision: number;
  trend_24h: TrendPoint[];
  data_notice: {
    has_simulated_data: boolean;
  };
};

export type RankedIssue = {
  id: number;
  kind: "issue" | "impersonation";
  status: "new" | "reviewing" | "escalated" | "returned" | "approved" | "false_positive" | "closed";
  score: number;
  severity: "low" | "medium" | "high";
  topic: { id: number; name: string } | null;
  subject_account: { id: number; handle: string } | null;
  score_breakdown?: Record<string, unknown> | null;
  detected_at: string;
  recommendation?: string | null;
};

/**
 * Calculate the total post volume across the 24-hour trend.
 */
export function calculateTotalVolume(points: TrendPoint[]): number {
  return points.reduce((sum, p) => sum + (Number.isFinite(p.volume) ? p.volume : 0), 0);
}

/**
 * Identify the peak volume hour from the 24-hour trend series.
 * Returns null if points array is empty or all volumes are 0.
 */
export function calculatePeakHour(points: TrendPoint[]): TrendPoint | null {
  if (!points || points.length === 0) return null;

  let peak: TrendPoint | null = null;
  for (const point of points) {
    if (point.volume > 0 && (!peak || point.volume > peak.volume)) {
      peak = point;
    }
  }

  return peak;
}

/**
 * Maps a severity level to a visual badge tone for UI consistency.
 */
export function severityTone(severity: "low" | "medium" | "high" | null | undefined): "ok" | "warn" | "error" | "muted" {
  switch (severity) {
    case "high":
      return "error";
    case "medium":
      return "warn";
    case "low":
      return "ok";
    default:
      return "muted";
  }
}
