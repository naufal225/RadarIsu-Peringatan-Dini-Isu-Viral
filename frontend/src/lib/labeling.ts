// F14-a: labeling queue payload (GET /labeling/posts) and its query string.

import type { labelingStatusFilterLabels } from "./labels/labeling";

export type ManualLabel = "organic" | "anomalous";
export type LabelingStatusFilter = keyof typeof labelingStatusFilterLabels;

export type LabelingPost = {
  id: number;
  text: string;
  posted_at: string;
  sentiment: string | null;
  label_manual: ManualLabel | null;
  is_simulated: boolean;
  account: { id: number; handle: string; display_name: string | null } | null;
  topics: { id: number; name: string }[];
};

export type LabelingProgress = { labeled: number; organic: number; anomalous: number; target: number };

export type LabelingResponse = {
  data: LabelingPost[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; progress: LabelingProgress };
};

/** Query string for the queue; `all` and a false simulated flag are left out. */
export function labelingQuery(filters: { status: LabelingStatusFilter; simulatedOnly: boolean; page: number }): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.simulatedOnly) params.set("is_simulated", "1");
  params.set("page", String(Math.max(1, filters.page)));
  return `labeling/posts?${params.toString()}`;
}

/** Whole percent of the target reached, capped at 100. */
export function labelingPercent(progress: Pick<LabelingProgress, "labeled" | "target">): number {
  if (progress.target <= 0) return 0;
  return Math.min(100, Math.floor((progress.labeled / progress.target) * 100));
}
