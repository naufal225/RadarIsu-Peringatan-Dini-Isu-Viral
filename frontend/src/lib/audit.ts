// F10: aturan kecil halaman Audit (logika murni, dengan tes).

import type { AuditEntry, AuditFilters } from "@/lib/api-types/audit";

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
