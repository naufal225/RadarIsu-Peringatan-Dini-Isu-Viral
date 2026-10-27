// Fixture /admin/audit untuk /dev/preview/audit dan tes. Bentuknya mengikuti respons nyata GET /audit-logs.

import type { AuditPage, UserOption } from "@/lib/api-types/audit";

export const AUDIT_USERS: UserOption[] = [
  { id: 1, name: "Admin Demo" },
  { id: 2, name: "Analis Demo" },
  { id: 3, name: "Pimpinan Demo" },
];

export const AUDIT_PAGE: AuditPage = {
  data: [
    {
      id: 412,
      action: "alert.approve",
      object_type: "alert",
      object_id: 17,
      detail: { from: "escalated", to: "approved", note: "Setuju ditindaklanjuti humas." },
      ip_address: "10.0.0.12",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      created_at: "2026-10-27T07:31:12+00:00",
      user: { id: 3, name: "Pimpinan Demo", email: "leader@radarisu.test" },
    },
    {
      id: 411,
      action: "replay.start",
      object_type: "replay_scenario",
      object_id: 1,
      detail: { speed_factor: 600, run_number: 2 },
      ip_address: "10.0.0.10",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      created_at: "2026-10-27T07:02:45+00:00",
      user: { id: 1, name: "Admin Demo", email: "admin@radarisu.test" },
    },
    {
      id: 410,
      action: "auth.login_failed",
      object_type: null,
      object_id: null,
      detail: { email: "tamu@contoh.test" },
      ip_address: "10.0.0.99",
      user_agent: null,
      created_at: "2026-10-26T23:58:03+00:00",
      user: null,
    },
    {
      id: 409,
      action: "auth.logout",
      object_type: "user",
      object_id: 2,
      detail: {},
      ip_address: "10.0.0.11",
      user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
      created_at: "2026-10-26T16:12:00+00:00",
      user: { id: 2, name: "Analis Demo", email: "analyst@radarisu.test" },
    },
  ],
  meta: { current_page: 1, last_page: 3, per_page: 50, total: 104 },
};

export const AUDIT_EMPTY: AuditPage = { data: [], meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 } };
