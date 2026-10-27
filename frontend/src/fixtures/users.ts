// Fixture /admin/users untuk /dev/preview/users dan tes. Bentuknya mengikuti respons nyata GET /users.

import type { User, UserPage } from "@/lib/api-types/users";

export const USERS: User[] = [
  { id: 1, name: "Admin Demo", email: "admin@radarisu.test", role: "admin", is_active: true, last_login_at: "2026-10-27T10:04:00+00:00", created_at: "2026-10-21T08:00:00+00:00" },
  { id: 2, name: "Analis Demo", email: "analyst@radarisu.test", role: "analyst", is_active: true, last_login_at: "2026-10-27T09:55:00+00:00", created_at: "2026-10-21T08:00:00+00:00" },
  { id: 4, name: "Analis Cadangan", email: "analis2@radarisu.test", role: "analyst", is_active: false, last_login_at: null, created_at: "2026-10-24T02:00:00+00:00" },
  { id: 3, name: "Pimpinan Demo", email: "leader@radarisu.test", role: "leader", is_active: true, last_login_at: "2026-10-26T15:12:00+00:00", created_at: "2026-10-21T08:00:00+00:00" },
];

export const USER_PAGE: UserPage = { data: USERS, meta: { current_page: 1, last_page: 1, per_page: 50, total: USERS.length } };
