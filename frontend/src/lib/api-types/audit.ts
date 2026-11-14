// GET /audit-logs (PRD §11, F10). Bentuk diambil dari AuditLogController::auditLogs, bukan dari harapan.

import type { auditActionLabels } from "@/lib/labels";

export type AuditAction = keyof typeof auditActionLabels;

export type AuditEntry = {
  id: number;
  /** One of PRD §9.7; an unknown value is shown as its code. */
  action: AuditAction | string;
  object_type: string | null;
  object_id: number | null;
  /** Always an object (empty `{}` when there is nothing to add). */
  detail: Record<string, unknown>;
  ip_address: string;
  user_agent: string | null;
  created_at: string;
  /** Null for actions without a signed-in user (e.g. `auth.login_failed`, scheduled jobs). */
  user: { id: number; name: string; email: string } | null;
};

export type AuditPage = {
  data: AuditEntry[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

/** Filters as the API takes them: `user_id`, `action`, `from`/`to` (Y-m-d, `to` covers the whole day). */
export type AuditFilters = { user_id: string; action: string; from: string; to: string };

export type UserOption = { id: number; name: string };

/** GET /audit-logs/summary: jumlah per aksi dan per hari (UTC), dengan filter tanggal yang sama seperti daftar. */
export type AuditSummary = {
  total: number;
  by_action: Record<string, number>;
  by_day: { day: string; total: number }[];
};
