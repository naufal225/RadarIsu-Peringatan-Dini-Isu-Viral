// F10: aturan kecil halaman Audit (logika murni, dengan tes).

import type { AuditEntry, AuditFilters } from "@/lib/api-types/audit";
import { formatNumber } from "@/lib/format/number";

export const EMPTY_AUDIT_FILTERS: AuditFilters = { user_id: "", action: "", from: "", to: "" };

/** `audit-logs?page=2&action=...`; empty filters are left out. */
export function auditQuery(filters: AuditFilters, page: number): string {
  const params = new URLSearchParams({ page: String(Math.max(1, page)) });
  for (const key of ["user_id", "action", "from", "to"] as const) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  return `audit-logs?${params.toString()}`;
}

export function hasActiveFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== "");
}

/** "topic #12", or null when the entry has no object. */
export function objectLabel(entry: Pick<AuditEntry, "object_type" | "object_id">): string | null {
  if (!entry.object_type) return null;
  return entry.object_id === null ? entry.object_type : `${entry.object_type} #${entry.object_id}`;
}

export type DetailPart = { key: string | null; value: string };

const MAX_PARTS = 3;
const MAX_VALUE = 60;

function scalar(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value.length > MAX_VALUE ? `${value.slice(0, MAX_VALUE - 1)}…` : value;
  if (typeof value === "number") return formatNumber(value, 0, 3);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number")) {
    return value.length ? value.map((v) => (typeof v === "number" ? formatNumber(v, 0, 3) : v)).join(", ") : null;
  }
  return null; // Nested object: only in the full JSON.
}

/**
 * One-line summary of the detail for the table: `from → to` first, then up to three plain key/value
 * pairs. Values come from the data as-is (escaped by React); nested objects stay in the full JSON.
 */
export function detailSummary(detail: Record<string, unknown> | null | undefined): { parts: DetailPart[]; more: boolean } {
  if (!detail) return { parts: [], more: false };
  const parts: DetailPart[] = [];
  let skipped = 0;
  const from = scalar(detail.from);
  const to = scalar(detail.to);
  const keys = Object.keys(detail).filter((key) => !(from !== null && to !== null && (key === "from" || key === "to")));
  if (from !== null && to !== null) parts.push({ key: null, value: `${from} → ${to}` });
  for (const key of keys) {
    const value = scalar(detail[key]);
    if (value === null) {
      if (detail[key] !== null && detail[key] !== undefined && detail[key] !== "") skipped++;
      continue;
    }
    if (parts.length >= MAX_PARTS) {
      skipped++;
      continue;
    }
    parts.push({ key, value });
  }
  return { parts, more: skipped > 0 };
}

/** Pretty JSON for the expandable detail; null when the detail is empty. Rendered as text, never as HTML. */
export function detailText(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail || Object.keys(detail).length === 0) return null;
  return JSON.stringify(detail, null, 2);
}

/** Field names from a 422 body, mapped to the filter they belong to. */
export function filterErrors(body: { errors?: Record<string, string[]> } | null): Partial<Record<keyof AuditFilters, string[]>> {
  const errors = body?.errors ?? {};
  const out: Partial<Record<keyof AuditFilters, string[]>> = {};
  for (const key of ["user_id", "action", "from", "to"] as const) if (errors[key]?.length) out[key] = errors[key];
  return out;
}

/** Query ringkasan audit: hanya rentang tanggal, karena ringkasan tidak dipengaruhi filter pengguna atau aksi. */
export function auditSummaryQuery(filters: { from: string; to: string }): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `audit-logs/summary?${query}` : "audit-logs/summary";
}
