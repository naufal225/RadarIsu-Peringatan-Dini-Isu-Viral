// F14-b: evaluation run payload (GET /evaluation/runs) and small display rules.

import { evaluationNoteLabels } from "./labels/evaluation";

export type EvaluationRun = {
  id: number;
  scenario: { id: number; name: string } | null;
  run_by: string | null;
  labeled_posts: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  detection_latency_seconds: number | null;
  notes: string[];
  created_at: string;
};

export type EvaluationResponse = {
  data: EvaluationRun[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    scenarios: { id: number; name: string }[];
  };
};

/** 0.8333 -> "83,3%"; a missing value is a dash. */
export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

/**
 * F1 change against the previous run of the same scope (`runs` is newest first), in percentage points.
 * Null when there is no earlier run of that scope.
 */
export function f1Change(runs: EvaluationRun[], index: number): number | null {
  const run = runs[index];
  const scope = run.scenario?.id ?? null;
  const previous = runs.slice(index + 1).find((r) => (r.scenario?.id ?? null) === scope);
  if (!previous || run.f1 === null || previous.f1 === null) return null;
  return Math.round((run.f1 - previous.f1) * 1000) / 10;
}

/** Indonesian text of a stored note code such as "mixed_label_accounts:2"; unknown codes are shown as-is. */
export function describeNote(code: string): string {
  const colon = code.indexOf(":");
  const key = colon === -1 ? code : code.slice(0, colon);
  const detail = colon === -1 ? "" : code.slice(colon + 1);
  const label = (evaluationNoteLabels as Record<string, string>)[key];
  if (!label) return code;
  return detail ? `${label} (${detail})` : label;
}
