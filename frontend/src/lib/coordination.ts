// Coordination detection data for the topic page and alert evidence (PRD §10.6, F4). Pure helpers.

import { formatDecimal } from "./format";
import { describeRules, type NormalizationRule } from "./impersonation";
import { ui } from "./labels";

export type CoordinationAccount = {
  id: number;
  handle: string | null;
  similarity: number;
  young: boolean;
  age_days: number | null;
  synchronized: boolean;
  posts_count: number;
};

export type CoordinationCluster = {
  cluster_id: number;
  accounts_count: number;
  posts_count: number;
  similarity_min: number;
  similarity_max: number;
  from: string;
  to: string;
  synchronized: { is_synchronized: boolean; ratio: number; posts_in_window: number; window_minutes: number };
  sample_text: string;
  accounts: CoordinationAccount[];
};

export type CoordinationResponse = {
  data: {
    topic_id: number;
    as_of: string;
    triggered: boolean;
    window: { from: string; to: string };
    posts_in_window: number;
    accounts_in_window: number;
    truncated: boolean;
    thresholds: {
      similarity_threshold: number;
      min_accounts_cluster: number;
      coordination_window_minutes: number;
      young_account_days: number;
      synchronized_window_minutes: number;
      synchronized_ratio: number;
    };
    clusters: CoordinationCluster[];
  };
};

const copy = ui.coordination.evidence;

const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/**
 * One readable line for the evidence of an alert, from the numbers the detector stored in `detail`.
 * Null when the reason has no summary or the detail lacks the numbers, so the caller can show the raw data alone.
 */
export function summarizeEvidence(reason: string, detail: Record<string, unknown> | null | undefined): string | null {
  const d = record(detail);

  switch (reason) {
    case "spike_sample": {
      const rate = num(d.current_rate);
      const mean = num(d.baseline_mean);
      const z = num(d.z);
      const needed = num(record(d.thresholds).z_effective);
      if (rate === null || mean === null || z === null || needed === null) return null;
      return copy.spikeSample(formatDecimal(rate, 0, 1), formatDecimal(mean, 0, 1), formatDecimal(z, 0, 1), formatDecimal(needed, 0, 1));
    }
    case "similar_text": {
      const similarity = num(d.similarity);
      const cluster = num(d.cluster_id);
      const accounts = num(d.cluster_accounts);
      const posts = num(d.cluster_posts);
      if (similarity === null || cluster === null || accounts === null || posts === null) return null;
      return withTruncated(copy.similarText(formatDecimal(similarity, 2, 2), cluster, accounts, posts), d);
    }
    case "young_account": {
      const days = num(d.account_age_days);
      const limit = num(d.young_account_days);
      if (days === null || limit === null) return null;
      return copy.youngAccount(formatDecimal(days, 0, 1), limit);
    }
    case "synchronized_posting": {
      const sync = record(d.synchronized);
      const inWindow = num(sync.posts_in_window);
      const total = num(d.cluster_posts);
      const minutes = num(sync.window_minutes);
      const ratio = num(sync.ratio);
      if (inWindow === null || total === null || minutes === null || ratio === null) return null;
      return copy.synchronizedPosting(inWindow, total, minutes, formatDecimal(ratio, 2, 2));
    }
    case "name_similarity": {
      const similarity = num(d.similarity);
      const handle = record(d.official).handle;
      if (similarity === null || typeof handle !== "string") return null;
      const fields = ui.impersonation.evidence.fieldNames;
      const field = d.field === "display_name" ? fields.display_name : fields.handle;
      const parts = [ui.impersonation.evidence.nameSimilarity(formatDecimal(similarity, 2, 2), handle, field)];
      if (d.same_name === true) parts.push(ui.impersonation.evidence.sameName);
      const rules = Array.isArray(d.rules) ? describeRules(d.rules as NormalizationRule[]) : [];
      if (rules.length > 0) parts.push(ui.impersonation.evidence.rules(rules.join("; ")));
      return parts.join(" ");
    }
    default:
      return null;
  }
}

function withTruncated(text: string, detail: Record<string, unknown>): string {
  return detail.truncated === true ? `${text} ${copy.truncated}` : text;
}

/** Accounts of a cluster that carry a flag, for the "x of y" lines in the panel. */
export function countFlags(accounts: CoordinationAccount[]): { young: number; synchronized: number } {
  return {
    young: accounts.filter((account) => account.young).length,
    synchronized: accounts.filter((account) => account.synchronized).length,
  };
}
