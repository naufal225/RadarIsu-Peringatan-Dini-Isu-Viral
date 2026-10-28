// F1: aturan kecil halaman Sumber Data (logika murni, dengan tes).

import type { Source, SourceType } from "@/lib/api-types/sources";

export type SourceFormValues = {
  type: SourceType;
  name: string;
  url: string;
  max_items: string;
  video_ids: string;
  interval_minutes: string;
  is_active: boolean;
};

export function emptySourceForm(type: SourceType = "csv"): SourceFormValues {
  return { type, name: "", url: "", max_items: "50", video_ids: "", interval_minutes: "15", is_active: true };
}

export function formFromSource(source: Source): SourceFormValues {
  return {
    type: source.type,
    name: source.name,
    url: source.config.url ?? "",
    max_items: String(source.config.max_items ?? 50),
    video_ids: (source.config.video_ids ?? []).join("\n"),
    interval_minutes: String(source.interval_minutes ?? 15),
    is_active: source.is_active,
  };
}

/** Video IDs split on commas, spaces, or new lines; blanks dropped. */
export function parseVideoIds(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

/**
 * Body for POST /sources (create, with `type`) or PATCH /sources/{id} (edit, without `type`, which the API prohibits).
 * Numbers are sent as numbers; an empty number field is left to the server to reject.
 */
export function sourcePayload(values: SourceFormValues, mode: "create" | "edit"): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: values.name.trim(), is_active: values.is_active };
  if (mode === "create") payload.type = values.type;
  const number = (text: string) => (text.trim() === "" ? null : Number(text));

  if (values.type === "rss") payload.config = { url: values.url.trim(), max_items: number(values.max_items) };
  if (values.type === "youtube") payload.config = { video_ids: parseVideoIds(values.video_ids) };
  if (values.type === "rss" || values.type === "youtube") payload.interval_minutes = number(values.interval_minutes);
  return payload;
}

/** 422 keys ("config.url", "config.video_ids.0") mapped onto the form field that shows them. */
export function fieldErrors(body: { errors?: Record<string, string[]> } | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(body?.errors ?? {})) {
    const field = key.startsWith("config.video_ids") ? "video_ids" : key.startsWith("config.") ? key.slice("config.".length) : key;
    out[field] = [...(out[field] ?? []), ...messages];
  }
  return out;
}

export type SourceSummary = { total: number; active: number; failing: number; rawItems: number };

/** Counts over the whole list (GET /sources is not paginated): how many pull, how many failed their last check. */
export function sourceSummary(sources: Pick<Source, "is_active" | "last_status" | "raw_items_count">[]): SourceSummary {
  return {
    total: sources.length,
    active: sources.filter((s) => s.is_active).length,
    failing: sources.filter((s) => s.last_status === "error").length,
    rawItems: sources.reduce((sum, s) => sum + s.raw_items_count, 0),
  };
}

/** Only RSS and YouTube can be tested; only CSV sources accept an import. */
export function canTest(source: Pick<Source, "type">): boolean {
  return source.type === "rss" || source.type === "youtube";
}

export function canImport(source: Pick<Source, "type">): boolean {
  return source.type === "csv";
}
