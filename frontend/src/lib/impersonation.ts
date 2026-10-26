// Impersonation (look-alike) data for the topics page and alert evidence (PRD §10.7, F13). Pure helpers.

import { ui } from "./labels";

export type NormalizationRule = {
  rule: string;
  pairs?: string[];
  value?: string;
  position?: string;
};

export type Lookalike = {
  account: { id: number; handle: string; display_name: string | null; first_seen_at: string; platform_created_at: string | null };
  official: { id: number; handle: string; display_name: string };
  similarity: number;
  field: "handle" | "display_name";
  reading: string;
  same_name: boolean;
  rules: NormalizationRule[];
  other_matches: { official_id: number; handle: string; similarity: number; field: string }[];
  young: boolean;
  age_days: number | null;
  alert: { id: number; status: string } | null;
};

export type LookalikesResponse = {
  data: Lookalike[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    as_of: string;
    window: { from: string; to: string };
    officials_count: number;
  };
};

const copy = ui.impersonation.rules;

/** One readable phrase for a normalization rule the detector reported; an unknown rule shows its name. */
export function describeRule(rule: NormalizationRule): string {
  switch (rule.rule) {
    case "unicode_folded":
      return copy.unicode_folded;
    case "separators_removed":
      return copy.separators_removed;
    case "confusable_chars":
      return copy.confusable_chars((rule.pairs ?? []).join(", "));
    case "affix_stripped":
      return copy.affix_stripped(rule.value ?? "", rule.position ?? "suffix");
    case "trailing_digits_stripped":
      return copy.trailing_digits_stripped(rule.value ?? "");
    default:
      return rule.rule;
  }
}

/** The rules as a list of phrases, in the order the detector applied them. */
export function describeRules(rules: NormalizationRule[] | null | undefined): string[] {
  return (rules ?? []).map(describeRule);
}

/** `?page=2&per_page=25&official_account_id=3` for the look-alikes endpoint; empty values are left out. */
export function lookalikesQuery(page: number, officialAccountId: number | null): string {
  const query = new URLSearchParams({ page: String(Math.max(1, Math.floor(page))) });
  if (officialAccountId !== null) query.set("official_account_id", String(officialAccountId));
  return query.toString();
}
